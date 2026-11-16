import re
from datetime import timedelta

import pytest
from django.core import mail
from freezegun import freeze_time

from apps.core.tests.factories import UserFactory, add_member, add_space, add_space_member
from apps.organizations.models import Invitation, OrgMembership, OrgRole
from apps.spaces.models import Space, SpaceMembership, SpaceRole

pytestmark = pytest.mark.django_db


class TestCreateOrganization:
    def test_creator_becomes_admin_and_general_space_exists(self, make_client, user):
        response = make_client(user).post("/api/orgs/", {"name": "Acme Corp"}, format="json")
        assert response.status_code == 201
        body = response.json()
        assert body["my_role"] == "ADMIN" and body["slug"] == "acme-corp" and body["member_count"] == 1

        general = Space.objects.get(organization_id=body["id"])
        assert general.name == "General" and general.short_code == "GEN"
        assert SpaceMembership.objects.get(space=general, user=user).role == SpaceRole.MANAGER

    def test_slug_is_unique(self, make_client, user):
        client = make_client(user)
        client.post("/api/orgs/", {"name": "Acme"}, format="json")
        assert client.post("/api/orgs/", {"name": "Acme"}, format="json").json()["slug"] == "acme-2"

    def test_only_admin_can_rename(self, make_client, org_with_admin):
        org, admin = org_with_admin
        member = add_member(org)
        assert make_client(member).patch(f"/api/orgs/{org.id}/", {"name": "Hacked"}, format="json").status_code == 403
        assert make_client(admin).patch(f"/api/orgs/{org.id}/", {"name": "Renamed"}, format="json").status_code == 200


class TestMembers:
    def test_admin_changes_role(self, make_client, org_with_admin):
        org, admin = org_with_admin
        member = add_member(org)
        membership = OrgMembership.objects.get(user=member, organization=org)
        response = make_client(admin).patch(f"/api/orgs/{org.id}/members/{membership.id}/", {"role": "ADMIN"}, format="json")
        assert response.status_code == 200 and response.json()["role"] == "ADMIN"

    def test_member_cannot_change_roles_or_remove(self, make_client, org_with_admin):
        org, admin = org_with_admin
        member = add_member(org)
        admin_membership = OrgMembership.objects.get(user=admin, organization=org)
        client = make_client(member)
        url = f"/api/orgs/{org.id}/members/{admin_membership.id}/"
        assert client.patch(url, {"role": "GUEST"}, format="json").status_code == 403
        assert client.delete(url).status_code == 403

    def test_last_admin_is_protected(self, make_client, org_with_admin):
        org, admin = org_with_admin
        membership = OrgMembership.objects.get(user=admin, organization=org)
        client = make_client(admin)
        url = f"/api/orgs/{org.id}/members/{membership.id}/"
        assert client.patch(url, {"role": "MEMBER"}, format="json").json()["error"]["code"] == "last_admin"
        assert client.delete(url).status_code == 409

    def test_demote_to_guest_downgrades_space_roles(self, make_client, org_with_admin):
        org, admin = org_with_admin
        member = add_member(org)
        space = add_space(org, "DEV")
        add_space_member(space, member, SpaceRole.MANAGER)
        membership = OrgMembership.objects.get(user=member, organization=org)
        make_client(admin).patch(f"/api/orgs/{org.id}/members/{membership.id}/", {"role": "GUEST"}, format="json")
        assert SpaceMembership.objects.get(user=member, space=space).role == SpaceRole.GUEST

    def test_removing_member_removes_space_memberships(self, make_client, org_with_admin):
        org, admin = org_with_admin
        member = add_member(org)
        add_space_member(add_space(org, "DEV"), member)
        membership = OrgMembership.objects.get(user=member, organization=org)
        assert make_client(admin).delete(f"/api/orgs/{org.id}/members/{membership.id}/").status_code == 204
        assert not SpaceMembership.objects.filter(user=member).exists()

    def test_member_list_shows_space_roles(self, make_client, org_with_admin):
        org, admin = org_with_admin
        response = make_client(admin).get(f"/api/orgs/{org.id}/members/")
        row = response.json()["results"][0]
        general = org.spaces.get()
        assert row["spaces"] == [
            {
                "membership_id": general.memberships.get().id,
                "space_id": general.id,
                "name": "General",
                "short_code": "GEN",
                "role": "MANAGER",
            }
        ]


def _invite_token() -> str:
    return re.search(r"/invite/(\S+)", mail.outbox[-1].body).group(1)


class TestInvitations:
    def test_admin_invites_and_invitee_accepts_into_space(self, make_client, org_with_admin):
        org, admin = org_with_admin
        space = add_space(org, "DEV")
        response = make_client(admin).post(
            f"/api/orgs/{org.id}/invitations/",
            {"email": "Invitee@Example.test", "role": "MEMBER", "space": space.id, "space_role": "EMPLOYEE"},
            format="json",
        )
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "PENDING" and body["invite_url"].endswith(_invite_token())
        token = _invite_token()
        assert Invitation.objects.get().token_hash != token  # only the hash is stored

        public = make_client(UserFactory()).get(f"/api/invitations/{token}/").json()
        assert public["organization_name"] == org.name and public["email"] == "invitee@example.test"

        invitee = UserFactory(email="invitee@example.test")
        response = make_client(invitee).post(f"/api/invitations/{token}/accept/")
        assert response.status_code == 200 and response.json()["my_role"] == "MEMBER"
        assert response.json()["member_count"] == 2
        assert SpaceMembership.objects.get(user=invitee, space=space).role == SpaceRole.EMPLOYEE
        assert make_client(invitee).post(f"/api/invitations/{token}/accept/").json()["error"]["code"] == "invitation_accepted"

    def test_email_mismatch_is_rejected(self, make_client, org_with_admin):
        org, admin = org_with_admin
        make_client(admin).post(f"/api/orgs/{org.id}/invitations/", {"email": "a@example.test"}, format="json")
        response = make_client(UserFactory(email="b@example.test")).post(f"/api/invitations/{_invite_token()}/accept/")
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "invitation_email_mismatch"
        assert not OrgMembership.objects.filter(user__email="b@example.test").exists()

    def test_expired_invitation(self, make_client, org_with_admin, settings):
        org, admin = org_with_admin
        make_client(admin).post(f"/api/orgs/{org.id}/invitations/", {"email": "a@example.test"}, format="json")
        token = _invite_token()
        invitee = UserFactory(email="a@example.test")
        with freeze_time(timedelta(hours=settings.INVITATION_EXPIRY_HOURS + 1)):
            response = make_client(invitee).post(f"/api/invitations/{token}/accept/")
        assert response.json()["error"]["code"] == "invitation_expired"

    def test_revoked_and_resent(self, make_client, org_with_admin):
        org, admin = org_with_admin
        client = make_client(admin)
        invitation_id = client.post(f"/api/orgs/{org.id}/invitations/", {"email": "a@example.test"}, format="json").json()["id"]
        old_token = _invite_token()
        assert client.delete(f"/api/orgs/{org.id}/invitations/{invitation_id}/").status_code == 204
        invitee = UserFactory(email="a@example.test")
        assert make_client(invitee).post(f"/api/invitations/{old_token}/accept/").json()["error"]["code"] == "invitation_revoked"

        assert client.post(f"/api/orgs/{org.id}/invitations/{invitation_id}/resend/").status_code == 200
        new_token = _invite_token()
        assert new_token != old_token
        assert make_client(invitee).get(f"/api/invitations/{old_token}/").status_code == 404
        assert make_client(invitee).post(f"/api/invitations/{new_token}/accept/").status_code == 200

    def test_guest_invite_forces_guest_space_role(self, make_client, org_with_admin):
        org, admin = org_with_admin
        space = add_space(org, "DEV")
        make_client(admin).post(
            f"/api/orgs/{org.id}/invitations/",
            {"email": "g@example.test", "role": "GUEST", "space": space.id, "space_role": "MANAGER"},
            format="json",
        )
        guest = UserFactory(email="g@example.test")
        make_client(guest).post(f"/api/invitations/{_invite_token()}/accept/")
        assert SpaceMembership.objects.get(user=guest).role == SpaceRole.GUEST

    def test_cannot_invite_existing_member(self, make_client, org_with_admin):
        org, admin = org_with_admin
        response = make_client(admin).post(f"/api/orgs/{org.id}/invitations/", {"email": admin.email}, format="json")
        assert response.json()["error"]["code"] == "already_member"

    def test_non_admin_cannot_invite_or_list(self, make_client, org_with_admin):
        org, _ = org_with_admin
        client = make_client(add_member(org))
        assert client.post(f"/api/orgs/{org.id}/invitations/", {"email": "x@example.test"}, format="json").status_code == 403
        assert client.get(f"/api/orgs/{org.id}/invitations/").status_code == 403

    def test_unknown_token(self, api_client):
        assert api_client.get("/api/invitations/not-a-real-token/").status_code == 404
