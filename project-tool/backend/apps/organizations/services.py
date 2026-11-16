import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status

from apps.accounts.models import User
from apps.accounts.services import send_email
from apps.core.exceptions import ApiError
from apps.spaces.models import DepartmentType, Space, SpaceMembership, SpaceRole
from apps.spaces.services import create_space, set_space_membership

from .models import Invitation, Organization, OrgMembership, OrgRole


def _unique_slug(name: str) -> str:
    base = slugify(name)[:120] or "org"
    slug, n = base, 2
    while Organization.objects.filter(slug=slug).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


@transaction.atomic
def create_organization(*, user: User, name: str) -> Organization:
    """Create an org with the creator as ADMIN and a default "General" space."""
    org = Organization.objects.create(name=name.strip(), slug=_unique_slug(name), created_by=user)
    OrgMembership.objects.create(user=user, organization=org, role=OrgRole.ADMIN)
    general = create_space(
        organization=org,
        name="General",
        short_code="GEN",
        department_type=DepartmentType.GENERAL,
        created_by=user,
    )
    SpaceMembership.objects.create(user=user, space=general, role=SpaceRole.MANAGER)
    return org


# --- Membership management ----------------------------------------------------


def _admin_count(org: Organization) -> int:
    return OrgMembership.objects.filter(organization=org, role=OrgRole.ADMIN).count()


@transaction.atomic
def change_org_role(membership: OrgMembership, new_role: str) -> OrgMembership:
    membership = OrgMembership.objects.select_for_update().get(pk=membership.pk)
    if membership.role == OrgRole.ADMIN and new_role != OrgRole.ADMIN and _admin_count(membership.organization) <= 1:
        raise ApiError("last_admin", "An organization must keep at least one admin.", status.HTTP_409_CONFLICT)
    membership.role = new_role
    membership.save(update_fields=["role"])
    if new_role == OrgRole.GUEST:
        SpaceMembership.objects.filter(
            user_id=membership.user_id, space__organization_id=membership.organization_id
        ).update(role=SpaceRole.GUEST)
    return membership


@transaction.atomic
def remove_member(membership: OrgMembership) -> None:
    if membership.role == OrgRole.ADMIN and _admin_count(membership.organization) <= 1:
        raise ApiError("last_admin", "An organization must keep at least one admin.", status.HTTP_409_CONFLICT)
    SpaceMembership.objects.filter(
        user_id=membership.user_id, space__organization_id=membership.organization_id
    ).delete()
    membership.delete()


# --- Invitations ----------------------------------------------------------------


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def invite_url(raw_token: str) -> str:
    return f"{settings.FRONTEND_URL}/invite/{raw_token}"


def _default_space_role(org_role: str, space_role: str) -> str:
    if org_role == OrgRole.GUEST:
        return SpaceRole.GUEST
    return space_role or SpaceRole.EMPLOYEE


@transaction.atomic
def create_invitation(
    *,
    organization: Organization,
    email: str,
    role: str,
    invited_by: User,
    space: Space | None = None,
    space_role: str = "",
) -> tuple[Invitation, str]:
    """Create an invitation and email the join link. Returns the invitation and the raw token."""
    email = email.strip().lower()
    if OrgMembership.objects.filter(organization=organization, user__email__iexact=email).exists():
        raise ApiError("already_member", "This person is already a member of the organization.")
    now = timezone.now()
    # A new invite replaces any earlier pending one for the same address.
    Invitation.objects.filter(
        organization=organization, email__iexact=email, accepted_at__isnull=True, revoked_at__isnull=True
    ).update(revoked_at=now)

    raw_token = secrets.token_urlsafe(32)
    invitation = Invitation.objects.create(
        organization=organization,
        email=email,
        role=role,
        space=space,
        space_role=_default_space_role(role, space_role) if space else "",
        token_hash=hash_token(raw_token),
        invited_by=invited_by,
        expires_at=now + timedelta(hours=settings.INVITATION_EXPIRY_HOURS),
    )
    _send_invitation_email(invitation, raw_token)
    return invitation, raw_token


@transaction.atomic
def resend_invitation(invitation: Invitation) -> tuple[Invitation, str]:
    if invitation.accepted_at:
        raise ApiError("invitation_accepted", "This invitation was already accepted.", status.HTTP_409_CONFLICT)
    raw_token = secrets.token_urlsafe(32)
    invitation.token_hash = hash_token(raw_token)
    invitation.revoked_at = None
    invitation.expires_at = timezone.now() + timedelta(hours=settings.INVITATION_EXPIRY_HOURS)
    invitation.save(update_fields=["token_hash", "revoked_at", "expires_at"])
    _send_invitation_email(invitation, raw_token)
    return invitation, raw_token


def revoke_invitation(invitation: Invitation) -> None:
    if invitation.accepted_at:
        raise ApiError("invitation_accepted", "This invitation was already accepted.", status.HTTP_409_CONFLICT)
    invitation.revoked_at = timezone.now()
    invitation.save(update_fields=["revoked_at"])


def _send_invitation_email(invitation: Invitation, raw_token: str) -> None:
    inviter = invitation.invited_by.display_name if invitation.invited_by else "Someone"
    target = f" ({invitation.space.name} space)" if invitation.space else ""
    send_email(
        f"You're invited to join {invitation.organization.name} on PM Suite",
        f"{inviter} invited you to join {invitation.organization.name}{target}.\n\n"
        f"Accept the invitation here:\n{invite_url(raw_token)}\n\n"
        f"The link expires in {settings.INVITATION_EXPIRY_HOURS} hours.",
        [invitation.email],
    )


def get_invitation_by_token(raw_token: str) -> Invitation:
    invitation = (
        Invitation.objects.select_related("organization", "space", "invited_by")
        .filter(token_hash=hash_token(raw_token))
        .first()
    )
    if invitation is None:
        raise ApiError("invitation_not_found", "This invitation link is invalid.", status.HTTP_404_NOT_FOUND)
    return invitation


@transaction.atomic
def accept_invitation(*, raw_token: str, user: User) -> OrgMembership:
    invitation = get_invitation_by_token(raw_token)
    invitation = Invitation.objects.select_for_update().get(pk=invitation.pk)
    if invitation.accepted_at:
        raise ApiError("invitation_accepted", "This invitation was already accepted.", status.HTTP_409_CONFLICT)
    if invitation.revoked_at:
        raise ApiError("invitation_revoked", "This invitation was revoked.", status.HTTP_410_GONE)
    if timezone.now() >= invitation.expires_at:
        raise ApiError("invitation_expired", "This invitation has expired. Ask for a new one.", status.HTTP_410_GONE)
    if invitation.email.lower() != user.email.lower():
        raise ApiError(
            "invitation_email_mismatch",
            f"This invitation was sent to {invitation.email}. Sign in with that address to accept it.",
            status.HTTP_403_FORBIDDEN,
        )

    membership, _created = OrgMembership.objects.get_or_create(
        user=user, organization=invitation.organization, defaults={"role": invitation.role}
    )
    if invitation.space_id:
        set_space_membership(user=user, space=invitation.space, role=invitation.space_role or SpaceRole.EMPLOYEE)

    invitation.accepted_at = timezone.now()
    invitation.accepted_by = user
    invitation.save(update_fields=["accepted_at", "accepted_by"])
    return membership
