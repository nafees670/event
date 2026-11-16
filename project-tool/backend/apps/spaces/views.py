from django.db.models import Count, OuterRef, QuerySet, Subquery
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.serializers import UserSummarySerializer
from apps.core.exceptions import ApiError
from apps.organizations import access
from apps.organizations.mixins import SpaceChildMixin, SpaceScopedMixin
from apps.organizations.models import OrgMembership
from apps.organizations.permissions import CanManageSpaceOrReadOnly

from . import services
from .models import CustomFieldDefinition, Space, SpaceMembership, SpaceRole, WorkflowState
from .serializers import (
    CustomFieldSerializer,
    ReorderSerializer,
    SpaceMembershipCreateSerializer,
    SpaceMembershipSerializer,
    SpaceRoleUpdateSerializer,
    SpaceSerializer,
    SpaceWriteSerializer,
    WorkflowStateSerializer,
)
from .services import set_space_membership


class SpaceViewSet(SpaceScopedMixin, viewsets.ModelViewSet):
    """Spaces of an organization. ADMINs create and delete; ADMINs and the space's MANAGERs edit."""

    queryset = Space.objects.none()
    serializer_class = SpaceSerializer
    pagination_class = None
    search_fields = ["name", "short_code"]
    filterset_fields = ["department_type"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_scoped_queryset(self) -> QuerySet[Space]:
        my_role = SpaceMembership.objects.filter(space=OuterRef("pk"), user=self.request.user).values("role")[:1]
        return (
            self.get_visible_spaces()
            .annotate(my_role=Subquery(my_role), member_count=Count("memberships", distinct=True))
            .order_by("name")
        )

    def _require_admin(self) -> None:
        if not self.is_org_admin:
            raise ApiError("permission_denied", "Only organization admins can do this.", status.HTTP_403_FORBIDDEN)

    def _detail(self, space: Space) -> Response:
        return Response(self.get_serializer(self.get_queryset().get(pk=space.pk)).data)

    @extend_schema(request=SpaceWriteSerializer, responses={201: SpaceSerializer})
    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self._require_admin()
        serializer = SpaceWriteSerializer(data=request.data, context={"organization": self.org})
        serializer.is_valid(raise_exception=True)
        space = services.create_space(organization=self.org, created_by=request.user, **serializer.validated_data)
        SpaceMembership.objects.create(user=request.user, space=space, role=SpaceRole.MANAGER)
        response = self._detail(space)
        response.status_code = status.HTTP_201_CREATED
        return response

    @extend_schema(request=SpaceWriteSerializer, responses=SpaceSerializer)
    def partial_update(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        space = self.get_object()
        if not access.can_manage_space(request.user, space, self.org_membership):
            raise ApiError(
                "permission_denied",
                "Only organization admins and space managers can change this.",
                status.HTTP_403_FORBIDDEN,
            )
        serializer = SpaceWriteSerializer(space, data=request.data, partial=True, context={"organization": self.org})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return self._detail(space)

    def destroy(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self._require_admin()
        space = self.get_object()
        if Space.objects.filter(organization=self.org).count() <= 1:
            raise ApiError("last_space", "An organization needs at least one space.", status.HTTP_409_CONFLICT)
        space.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses=UserSummarySerializer(many=True), summary="People who can be assigned work here")
    @action(detail=True, methods=["get"])
    def participants(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        users = access.participants(self.get_object()).order_by("full_name", "email")
        return Response(UserSummarySerializer(users, many=True).data)


class SpaceMemberViewSet(
    SpaceChildMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = SpaceMembership.objects.none()
    serializer_class = SpaceMembershipSerializer
    permission_classes = [IsAuthenticated, CanManageSpaceOrReadOnly]
    search_fields = ["user__email", "user__full_name"]

    def get_scoped_queryset(self) -> QuerySet[SpaceMembership]:
        return SpaceMembership.objects.filter(space=self.space).select_related("user").order_by("user__email")

    @extend_schema(request=SpaceMembershipCreateSerializer, responses={201: SpaceMembershipSerializer})
    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        serializer = SpaceMembershipCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_org_member = OrgMembership.objects.filter(
            organization=self.org, user_id=serializer.validated_data["user_id"]
        ).exists()
        if not is_org_member:
            raise ApiError("not_org_member", "Add this person to the organization first.")
        user = User.objects.get(pk=serializer.validated_data["user_id"])
        membership = set_space_membership(user=user, space=self.space, role=serializer.validated_data["role"])
        return Response(SpaceMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=SpaceRoleUpdateSerializer, responses=SpaceMembershipSerializer)
    def partial_update(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        membership = self.get_object()
        serializer = SpaceRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = set_space_membership(user=membership.user, space=self.space, role=serializer.validated_data["role"])
        return Response(SpaceMembershipSerializer(membership).data)


class _SpaceConfigViewSet(SpaceChildMixin, viewsets.ModelViewSet):
    """Shared plumbing for per-space configuration (states, fields): read for all, write for managers."""

    permission_classes = [IsAuthenticated, CanManageSpaceOrReadOnly]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_context(self):  # type: ignore[no-untyped-def]
        context = super().get_serializer_context()
        if hasattr(self, "space"):
            context["space"] = self.space
        return context

    @extend_schema(request=ReorderSerializer, responses={204: None})
    @action(detail=False, methods=["post"])
    def reorder(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reorder(self.get_queryset(), serializer.validated_data["ids"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkflowStateViewSet(_SpaceConfigViewSet):
    queryset = WorkflowState.objects.none()
    serializer_class = WorkflowStateSerializer

    def get_scoped_queryset(self) -> QuerySet[WorkflowState]:
        return WorkflowState.objects.filter(space=self.space).annotate(task_count=Count("tasks")).order_by("order", "id")

    def perform_create(self, serializer: WorkflowStateSerializer) -> None:
        serializer.instance = services.create_state(space=self.space, **serializer.validated_data)

    def perform_update(self, serializer: WorkflowStateSerializer) -> None:
        make_default = serializer.validated_data.pop("is_default", None)
        if make_default is False and serializer.instance.is_default:
            raise ApiError("default_required", "Make another state the default instead.")
        state = services.update_state(serializer.instance, serializer.validated_data)
        if make_default:
            services.set_default_state(state)

    @extend_schema(
        parameters=[OpenApiParameter("move_to", int, description="State that receives this state's tasks")],
    )
    def destroy(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        state = self.get_object()
        move_to = None
        if raw := request.query_params.get("move_to"):
            move_to = WorkflowState.objects.filter(space=self.space, pk=raw).first() if raw.isdigit() else None
            if move_to is None:
                raise ApiError("invalid_move_to", "Choose another state of the same space.")
        services.delete_state(state, move_to)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomFieldViewSet(_SpaceConfigViewSet):
    queryset = CustomFieldDefinition.objects.none()
    serializer_class = CustomFieldSerializer

    def get_scoped_queryset(self) -> QuerySet[CustomFieldDefinition]:
        return CustomFieldDefinition.objects.filter(space=self.space).order_by("order", "id")

    def perform_create(self, serializer: CustomFieldSerializer) -> None:
        serializer.instance = services.create_field(space=self.space, **serializer.validated_data)

