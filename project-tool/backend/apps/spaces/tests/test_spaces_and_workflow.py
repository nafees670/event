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
from apps.spaces.models import Space, SpaceRole, StateCategory, WorkflowState
from apps.tasks.models import Task

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(org_with_admin):
    org, admin = org_with_admin
    space = add_space(org, "DEV")
    manager = add_member(org)
    add_space_member(space, manager, SpaceRole.MANAGER)
    employee = add_member(org)
    add_space_member(space, employee, SpaceRole.EMPLOYEE)
    return {"org": org, "admin": admin, "space": space, "manager": manager, "employee": employee}


def spaces_url(org, *parts):  # type: ignore[no-untyped-def]
    tail = "/".join(str(p) for p in parts)
    return f"/api/orgs/{org.id}/spaces/" + (f"{tail}/" if tail else "")


class TestTemplates:
    def test_general_space_of_new_org_has_default_workflow(self, org_with_admin):
        org, _ = org_with_admin
        general = Space.objects.get(organization=org, short_code="GEN")
        assert list(general.states.values_list("name", flat=True)) == [
            "Backlog",
            "To Do",
            "In Progress",
            "In Review",
            "Completed",
            "Cancelled",
        ]
        assert general.states.get(is_default=True).name == "To Do"

    def test_admin_creates_space_from_department_template(self, make_client, setup):
        response = make_client(setup["admin"]).post(
            spaces_url(setup["org"]),
            {"name": "Sales", "short_code": "sls", "department_type": "SALES", "color": "#10B981"},
            format="json",
        )
        assert response.status_code == 201, response.json()
        body = response.json()
        assert body["short_code"] == "SLS" and body["my_role"] == "MANAGER"
        space = Space.objects.get(pk=body["id"])
        assert state_named(space, "Won").category == StateCategory.COMPLETED
        assert state_named(space, "Lost").category == StateCategory.CANCELLED
        assert set(space.custom_fields.values_list("name", flat=True)) == {"Client", "Deal value"}

    def test_engineering_template_has_select_field(self, org_with_admin):
        org, admin = org_with_admin
        from apps.spaces.services import create_space

        space = create_space(organization=org, name="Eng", short_code="ENG", created_by=admin, department_type="ENGINEERING")
        component = space.custom_fields.get(name="Component")
        assert component.field_type == "select" and "Backend" in component.options


class TestSpacePermissions:
    def test_only_admins_create_spaces(self, make_client, setup):
        response = make_client(setup["manager"]).post(
            spaces_url(setup["org"]), {"name": "X", "short_code": "XX"}, format="json"
        )
        assert response.status_code == 403

    def test_short_code_must_be_unique(self, make_client, setup):
        response = make_client(setup["admin"]).post(
            spaces_url(setup["org"]), {"name": "Dev 2", "short_code": "dev"}, format="json"
        )
        assert response.status_code == 400
        assert response.json()["error"]["details"]["short_code"][0] == "Another space already uses this code."

    def test_manager_can_edit_but_not_change_department(self, make_client, setup):
        response = make_client(setup["manager"]).patch(
            spaces_url(setup["org"], setup["space"].id),
            {"name": "Developers", "department_type": "HR"},
            format="json",
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Developers"
        assert response.json()["department_type"] == "GENERAL"

    def test_employee_cannot_edit_space(self, make_client, setup):
        response = make_client(setup["employee"]).patch(
            spaces_url(setup["org"], setup["space"].id), {"name": "Mine"}, format="json"
        )
        assert response.status_code == 403

    def test_admin_deletes_space_with_tasks(self, make_client, setup):
        project = add_project(setup["space"], "QORE")
        add_task(project, setup["admin"])
        response = make_client(setup["admin"]).delete(spaces_url(setup["org"], setup["space"].id))
        assert response.status_code == 204
        assert not Task.objects.exists()

    def test_last_space_cannot_be_deleted(self, make_client):
        admin = UserFactory()
        org = OrganizationFactory(created_by=admin)
        general = Space.objects.get(organization=org)
        assert make_client(admin).delete(spaces_url(org, general.id)).status_code == 409

    def test_participants_include_members_and_org_admins(self, make_client, setup):
        response = make_client(setup["employee"]).get(spaces_url(setup["org"], setup["space"].id, "participants"))
        ids = {u["id"] for u in response.json()}
        assert ids == {setup["admin"].id, setup["manager"].id, setup["employee"].id}


class TestWorkflowStates:
    def url(self, setup, *parts):  # type: ignore[no-untyped-def]
        return spaces_url(setup["org"], setup["space"].id, "states", *parts)

    def test_everyone_in_the_space_can_read_states(self, make_client, setup):
        response = make_client(setup["employee"]).get(self.url(setup))
        assert response.status_code == 200
        assert [s["category"] for s in response.json()][0] == "BACKLOG"

    def test_manager_adds_state_at_the_end(self, make_client, setup):
        response = make_client(setup["manager"]).post(
            self.url(setup), {"name": "QA", "category": "REVIEW", "color": "#123456"}, format="json"
        )
        assert response.status_code == 201
        assert response.json()["order"] == 6

    def test_employee_cannot_change_workflow(self, make_client, setup):
        response = make_client(setup["employee"]).post(
            self.url(setup), {"name": "QA", "category": "REVIEW"}, format="json"
        )
        assert response.status_code == 403

    def test_duplicate_state_name_rejected(self, make_client, setup):
        response = make_client(setup["manager"]).post(
            self.url(setup), {"name": "in progress", "category": "STARTED"}, format="json"
        )
        assert response.status_code == 400

    def test_switching_default_state(self, make_client, setup):
        backlog = state_named(setup["space"], "Backlog")
        response = make_client(setup["manager"]).patch(self.url(setup, backlog.id), {"is_default": True}, format="json")
        assert response.status_code == 200
        assert list(WorkflowState.objects.filter(space=setup["space"], is_default=True)) == [backlog]

    def test_deleting_state_with_tasks_needs_target(self, make_client, setup):
        project = add_project(setup["space"])
        doing = state_named(setup["space"], "In Progress")
        task = add_task(project, setup["admin"], state=doing)
        client = make_client(setup["manager"])

        response = client.delete(self.url(setup, doing.id))
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "state_has_tasks"

        review = state_named(setup["space"], "In Review")
        assert client.delete(self.url(setup, doing.id) + f"?move_to={review.id}").status_code == 204
        task.refresh_from_db()
        assert task.state == review

    def test_deleting_default_state_promotes_another(self, make_client, setup):
        todo = state_named(setup["space"], "To Do")
        assert make_client(setup["manager"]).delete(self.url(setup, todo.id)).status_code == 204
        assert setup["space"].states.filter(is_default=True).count() == 1

    def test_reorder_requires_every_state(self, make_client, setup):
        client = make_client(setup["manager"])
        ids = list(setup["space"].states.values_list("id", flat=True))
        assert client.post(self.url(setup, "reorder"), {"ids": ids[:2]}, format="json").status_code == 400
        assert client.post(self.url(setup, "reorder"), {"ids": list(reversed(ids))}, format="json").status_code == 204
        assert list(setup["space"].states.values_list("id", flat=True)) == list(reversed(ids))


class TestCustomFields:
    def url(self, setup, *parts):  # type: ignore[no-untyped-def]
        return spaces_url(setup["org"], setup["space"].id, "fields", *parts)

    def test_select_field_needs_options(self, make_client, setup):
        client = make_client(setup["manager"])
        bad = client.post(self.url(setup), {"name": "Size", "field_type": "select", "options": []}, format="json")
        assert bad.status_code == 400
        good = client.post(
            self.url(setup), {"name": "Size", "field_type": "select", "options": ["S", "M", " "]}, format="json"
        )
        assert good.status_code == 201
        assert good.json()["options"] == ["S", "M"]

    def test_field_type_is_fixed_after_creation(self, make_client, setup):
        client = make_client(setup["manager"])
        field_id = client.post(self.url(setup), {"name": "Points", "field_type": "number"}, format="json").json()["id"]
        response = client.patch(self.url(setup, field_id), {"field_type": "text"}, format="json")
        assert response.status_code == 200 and response.json()["field_type"] == "number"
