from django.db.models import Count, OuterRef, Prefetch, QuerySet, Subquery
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import ApiError
from apps.spaces.models import SpaceMembership

from . import services
from .access import organizations_for
from .mixins import OrgScopedMixin
from .models import Invitation, Organization, OrgMembership, OrgRole
from .permissions import IsOrgAdmin, IsOrgAdminOrReadOnly
from .serializers import (
    InvitationCreatedSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
    OrganizationSerializer,
    OrgMembershipSerializer,
    OrgRoleUpdateSerializer,
    PublicInvitationSerializer,
)


def annotated_organizations(user) -> QuerySet[Organization]:  # type: ignore[no-untyped-def]
    my_role = OrgMembership.objects.filter(organization=OuterRef("pk"), user=user).values("role")[:1]
    return organizations_for(user).annotate(
        my_role=Subquery(my_role), member_count=Count("memberships", distinct=True)
    )


class OrganizationViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Organization.objects.none()
    serializer_class = OrganizationSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    pagination_class = None

    def get_queryset(self) -> QuerySet[Organization]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return annotated_organizations(self.request.user).order_by("name")

    def perform_create(self, serializer: OrganizationSerializer) -> None:
        org = services.create_organization(user=self.request.user, name=serializer.validated_data["name"])
        serializer.instance = self.get_queryset().get(pk=org.pk)

    def perform_update(self, serializer: OrganizationSerializer) -> None:
        if serializer.instance.my_role != OrgRole.ADMIN:
            raise ApiError("permission_denied", "Only organization admins can change this.", status.HTTP_403_FORBIDDEN)
        serializer.save()


class MemberViewSet(
    OrgScopedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = OrgMembership.objects.none()
    serializer_class = OrgMembershipSerializer
    permission_classes = [IsAuthenticated, IsOrgAdminOrReadOnly]
    search_fields = ["user__email", "user__full_name"]
    filterset_fields = ["role"]

    def get_scoped_queryset(self) -> QuerySet[OrgMembership]:
        space_memberships = SpaceMembership.objects.filter(space__organization=self.org).select_related("space")
        return (
            OrgMembership.objects.filter(organization=self.org)
            .select_related("user")
            .prefetch_related(Prefetch("user__space_memberships", queryset=space_memberships, to_attr="org_space_memberships"))
            .order_by("user__email")
        )

    @extend_schema(request=OrgRoleUpdateSerializer, responses=OrgMembershipSerializer)
    def partial_update(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        membership = self.get_object()
        serializer = OrgRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.change_org_role(membership, serializer.validated_data["role"])
        return Response(self.get_serializer(self.get_queryset().get(pk=membership.pk)).data)

    def perform_destroy(self, instance: OrgMembership) -> None:
        services.remove_member(instance)


class InvitationViewSet(
    OrgScopedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Invitation.objects.none()
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated, IsOrgAdmin]
    search_fields = ["email"]

    def get_scoped_queryset(self) -> QuerySet[Invitation]:
        queryset = Invitation.objects.filter(organization=self.org).select_related("space", "invited_by")
        if self.request.query_params.get("pending") in {"1", "true"}:
            queryset = queryset.filter(
                accepted_at__isnull=True, revoked_at__isnull=True, expires_at__gt=timezone.now()
            )
        return queryset

    def _created_response(self, invitation: Invitation, raw_token: str, code: int) -> Response:
        data = InvitationSerializer(invitation, context=self.get_serializer_context()).data
        data["invite_url"] = services.invite_url(raw_token)
        return Response(data, status=code)

    @extend_schema(request=InvitationCreateSerializer, responses={201: InvitationCreatedSerializer})
    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        serializer = InvitationCreateSerializer(data=request.data, context={"organization": self.org})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        invitation, raw_token = services.create_invitation(
            organization=self.org,
            email=data["email"],
            role=data["role"],
            invited_by=request.user,
            space=data.get("space"),
            space_role=data.get("space_role", ""),
        )
        return self._created_response(invitation, raw_token, status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=InvitationCreatedSerializer)
    @action(detail=True, methods=["post"])
    def resend(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        invitation, raw_token = services.resend_invitation(self.get_object())
        return self._created_response(invitation, raw_token, status.HTTP_200_OK)

    def perform_destroy(self, instance: Invitation) -> None:
        services.revoke_invitation(instance)


class PublicInvitationView(APIView):
    """Lets the invite page show what the link is for, before the user signs in."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(responses=PublicInvitationSerializer)
    def get(self, request: Request, token: str) -> Response:
        return Response(PublicInvitationSerializer(services.get_invitation_by_token(token)).data)


class AcceptInvitationView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=OrganizationSerializer)
    def post(self, request: Request, token: str) -> Response:
        membership = services.accept_invitation(raw_token=token, user=request.user)
        org = annotated_organizations(request.user).get(pk=membership.organization_id)
        return Response(OrganizationSerializer(org).data)
