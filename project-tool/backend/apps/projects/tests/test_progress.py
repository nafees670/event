import pytest
from django.core.cache import cache

from apps.core.tests.factories import add_member, add_project, add_space, add_space_member, add_task, state_named
from apps.projects import progress
from apps.projects.models import Milestone, MilestoneStatus
from apps.spaces.models import SpaceRole
from apps.tasks.models import ActivityLog

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(org_with_admin):
    org, admin = org_with_admin
    space = add_space(org, "DEV")
    manager, employee = add_member(org), add_member(org)
    add_space_member(space, manager, SpaceRole.MANAGER)
    add_space_member(space, employee, SpaceRole.EMPLOYEE)
    project = add_project(space, "QORE")
    return {
        "org": org,
        "admin": admin,
        "manager": manager,
        "employee": employee,
        "space": space,
        "project": project,
        "todo": state_named(space, "To Do"),
        "doing": state_named(space, "In Progress"),
        "done": state_named(space, "Completed"),
        "cancelled": state_named(space, "Cancelled"),
    }


def project_progress(setup) -> float:  # type: ignore[no-untyped-def]
    return progress.progress_for([setup["project"].pk])[setup["project"].pk]["progress"]


def ms_url(setup, milestone, action=""):  # type: ignore[no-untyped-def]
    base = f"/api/orgs/{setup['org'].id}/projects/{setup['project'].id}/milestones/{milestone.id}/"
    return f"{base}{action}/" if action else base


class TestFormula:
    def test_no_milestones_or_tasks_is_zero(self, setup):
        assert project_progress(setup) == 0.0
        Milestone.objects.create(project=setup["project"], name="Empty", weight=50)
        assert project_progress(setup) == 0.0

    def test_partial_credit_per_milestone(self, setup):
        a = Milestone.objects.create(project=setup["project"], name="A", weight=40)
        b = Milestone.objects.create(project=setup["project"], name="B", weight=60)
        for state in ("done", "done", "done", "todo"):  # A: 3/4
            add_task(setup["project"], setup["admin"], milestone=a, state=setup[state])
        add_task(setup["project"], setup["admin"], milestone=b, state=setup["done"])  # B: 1/2
        add_task(setup["project"], setup["admin"], milestone=b, state=setup["doing"])
        # 40 * 0.75 + 60 * 0.5
        assert project_progress(setup) == 60.0
        assert progress.progress_for([setup["project"].pk])[setup["project"].pk]["milestones"] == {a.pk: 75.0, b.pk: 50.0}

    def test_cancelled_tasks_are_ignored(self, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=100)
        add_task(setup["project"], setup["admin"], milestone=m, state=setup["done"])
        add_task(setup["project"], setup["admin"], milestone=m, state=setup["cancelled"])
        assert project_progress(setup) == 100.0

    def test_weights_below_100_cap_progress(self, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=70)
        add_task(setup["project"], setup["admin"], milestone=m, state=setup["done"])
        assert project_progress(setup) == 70.0

    def test_tasks_without_milestone_do_not_count(self, setup):
        Milestone.objects.create(project=setup["project"], name="M", weight=100)
        add_task(setup["project"], setup["admin"], state=setup["done"])
        assert project_progress(setup) == 0.0


class TestAutomaticStatus:
    def test_status_follows_tasks_and_reopens(self, make_client, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=100)
        a = add_task(setup["project"], setup["admin"], milestone=m)
        b = add_task(setup["project"], setup["admin"], milestone=m)
        m.refresh_from_db()
        assert m.status == MilestoneStatus.NOT_STARTED

        client = make_client(setup["admin"])
        url = f"/api/orgs/{setup['org'].id}/tasks/"
        client.post(f"{url}{a.id}/move/", {"state_id": setup["doing"].id}, format="json")
        m.refresh_from_db()
        assert m.status == MilestoneStatus.IN_PROGRESS

        client.post(f"{url}{a.id}/move/", {"state_id": setup["done"].id}, format="json")
        client.patch(f"{url}{b.id}/", {"state_id": setup["done"].id}, format="json")
        m.refresh_from_db()
        assert m.status == MilestoneStatus.COMPLETED

        client.post(f"{url}{b.id}/move/", {"state_id": setup["todo"].id}, format="json")
        m.refresh_from_db()
        assert m.status == MilestoneStatus.IN_PROGRESS
        changes = list(ActivityLog.objects.filter(milestone=m).values_list("new_value", flat=True))
        assert changes[0] == "In progress" and "Completed" in changes

    def test_moving_task_between_milestones_updates_both(self, make_client, setup):
        first = Milestone.objects.create(project=setup["project"], name="First", weight=50)
        second = Milestone.objects.create(project=setup["project"], name="Second", weight=50)
        task = add_task(setup["project"], setup["admin"], milestone=first, state=setup["done"])
        first.refresh_from_db()
        assert first.status == MilestoneStatus.COMPLETED

        make_client(setup["admin"]).patch(
            f"/api/orgs/{setup['org'].id}/tasks/{task.id}/", {"milestone_id": second.id}, format="json"
        )
        first.refresh_from_db()
        second.refresh_from_db()
        assert first.status == MilestoneStatus.NOT_STARTED and second.status == MilestoneStatus.COMPLETED

    def test_deleting_last_open_task_completes_milestone(self, make_client, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=100)
        add_task(setup["project"], setup["admin"], milestone=m, state=setup["done"])
        open_task = add_task(setup["project"], setup["admin"], milestone=m)
        make_client(setup["admin"]).delete(f"/api/orgs/{setup['org'].id}/tasks/{open_task.id}/")
        m.refresh_from_db()
        assert m.status == MilestoneStatus.COMPLETED

    def test_changing_a_state_category_recomputes(self, make_client, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=100)
        add_task(setup["project"], setup["admin"], milestone=m, state=setup["doing"])
        assert project_progress(setup) == 0.0
        make_client(setup["manager"]).patch(
            f"/api/orgs/{setup['org'].id}/spaces/{setup['space'].id}/states/{setup['doing'].id}/",
            {"category": "COMPLETED"},
            format="json",
        )
        m.refresh_from_db()
        assert m.status == MilestoneStatus.COMPLETED and project_progress(setup) == 100.0


class TestOverride:
    def test_override_pins_status_until_reset(self, make_client, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=100)
        task = add_task(setup["project"], setup["admin"], milestone=m)
        client = make_client(setup["manager"])

        response = client.post(ms_url(setup, m, "override"), {"status": "COMPLETED"}, format="json")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "COMPLETED" and body["status_overridden"] is True
        assert body["overridden_by"]["id"] == setup["manager"].id

        # Automation leaves a pinned milestone alone.
        make_client(setup["admin"]).post(
            f"/api/orgs/{setup['org'].id}/tasks/{task.id}/move/", {"state_id": setup["doing"].id}, format="json"
        )
        m.refresh_from_db()
        assert m.status == MilestoneStatus.COMPLETED

        response = client.post(ms_url(setup, m, "reset-status"))
        assert response.json()["status"] == "IN_PROGRESS" and response.json()["status_overridden"] is False
        assert ActivityLog.objects.filter(milestone=m, field="milestone_status", new_value="Automatic").exists()

    def test_employee_cannot_override(self, make_client, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=100)
        response = make_client(setup["employee"]).post(ms_url(setup, m, "override"), {"status": "COMPLETED"}, format="json")
        assert response.status_code == 403

    def test_override_does_not_change_progress(self, make_client, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=100)
        add_task(setup["project"], setup["admin"], milestone=m)
        make_client(setup["manager"]).post(ms_url(setup, m, "override"), {"status": "COMPLETED"}, format="json")
        assert project_progress(setup) == 0.0


class TestApiAndCache:
    def test_project_and_milestone_progress_in_api(self, make_client, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=80)
        add_task(setup["project"], setup["admin"], milestone=m, state=setup["done"])
        add_task(setup["project"], setup["admin"], milestone=m)
        client = make_client(setup["employee"])
        project = client.get(f"/api/orgs/{setup['org'].id}/projects/{setup['project'].id}/").json()
        assert project["progress"] == 40.0
        milestone = client.get(ms_url(setup, m)).json()
        assert milestone["progress"] == 50.0

    def test_cache_is_used_and_invalidated(self, make_client, setup, django_assert_num_queries):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=100)
        task = add_task(setup["project"], setup["admin"], milestone=m)
        cache.clear()
        progress.progress_for([setup["project"].pk])
        with django_assert_num_queries(0):
            progress.progress_for([setup["project"].pk])

        make_client(setup["admin"]).post(
            f"/api/orgs/{setup['org'].id}/tasks/{task.id}/move/", {"state_id": setup["done"].id}, format="json"
        )
        assert project_progress(setup) == 100.0

    def test_weight_change_invalidates(self, make_client, setup):
        m = Milestone.objects.create(project=setup["project"], name="M", weight=50)
        add_task(setup["project"], setup["admin"], milestone=m, state=setup["done"])
        assert project_progress(setup) == 50.0
        make_client(setup["manager"]).patch(ms_url(setup, m), {"weight": 90}, format="json")
        assert project_progress(setup) == 90.0
