import pytest

from apps.core.tests.factories import (
    OrganizationFactory,
    UserFactory,
    add_member,
    add_project,
    add_space,
    add_space_member,
    add_task,
    state_named,
)
from apps.projects.models import Milestone
from apps.spaces.models import SpaceRole

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(org_with_admin):
    org, admin = org_with_admin
    space = add_space(org, "DEV")
    manager = add_member(org)
    add_space_member(space, manager, SpaceRole.MANAGER)
    employee = add_member(org)
    add_space_member(space, employee, SpaceRole.EMPLOYEE)
    outsider = add_member(org)
    add_space_member(add_space(org, "MKT"), outsider, SpaceRole.MANAGER)
    return {
        "org": org,
        "admin": admin,
        "space": space,
        "manager": manager,
        "employee": employee,
        "outsider": outsider,
    }


def projects_url(org, *parts):  # type: ignore[no-untyped-def]
    tail = "/".join(str(p) for p in parts)
    return f"/api/orgs/{org.id}/projects/" + (f"{tail}/" if tail else "")


class TestProjects:
    def test_manager_creates_project(self, make_client, setup):
        response = make_client(setup["manager"]).post(
            projects_url(setup["org"]),
            {"space": setup["space"].id, "name": "Qore", "short_code": "qore", "lead_id": setup["employee"].id},
            format="json",
        )
        assert response.status_code == 201, response.json()
        body = response.json()
        assert body["short_code"] == "QORE" and body["lead"]["id"] == setup["employee"].id
        assert body["can_manage"] is True and body["space_code"] == "DEV"

    def test_employee_cannot_create_project(self, make_client, setup):
        response = make_client(setup["employee"]).post(
            projects_url(setup["org"]), {"space": setup["space"].id, "name": "X", "short_code": "XX"}, format="json"
        )
        assert response.status_code == 403

    def test_cannot_create_in_invisible_space(self, make_client, setup):
        response = make_client(setup["outsider"]).post(
            projects_url(setup["org"]), {"space": setup["space"].id, "name": "X", "short_code": "XX"}, format="json"
        )
        assert response.status_code == 400
        assert "space" in response.json()["error"]["details"]

    def test_short_code_unique_in_org(self, make_client, setup):
        add_project(setup["space"], "QORE")
        response = make_client(setup["admin"]).post(
            projects_url(setup["org"]), {"space": setup["space"].id, "name": "Q2", "short_code": "QORE"}, format="json"
        )
        assert response.status_code == 400

    def test_lead_must_be_in_space(self, make_client, setup):
        response = make_client(setup["manager"]).post(
            projects_url(setup["org"]),
            {"space": setup["space"].id, "name": "X", "short_code": "XX", "lead_id": setup["outsider"].id},
            format="json",
        )
        assert response.status_code == 400
        assert "lead_id" in response.json()["error"]["details"]

    def test_list_only_shows_visible_spaces_and_counts(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        add_task(project, setup["admin"])
        add_task(project, setup["admin"], state=state_named(setup["space"], "Completed"))
        add_task(project, setup["admin"], state=state_named(setup["space"], "Cancelled"))
        Milestone.objects.create(project=project, name="M1", weight=40)
        Milestone.objects.create(project=project, name="M2", weight=35)

        rows = make_client(setup["employee"]).get(projects_url(setup["org"])).json()["results"]
        assert [r["short_code"] for r in rows] == ["QORE"]
        assert rows[0]["task_count"] == 2 and rows[0]["completed_task_count"] == 1
        assert rows[0]["milestone_weight_total"] == 75 and rows[0]["can_manage"] is False
        assert make_client(setup["outsider"]).get(projects_url(setup["org"])).json()["results"] == []

    def test_space_cannot_change_after_creation(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        other = add_space(setup["org"], "OPS")
        response = make_client(setup["admin"]).patch(
            projects_url(setup["org"], project.id), {"space": other.id, "name": "Renamed"}, format="json"
        )
        assert response.status_code == 200
        project.refresh_from_db()
        assert project.space == setup["space"] and project.name == "Renamed"

    def test_employee_cannot_edit_or_delete(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        client = make_client(setup["employee"])
        assert client.patch(projects_url(setup["org"], project.id), {"name": "x"}, format="json").status_code == 403
        assert client.delete(projects_url(setup["org"], project.id)).status_code == 403

    def test_other_org_gets_404(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        stranger = UserFactory()
        OrganizationFactory(created_by=stranger)
        client = make_client(stranger)
        assert client.get(projects_url(setup["org"], project.id)).status_code == 404
        assert client.get(projects_url(setup["org"], project.id, "milestones")).status_code == 404


class TestMilestones:
    def url(self, setup, project, *parts):  # type: ignore[no-untyped-def]
        return projects_url(setup["org"], project.id, "milestones", *parts)

    def test_weights_cannot_exceed_100(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        client = make_client(setup["manager"])
        assert client.post(self.url(setup, project), {"name": "Design", "weight": 60}, format="json").status_code == 201
        response = client.post(self.url(setup, project), {"name": "Build", "weight": 50}, format="json")
        assert response.status_code == 400
        error = response.json()["error"]
        assert error["code"] == "weight_over_limit" and error["details"]["available"] == 40
        assert client.post(self.url(setup, project), {"name": "Build", "weight": 40}, format="json").status_code == 201

    def test_updating_own_weight_is_not_double_counted(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        milestone = Milestone.objects.create(project=project, name="All", weight=100)
        response = make_client(setup["manager"]).patch(self.url(setup, project, milestone.id), {"weight": 90}, format="json")
        assert response.status_code == 200 and response.json()["weight"] == 90

    def test_status_is_read_only(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        milestone = Milestone.objects.create(project=project, name="M", weight=10)
        make_client(setup["manager"]).patch(self.url(setup, project, milestone.id), {"status": "COMPLETED"}, format="json")
        milestone.refresh_from_db()
        assert milestone.status == "NOT_STARTED"

    def test_employee_reads_but_cannot_write(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        client = make_client(setup["employee"])
        assert client.get(self.url(setup, project)).status_code == 200
        assert client.post(self.url(setup, project), {"name": "M", "weight": 5}, format="json").status_code == 403

    def test_milestone_task_counts(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        milestone = Milestone.objects.create(project=project, name="M", weight=10)
        add_task(project, setup["admin"], milestone=milestone)
        add_task(project, setup["admin"], milestone=milestone, state=state_named(setup["space"], "Completed"))
        row = make_client(setup["employee"]).get(self.url(setup, project)).json()[0]
        assert row["task_count"] == 2 and row["completed_task_count"] == 1
