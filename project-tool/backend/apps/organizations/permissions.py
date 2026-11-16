from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.request import Request

from . import access
from .models import OrgRole


class IsOrgAdmin(BasePermission):
    message = "Only organization admins can do this."

    def has_permission(self, request: Request, view) -> bool:  # type: ignore[no-untyped-def]
        return view.org_membership.role == OrgRole.ADMIN


class IsOrgAdminOrReadOnly(BasePermission):
    message = "Only organization admins can change this."

    def has_permission(self, request: Request, view) -> bool:  # type: ignore[no-untyped-def]
        return request.method in SAFE_METHODS or view.org_membership.role == OrgRole.ADMIN


class CanManageSpaceOrReadOnly(BasePermission):
    """Writes need org ADMIN or MANAGER of ``view.space``."""

    message = "Only organization admins and space managers can change this."

    def has_permission(self, request: Request, view) -> bool:  # type: ignore[no-untyped-def]
        if request.method in SAFE_METHODS:
            return True
        return access.can_manage_space(request.user, view.space, view.org_membership)
