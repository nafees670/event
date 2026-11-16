from datetime import timedelta

import pytest
from django.utils import timezone

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
from apps.organizations.models import OrgRole
from apps.projects.models import Milestone
from apps.spaces.models import SpaceRole
from apps.tasks.models import Task

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(org_with_admin):
    org, admin = org_with_admin
    dev, mkt = add_space(org, "DEV"), add_space(org, "MKT")
    manager, employee, marketer = add_member(org), add_member(org), add_member(org)
    add_space_member(dev, manager, SpaceRole.MANAGER)
    add_space_member(dev, employee, SpaceRole.EMPLOYEE)
    add_space_member(mkt, marketer, SpaceRole.MANAGER)
    qore = add_project(dev, "QORE")
    velo = add_project(mkt, "VELO")
    today = timezone.localdate()

    m = Milestone.objects.create(project=qore, name="M", weight=100)
    add_task(qore, admin, milestone=m, state=state_named(dev, "Completed"), assignees=[employee])
    add_task(qore, admin, milestone=m, state=state_named(dev, "In Progress"), assignees=[employee], due_date=today - timedelta(days=2))
    add_task(qore, admin, milestone=m, assignees=[employee, manager], priority="URGENT", due_date=today + timedelta(days=3))
    add_task(qore, admin, state=state_named(dev, "Cancelled"))
    add_task(velo, admin, state=state_named(mkt, "Completed"), assignees=[marketer])
    return {"org": org, "admin": admin, "manager": manager, "employee": employee, "marketer": marketer, "dev": dev, "mkt": mkt}


def url(setup, space=None):  # type: ignore[no-untyped-def]
    base = f"/api/orgs/{setup['org'].id}/analytics/"
    return f"{base}?space={space.id}" if space else base


class TestSpaceAnalytics:
    def test_numbers(self, make_client, setup):
        response = make_client(setup["manager"]).get(url(setup, setup["dev"]))
        assert response.status_code == 200
        data = response.json()
        assert data["kpis"] == {
            "total": 3,
            "open": 2,
            "in_progress": 1,
            "completed": 1,
            "overdue": 1,
            "due_this_week": 1,
            "completed_last_7_days": 1,
        }
        statuses = {row["category"]: row["count"] for row in data["status_distribution"]}
        assert statuses["COMPLETED"] == 1 and statuses["CANCELLED"] == 1 and statuses["UNSTARTED"] == 1
        assert {row["priority"]: row["count"] for row in data["priority_distribution"]}["URGENT"] == 1
        assert [(p["short_code"], p["progress"]) for p in data["projects"]] == [("QORE", 33.3)]
        assert "spaces" not in data

    def test_velocity_has_eight_weeks_with_this_week_last(self, make_client, setup):
        old = Task.objects.get(state__category="COMPLETED", space=setup["dev"])
        Task.objects.filter(pk=old.pk).update(completed_at=timezone.now() - timedelta(weeks=3))
        weeks = make_client(setup["manager"]).get(url(setup, setup["dev"])).json()["velocity"]
        assert len(weeks) == 8
        assert sum(w["completed"] for w in weeks) == 1
        assert weeks[-1]["completed"] == 0 and weeks[-4]["completed"] == 1

    def test_workload(self, make_client, setup):
        rows = make_client(setup["manager"]).get(url(setup, setup["dev"])).json()["workload"]
        by_id = {row["user"]["id"]: row for row in rows}
        employee = by_id[setup["employee"].id]
        assert (employee["open"], employee["in_progress"], employee["overdue"], employee["completed_last_30_days"]) == (2, 1, 1, 1)
        assert employee["utilization"] == 25  # 2 open of a capacity of 8
        assert by_id[setup["manager"].id]["open"] == 1
        # Space participants only: the marketer is not part of DEV.
        assert setup["marketer"].id not in by_id
        assert rows[0]["user"]["id"] == setup["employee"].id

    def test_employee_and_other_space_manager_are_denied(self, make_client, setup):
        assert make_client(setup["employee"]).get(url(setup, setup["dev"])).status_code == 403
        assert make_client(setup["marketer"]).get(url(setup, setup["dev"])).status_code == 404


class TestCompanyAnalytics:
    def test_admin_sees_every_space(self, make_client, setup):
        data = make_client(setup["admin"]).get(url(setup)).json()
        assert data["kpis"]["completed"] == 2
        spaces = {row["short_code"]: row for row in data["spaces"]}
        assert spaces["DEV"]["open_tasks"] == 2 and spaces["DEV"]["average_progress"] == 33.3
        assert spaces["MKT"]["completed_tasks"] == 1
        assert {p["short_code"] for p in data["projects"]} == {"QORE", "VELO"}
        assert setup["marketer"].id in {row["user"]["id"] for row in data["workload"]}

    def test_guests_are_left_out_of_workload(self, make_client, setup):
        guest = add_member(setup["org"], role=OrgRole.GUEST)
        ids = {row["user"]["id"] for row in make_client(setup["admin"]).get(url(setup)).json()["workload"]}
        assert guest.id not in ids

    def test_only_admins(self, make_client, setup):
        assert make_client(setup["manager"]).get(url(setup)).status_code == 403

    def test_other_org_gets_404(self, make_client, setup):
        stranger = UserFactory()
        OrganizationFactory(created_by=stranger)
        assert make_client(stranger).get(url(setup)).status_code == 404
