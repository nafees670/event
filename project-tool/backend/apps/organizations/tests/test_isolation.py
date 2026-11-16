"""Security regression tests: users must never reach another tenant's data by guessing IDs."""

import pytest

from apps.core.tests.factories import OrganizationFactory, UserFactory, add_member, add_space, add_space_member
from apps.organizations.models import Invitation, OrgMembership, OrgRole
from apps.spaces.models import SpaceMembership, SpaceRole

pytestmark = pytest.mark.django_db


@pytest.fixture
def two_orgs(org_with_admin):
    """Org A (with an admin) and org B with its own admin, member, space and invitation."""
    org_a, admin_a = org_with_admin
    admin_b = UserFactory()
    org_b = OrganizationFactory(created_by=admin_b)
    member_b = add_member(org_b)
    space_b = add_space(org_b, "SEC")
    add_space_member(space_b, member_b)
    invitation_b = Invitation.objects.create(
        organization=org_b,
        email="pending@example.test",
        token_hash="x" * 64,
        expires_at="2999-01-01T00:00:00Z",
    )
    return {
        "org_a": org_a,
        "admin_a": admin_a,
        "org_b": org_b,
        "member_b": member_b,
        "space_b": space_b,
        "membership_b": OrgMembership.objects.get(user=member_b, organization=org_b),
        "invitation_b": invitation_b,
    }


class TestCrossOrganization:
    def test_org_list_only_shows_own_orgs(self, make_client, two_orgs):
        ids = [o["id"] for o in make_client(two_orgs["admin_a"]).get("/api/orgs/").json()]
        assert ids == [two_orgs["org_a"].id]

    @pytest.mark.parametrize(
        "path",
        [
            "/api/orgs/{org}/",
            "/api/orgs/{org}/members/",
            "/api/orgs/{org}/members/{membership}/",
            "/api/orgs/{org}/invitations/",
            "/api/orgs/{org}/spaces/",
            "/api/orgs/{org}/spaces/{space}/",
            "/api/orgs/{org}/spaces/{space}/members/",
        ],
    )
    def test_admin_of_other_org_gets_404_on_read(self, make_client, two_orgs, path):
        url = path.format(org=two_orgs["org_b"].id, membership=two_orgs["membership_b"].id, space=two_orgs["space_b"].id)
        assert make_client(two_orgs["admin_a"]).get(url).status_code == 404

    def test_admin_of_other_org_cannot_modify(self, make_client, two_orgs):
        client = make_client(two_orgs["admin_a"])
        org_b = two_orgs["org_b"]
        membership_b = two_orgs["membership_b"]

        assert client.patch(f"/api/orgs/{org_b.id}/", {"name": "pwned"}, format="json").status_code == 404
        assert client.patch(f"/api/orgs/{org_b.id}/members/{membership_b.id}/", {"role": "GUEST"}, format="json").status_code == 404
        assert client.delete(f"/api/orgs/{org_b.id}/members/{membership_b.id}/").status_code == 404
        assert client.post(f"/api/orgs/{org_b.id}/invitations/", {"email": "evil@example.test", "role": "ADMIN"}, format="json").status_code == 404
        assert client.delete(f"/api/orgs/{org_b.id}/invitations/{two_orgs['invitation_b'].id}/").status_code == 404
        assert client.post(
            f"/api/orgs/{org_b.id}/spaces/{two_orgs['space_b'].id}/members/",
            {"user_id": two_orgs["admin_a"].id, "role": "MANAGER"},
            format="json",
        ).status_code == 404

        org_b.refresh_from_db()
        membership_b.refresh_from_db()
        assert org_b.name != "pwned" and membership_b.role == OrgRole.MEMBER
        assert not OrgMembership.objects.filter(user=two_orgs["admin_a"], organization=org_b).exists()

    def test_ids_from_other_org_are_not_reachable_through_own_org(self, make_client, two_orgs):
        """Mixing a valid own org id with another org's object id must not leak or modify anything."""
        client = make_client(two_orgs["admin_a"])
        org_a = two_orgs["org_a"]
        assert client.get(f"/api/orgs/{org_a.id}/members/{two_orgs['membership_b'].id}/").status_code == 404
        assert client.patch(f"/api/orgs/{org_a.id}/members/{two_orgs['membership_b'].id}/", {"role": "GUEST"}, format="json").status_code == 404
        assert client.delete(f"/api/orgs/{org_a.id}/invitations/{two_orgs['invitation_b'].id}/").status_code == 404
        assert client.get(f"/api/orgs/{org_a.id}/spaces/{two_orgs['space_b'].id}/").status_code == 404
        assert client.get(f"/api/orgs/{org_a.id}/spaces/{two_orgs['space_b'].id}/members/").status_code == 404

    def test_cannot_invite_into_other_orgs_space(self, make_client, two_orgs):
        org_a = two_orgs["org_a"]
        response = make_client(two_orgs["admin_a"]).post(
            f"/api/orgs/{org_a.id}/invitations/",
            {"email": "x@example.test", "space": two_orgs["space_b"].id},
            format="json",
        )
        assert response.status_code == 400
        assert "space" in response.json()["error"]["details"]

    def test_cannot_add_outsider_to_space(self, make_client, two_orgs):
        org_a = two_orgs["org_a"]
        general = org_a.spaces.get(short_code="GEN")
        response = make_client(two_orgs["admin_a"]).post(
            f"/api/orgs/{org_a.id}/spaces/{general.id}/members/",
            {"user_id": two_orgs["member_b"].id},
            format="json",
        )
        assert response.json()["error"]["code"] == "not_org_member"


class TestSpaceIsolation:
    def test_member_only_sees_own_spaces(self, make_client, org_with_admin):
        org, _ = org_with_admin
        member = add_member(org)
        dev = add_space(org, "DEV")
        hr = add_space(org, "HR")
        add_space_member(dev, member)
        client = make_client(member)

        codes = [s["short_code"] for s in client.get(f"/api/orgs/{org.id}/spaces/").json()]
        assert codes == ["DEV"]
        assert client.get(f"/api/orgs/{org.id}/spaces/{hr.id}/").status_code == 404
        assert client.get(f"/api/orgs/{org.id}/spaces/{hr.id}/members/").status_code == 404

    def test_admin_sees_all_spaces(self, make_client, org_with_admin):
        org, admin = org_with_admin
        add_space(org, "DEV")
        add_space(org, "HR")
        codes = sorted(s["short_code"] for s in make_client(admin).get(f"/api/orgs/{org.id}/spaces/").json())
        assert codes == ["DEV", "GEN", "HR"]

    def test_member_without_space_gets_clear_error(self, make_client, org_with_admin):
        org, _ = org_with_admin
        response = make_client(add_member(org)).get(f"/api/orgs/{org.id}/spaces/")
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "no_space_assigned"
        assert "not assigned to a space" in response.json()["error"]["message"]

    def test_space_membership_management_permissions(self, make_client, org_with_admin):
        org, _ = org_with_admin
        dev = add_space(org, "DEV")
        manager, employee, newcomer = add_member(org), add_member(org), add_member(org)
        add_space_member(dev, manager, SpaceRole.MANAGER)
        add_space_member(dev, employee, SpaceRole.EMPLOYEE)
        url = f"/api/orgs/{org.id}/spaces/{dev.id}/members/"

        assert make_client(employee).post(url, {"user_id": newcomer.id}, format="json").status_code == 403
        assert make_client(employee).get(url).status_code == 200
        assert make_client(manager).post(url, {"user_id": newcomer.id, "role": "EMPLOYEE"}, format="json").status_code == 201

        membership = SpaceMembership.objects.get(user=newcomer, space=dev)
        assert make_client(employee).delete(f"{url}{membership.id}/").status_code == 403
        assert make_client(manager).patch(f"{url}{membership.id}/", {"role": "MANAGER"}, format="json").json()["role"] == "MANAGER"
        assert make_client(manager).delete(f"{url}{membership.id}/").status_code == 204

    def test_manager_of_one_space_cannot_manage_another(self, make_client, org_with_admin):
        org, _ = org_with_admin
        dev, mkt = add_space(org, "DEV"), add_space(org, "MKT")
        manager, other = add_member(org), add_member(org)
        add_space_member(dev, manager, SpaceRole.MANAGER)
        add_space_member(mkt, manager, SpaceRole.EMPLOYEE)
        response = make_client(manager).post(
            f"/api/orgs/{org.id}/spaces/{mkt.id}/members/", {"user_id": other.id}, format="json"
        )
        assert response.status_code == 403

    def test_org_guest_cannot_be_promoted_in_space(self, make_client, org_with_admin):
        org, admin = org_with_admin
        guest = add_member(org, role=OrgRole.GUEST)
        general = org.spaces.get(short_code="GEN")
        response = make_client(admin).post(
            f"/api/orgs/{org.id}/spaces/{general.id}/members/", {"user_id": guest.id, "role": "MANAGER"}, format="json"
        )
        assert response.json()["role"] == "GUEST"
