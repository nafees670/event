from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.spaces.models import SpaceRole


class OrgRole(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    MEMBER = "MEMBER", "Member"
    GUEST = "GUEST", "Guest"


class Organization(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class OrgMembership(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="org_memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=OrgRole.choices, default=OrgRole.MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["organization__name", "user__email"]
        constraints = [models.UniqueConstraint(fields=["user", "organization"], name="unique_org_membership")]

    def __str__(self) -> str:
        return f"{self.user} in {self.organization} ({self.role})"


class InvitationStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    ACCEPTED = "ACCEPTED", "Accepted"
    REVOKED = "REVOKED", "Revoked"
    EXPIRED = "EXPIRED", "Expired"


class Invitation(models.Model):
    """An invite to join an organization, optionally straight into a space.

    Only a SHA-256 hash of the token is stored; the raw token lives in the emailed link.
    """

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=10, choices=OrgRole.choices, default=OrgRole.MEMBER)
    space = models.ForeignKey(
        "spaces.Space", null=True, blank=True, on_delete=models.CASCADE, related_name="invitations"
    )
    space_role = models.CharField(max_length=10, choices=SpaceRole.choices, blank=True)
    token_hash = models.CharField(max_length=64, unique=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Invite {self.email} to {self.organization}"

    @property
    def status(self) -> str:
        if self.accepted_at:
            return InvitationStatus.ACCEPTED
        if self.revoked_at:
            return InvitationStatus.REVOKED
        if timezone.now() >= self.expires_at:
            return InvitationStatus.EXPIRED
        return InvitationStatus.PENDING
