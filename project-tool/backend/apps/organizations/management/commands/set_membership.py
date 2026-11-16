from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.organizations.models import Organization, OrgMembership, OrgRole
from apps.organizations.services import change_org_role
from apps.spaces.models import Space, SpaceMembership, SpaceRole
from apps.spaces.services import set_space_membership


class Command(BaseCommand):
    help = (
        "Grant or change memberships.\n\n"
        "  Org role:    set_membership --email a@b.c --org acme --role ADMIN|MEMBER|GUEST\n"
        "  Space role:  set_membership --email a@b.c --org acme --space DEV --role MANAGER|EMPLOYEE|GUEST\n"
        "  List:        set_membership --list [--email a@b.c] [--org acme]\n\n"
        "--org accepts the organization slug or numeric id. With --space, the user is added to the\n"
        "organization as MEMBER (or GUEST for a GUEST space role) when not already a member."
    )

    def add_arguments(self, parser) -> None:  # type: ignore[no-untyped-def]
        parser.add_argument("--email")
        parser.add_argument("--org", help="Organization slug or id.")
        parser.add_argument("--role")
        parser.add_argument("--space", help="Space short code, e.g. DEV.")
        parser.add_argument("--list", action="store_true", help="List memberships instead of changing them.")

    def handle(self, *args, email: str | None, org: str | None, role: str | None, space: str | None, list: bool, **options) -> None:  # type: ignore[no-untyped-def]  # noqa: A002
        if list:
            self._list(email, org)
            return
        if not (email and org and role):
            raise CommandError("--email, --org and --role are required (or use --list).")
        role = role.upper()
        space = space.upper() if space else None

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise CommandError(f"No user with email {email}.")
        organization = self._get_org(org)

        with transaction.atomic():
            if space:
                self._set_space_role(user, organization, space, role)
            else:
                self._set_org_role(user, organization, role)

    def _get_org(self, value: str) -> Organization:
        lookup = {"pk": int(value)} if value.isdigit() else {"slug": value}
        organization = Organization.objects.filter(**lookup).first()
        if organization is None:
            raise CommandError(f"No organization matching {value!r}.")
        return organization

    def _set_org_role(self, user: User, organization: Organization, role: str) -> None:
        if role not in OrgRole.values:
            raise CommandError(f"Org role must be one of {', '.join(OrgRole.values)}.")
        membership = OrgMembership.objects.filter(user=user, organization=organization).first()
        if membership is None:
            OrgMembership.objects.create(user=user, organization=organization, role=role)
        else:
            change_org_role(membership, role)
        self.stdout.write(self.style.SUCCESS(f"{user.email} is now {role} of {organization.slug}."))

    def _set_space_role(self, user: User, organization: Organization, code: str, role: str) -> None:
        if role not in SpaceRole.values:
            raise CommandError(f"Space role must be one of {', '.join(SpaceRole.values)}.")
        space_obj = Space.objects.filter(organization=organization, short_code=code).first()
        if space_obj is None:
            raise CommandError(f"No space {code!r} in {organization.slug}.")
        OrgMembership.objects.get_or_create(
            user=user,
            organization=organization,
            defaults={"role": OrgRole.GUEST if role == SpaceRole.GUEST else OrgRole.MEMBER},
        )
        membership = set_space_membership(user=user, space=space_obj, role=role)
        self.stdout.write(
            self.style.SUCCESS(f"{user.email} is now {membership.role} of space {code} in {organization.slug}.")
        )

    def _list(self, email: str | None, org: str | None) -> None:
        org_memberships = OrgMembership.objects.select_related("user", "organization")
        space_memberships = SpaceMembership.objects.select_related("user", "space__organization")
        if email:
            org_memberships = org_memberships.filter(user__email__iexact=email)
            space_memberships = space_memberships.filter(user__email__iexact=email)
        if org:
            organization = self._get_org(org)
            org_memberships = org_memberships.filter(organization=organization)
            space_memberships = space_memberships.filter(space__organization=organization)

        rows = [(m.user.email, m.organization.slug, "-", m.role) for m in org_memberships]
        rows += [(m.user.email, m.space.organization.slug, m.space.short_code, m.role) for m in space_memberships]
        if not rows:
            self.stdout.write("No memberships found.")
            return
        rows.sort()
        self.stdout.write(f"{'EMAIL':40} {'ORG':25} {'SPACE':8} ROLE")
        for user_email, org_slug, code, member_role in rows:
            self.stdout.write(f"{user_email:40} {org_slug:25} {code:8} {member_role}")
