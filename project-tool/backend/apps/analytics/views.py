from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.serializers import UserSummarySerializer
from apps.core.exceptions import ApiError
from apps.organizations import access
from apps.organizations.mixins import SpaceScopedMixin
from apps.organizations.models import OrgMembership, OrgRole

from . import services


class AnalyticsView(SpaceScopedMixin, APIView):
    """Dashboard numbers. ``?space=<id>``: one space (its managers and org admins).
    Without it: the whole company (org admins only)."""

    @extend_schema(
        parameters=[OpenApiParameter("space", int, description="Limit to one space")],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request: Request, org_id: int) -> Response:
        raw = request.query_params.get("space")
        if raw:
            space = self.get_visible_spaces().filter(pk=raw).first() if raw.isdigit() else None
            if space is None:
                raise NotFound()
            if not access.can_manage_space(request.user, space, self.org_membership):
                raise ApiError(
                    "permission_denied",
                    "Space analytics are for organization admins and the space's managers.",
                    status.HTTP_403_FORBIDDEN,
                )
            spaces = self.get_visible_spaces().filter(pk=space.pk)
            people = access.participants(space)
        else:
            if not self.is_org_admin:
                raise ApiError(
                    "permission_denied", "Company analytics are for organization admins.", status.HTTP_403_FORBIDDEN
                )
            spaces = self.get_visible_spaces()
            members = OrgMembership.objects.filter(organization=self.org).exclude(role=OrgRole.GUEST)
            people = User.objects.filter(pk__in=members.values("user_id"))

        data = services.build(spaces=spaces, people=people, company=not raw)
        for row in data["workload"]:
            row["user"] = UserSummarySerializer(row["user"]).data
        return Response(data)
