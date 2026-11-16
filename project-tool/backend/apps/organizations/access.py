"""Single source of truth for "who can see what".

Every queryset that returns tenant data must be built on these helpers (usually via
the mixins in ``apps.organizations.mixins``) so isolation is enforced in one place.
"""

from django.db.models import Q, QuerySet

from apps.accounts.models import User
from apps.spaces.models import Space, SpaceMembership, SpaceRole

from .models import Organization, OrgMembership, OrgRole


def get_org_membership(user: User, org_id: int | str) -> OrgMembership | None:
    if not user.is_authenticated:
        return None
    return (
        OrgMembership.objects.select_related("organization")
        .filter(user=user, organization_id=org_id)
        .first()
    )


def organizations_for(user: User) -> QuerySet[Organization]:
    # A subquery (not a join) so aggregates over memberships stay correct.
    return Organization.objects.filter(pk__in=OrgMembership.objects.filter(user=user).values("organization_id"))


def visible_spaces(user: User, membership: OrgMembership) -> QuerySet[Space]:
    """ADMINs see every space of the org; everyone else only the spaces they belong to."""
    spaces = Space.objects.filter(organization_id=membership.organization_id)
    if membership.role == OrgRole.ADMIN:
        return spaces
    return spaces.filter(memberships__user=user)


def get_space_role(user: User, space: Space) -> str | None:
    return SpaceMembership.objects.filter(user=user, space=space).values_list("role", flat=True).first()


def can_manage_space(user: User, space: Space, membership: OrgMembership) -> bool:
    if membership.organization_id != space.organization_id:
        return False
    if membership.role == OrgRole.ADMIN:
        return True
    return get_space_role(user, space) == SpaceRole.MANAGER


def can_contribute(user: User, space: Space, membership: OrgMembership) -> bool:
    """May create tasks, tags and comments in ``space``: org ADMIN, or space MANAGER/EMPLOYEE."""
    if membership.organization_id != space.organization_id:
        return False
    if membership.role == OrgRole.ADMIN:
        return True
    return get_space_role(user, space) in (SpaceRole.MANAGER, SpaceRole.EMPLOYEE)


def is_space_participant(user_id: int, space: Space) -> bool:
    """Can ``user_id`` be assigned work in ``space``? Space members and org admins can."""
    return (
        SpaceMembership.objects.filter(space=space, user_id=user_id).exists()
        or OrgMembership.objects.filter(
            organization_id=space.organization_id, user_id=user_id, role=OrgRole.ADMIN
        ).exists()
    )


def participants(space: Space) -> QuerySet[User]:
    """Everyone who can be assigned work in ``space``."""
    return User.objects.filter(
        Q(space_memberships__space=space)
        | Q(org_memberships__organization_id=space.organization_id, org_memberships__role=OrgRole.ADMIN)
    ).distinct()


def can_edit_task(user: User, task, membership: OrgMembership, space_role: str | None = None) -> bool:  # type: ignore[no-untyped-def]
    """ADMINs and space MANAGERs edit any task; EMPLOYEEs only tasks they created or are assigned to.

    Pass ``space_role`` when it is already known to save a query.
    """
    if membership.organization_id != task.space.organization_id:
        return False
    if membership.role == OrgRole.ADMIN:
        return True
    role = space_role if space_role is not None else get_space_role(user, task.space)
    if role == SpaceRole.MANAGER:
        return True
    if role != SpaceRole.EMPLOYEE:
        return False
    # Iterating uses prefetched assignees when the caller loaded them.
    return task.created_by_id == user.pk or any(a.pk == user.pk for a in task.assignees.all())
