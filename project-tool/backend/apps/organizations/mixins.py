from django.db.models import QuerySet
from rest_framework.exceptions import NotFound
from rest_framework.request import Request

from apps.core.exceptions import NoSpaceAssigned
from apps.spaces.models import Space

from . import access
from .models import Organization, OrgMembership, OrgRole


class OrgScopedMixin:
    """Resolve ``org_id`` from the URL and require the user to be a member.

    Non-members get 404 rather than 403 so IDs of other organizations cannot be probed.
    The scope is resolved before permission classes run, so they can use
    ``view.org_membership`` (and ``view.space`` for ``SpaceChildMixin``).
    """

    org_url_kwarg = "org_id"
    org: Organization
    org_membership: OrgMembership

    def check_permissions(self, request: Request) -> None:
        if request.user and request.user.is_authenticated:
            self.resolve_scope(request)
        super().check_permissions(request)  # type: ignore[misc]

    def resolve_scope(self, request: Request) -> None:
        membership = access.get_org_membership(request.user, self.kwargs[self.org_url_kwarg])  # type: ignore[attr-defined]
        if membership is None:
            raise NotFound()
        self.org_membership = membership
        self.org = membership.organization

    @property
    def is_org_admin(self) -> bool:
        return self.org_membership.role == OrgRole.ADMIN

    def get_queryset(self) -> QuerySet:
        # Schema generation instantiates views without a request scope.
        if getattr(self, "swagger_fake_view", False):
            return self.queryset  # type: ignore[attr-defined]
        return self.get_scoped_queryset()

    def get_scoped_queryset(self) -> QuerySet:
        raise NotImplementedError


class SpaceScopedMixin(OrgScopedMixin):
    """For data that lives inside spaces: restricts to spaces the user can see."""

    def get_visible_spaces(self) -> QuerySet[Space]:
        spaces = access.visible_spaces(self.request.user, self.org_membership)  # type: ignore[attr-defined]
        if not self.is_org_admin and not spaces.exists():
            raise NoSpaceAssigned()
        return spaces


class SpaceChildMixin(SpaceScopedMixin):
    """Resolve ``space_id`` from the URL; 404 when the space is not visible to the user."""

    space_url_kwarg = "space_id"
    space: Space

    def resolve_scope(self, request: Request) -> None:
        super().resolve_scope(request)
        space = self.get_visible_spaces().filter(pk=self.kwargs[self.space_url_kwarg]).first()  # type: ignore[attr-defined]
        if space is None:
            raise NotFound()
        self.space = space
