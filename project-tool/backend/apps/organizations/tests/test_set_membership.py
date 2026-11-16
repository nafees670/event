import pytest
from django.core.management import CommandError, call_command

from apps.core.tests.factories import UserFactory, add_space
from apps.organizations.models import OrgMembership, OrgRole
from apps.spaces.models import SpaceMembership, SpaceRole

pytestmark = pytest.mark.django_db


def test_set_org_role(org_with_admin):
    org, _ = org_with_admin
    user = UserFactory()
    call_command("set_membership", email=user.email, org=org.slug, role="admin")
    assert OrgMembership.objects.get(user=user, organization=org).role == OrgRole.ADMIN


def test_set_space_role_adds_org_membership(org_with_admin):
    org, _ = org_with_admin
    add_space(org, "DEV")
    user = UserFactory()
    call_command("set_membership", email=user.email, org=str(org.id), space="dev", role="MANAGER")
    assert OrgMembership.objects.get(user=user, organization=org).role == OrgRole.MEMBER
    assert SpaceMembership.objects.get(user=user, space__short_code="DEV").role == SpaceRole.MANAGER


def test_list(org_with_admin, capsys):
    org, admin = org_with_admin
    call_command("set_membership", list=True, org=org.slug)
    out = capsys.readouterr().out
    assert admin.email in out and "GEN" in out and "ADMIN" in out


def test_errors(org_with_admin):
    org, _ = org_with_admin
    with pytest.raises(CommandError, match="No user"):
        call_command("set_membership", email="ghost@example.test", org=org.slug, role="ADMIN")
    with pytest.raises(CommandError, match="Org role"):
        call_command("set_membership", email=UserFactory().email, org=org.slug, role="MANAGER")
    with pytest.raises(CommandError, match="No space"):
        call_command("set_membership", email=UserFactory().email, org=org.slug, space="NOPE", role="EMPLOYEE")
