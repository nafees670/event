from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
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
from apps.spaces.models import CustomFieldDefinition, SpaceRole
from apps.tasks.models import ActivityLog, Tag, Task

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(org_with_admin):
    org, admin = org_with_admin
    space = add_space(org, "DEV")
    manager, employee, colleague = add_member(org), add_member(org), add_member(org)
    guest = add_member(org, role=OrgRole.GUEST)
    add_space_member(space, manager, SpaceRole.MANAGER)
    add_space_member(space, employee, SpaceRole.EMPLOYEE)
    add_space_member(space, colleague, SpaceRole.EMPLOYEE)
    add_space_member(space, guest, SpaceRole.GUEST)
    project = add_project(space, "QORE")
    return {
        "org": org,
        "admin": admin,
        "space": space,
        "project": project,
        "manager": manager,
        "employee": employee,
        "colleague": colleague,
        "guest": guest,
    }


def tasks_url(org, *parts):  # type: ignore[no-untyped-def]
    tail = "/".join(str(p) for p in parts)
    return f"/api/orgs/{org.id}/tasks/" + (f"{tail}/" if tail else "")


class TestCreate:
    def test_employee_creates_task_with_key_and_default_state(self, make_client, setup):
        client = make_client(setup["employee"])
        first = client.post(
            tasks_url(setup["org"]),
            {"project": setup["project"].id, "title": "  Login page ", "assignee_ids": [setup["colleague"].id]},
            format="json",
        )
        second = client.post(tasks_url(setup["org"]), {"project": setup["project"].id, "title": "Signup"}, format="json")
        assert first.status_code == 201, first.json()
        body = first.json()
        assert body["key"] == "QORE-1" and second.json()["key"] == "QORE-2"
        assert body["title"] == "Login page" and body["state"]["name"] == "To Do"
        assert [a["id"] for a in body["assignees"]] == [setup["colleague"].id]
        assert body["can_edit"] is True
        assert second.json()["position"] > body["position"]
        assert ActivityLog.objects.filter(task_id=body["id"], verb="created").exists()

    def test_guest_cannot_create(self, make_client, setup):
        response = make_client(setup["guest"]).post(
            tasks_url(setup["org"]), {"project": setup["project"].id, "title": "x"}, format="json"
        )
        assert response.status_code == 403

    def test_references_must_belong_to_the_space(self, make_client, setup):
        other_space = add_space(setup["org"], "MKT")
        other_project = add_project(other_space, "VELO")
        outsider = add_member(setup["org"])
        add_space_member(other_space, outsider)
        foreign_tag = Tag.objects.create(space=other_space, name="seo")
        foreign_milestone = Milestone.objects.create(project=other_project, name="M", weight=10)

        response = make_client(setup["admin"]).post(
            tasks_url(setup["org"]),
            {
                "project": setup["project"].id,
                "title": "x",
                "state_id": state_named(other_space, "To Do").id,
                "milestone_id": foreign_milestone.id,
                "assignee_ids": [outsider.id],
                "tag_ids": [foreign_tag.id],
            },
            format="json",
        )
        assert response.status_code == 400
        assert set(response.json()["error"]["details"]) == {"state_id", "milestone_id", "assignee_ids", "tag_ids"}

    def test_completed_state_sets_completed_at(self, make_client, setup):
        response = make_client(setup["admin"]).post(
            tasks_url(setup["org"]),
            {"project": setup["project"].id, "title": "x", "state_id": state_named(setup["space"], "Completed").id},
            format="json",
        )
        assert response.json()["completed_at"] is not None


class TestCustomFields:
    def test_values_are_validated_and_cleaned(self, make_client, setup):
        points = CustomFieldDefinition.objects.create(space=setup["space"], name="Points", field_type="number")
        size = CustomFieldDefinition.objects.create(
            space=setup["space"], name="Size", field_type="select", options=["S", "M"]
        )
        client = make_client(setup["employee"])
        bad = client.post(
            tasks_url(setup["org"]),
            {"project": setup["project"].id, "title": "x", "custom_fields": {str(points.id): "lots", str(size.id): "XL", "999": 1}},
            format="json",
        )
        assert bad.status_code == 400
        assert set(bad.json()["error"]["details"]["custom_fields"]) == {str(points.id), str(size.id), "999"}

        good = client.post(
            tasks_url(setup["org"]),
            {"project": setup["project"].id, "title": "x", "custom_fields": {str(points.id): "5", str(size.id): "M"}},
            format="json",
        )
        assert good.status_code == 201
        assert good.json()["custom_fields"] == {str(points.id): 5.0, str(size.id): "M"}

    def test_required_field(self, make_client, setup):
        CustomFieldDefinition.objects.create(space=setup["space"], name="Client", field_type="text", required=True)
        response = make_client(setup["employee"]).post(
            tasks_url(setup["org"]), {"project": setup["project"].id, "title": "x"}, format="json"
        )
        assert response.status_code == 400


class TestEditPermissions:
    def test_employee_edits_own_and_assigned_tasks_only(self, make_client, setup):
        own = add_task(setup["project"], setup["employee"])
        assigned = add_task(setup["project"], setup["manager"], assignees=[setup["employee"]])
        foreign = add_task(setup["project"], setup["colleague"])
        client = make_client(setup["employee"])

        assert client.patch(tasks_url(setup["org"], own.id), {"title": "a"}, format="json").status_code == 200
        assert client.patch(tasks_url(setup["org"], assigned.id), {"title": "b"}, format="json").status_code == 200
        assert client.patch(tasks_url(setup["org"], foreign.id), {"title": "c"}, format="json").status_code == 403
        rows = {t["id"]: t["can_edit"] for t in client.get(tasks_url(setup["org"])).json()["results"]}
        assert rows == {own.id: True, assigned.id: True, foreign.id: False}

    def test_manager_edits_any_task_guest_none(self, make_client, setup):
        task = add_task(setup["project"], setup["colleague"])
        assert make_client(setup["manager"]).patch(tasks_url(setup["org"], task.id), {"title": "m"}, format="json").status_code == 200
        assert make_client(setup["guest"]).patch(tasks_url(setup["org"], task.id), {"title": "g"}, format="json").status_code == 403

    def test_delete_rules(self, make_client, setup):
        own = add_task(setup["project"], setup["employee"])
        assigned = add_task(setup["project"], setup["manager"], assignees=[setup["employee"]])
        client = make_client(setup["employee"])
        assert client.delete(tasks_url(setup["org"], assigned.id)).status_code == 403
        assert client.delete(tasks_url(setup["org"], own.id)).status_code == 204

    def test_update_logs_readable_activity(self, make_client, setup):
        task = add_task(setup["project"], setup["manager"])
        make_client(setup["manager"]).patch(
            tasks_url(setup["org"], task.id),
            {
                "priority": "HIGH",
                "state_id": state_named(setup["space"], "In Progress").id,
                "assignee_ids": [setup["employee"].id],
            },
            format="json",
        )
        entries = {(a.field, a.old_value, a.new_value) for a in ActivityLog.objects.filter(task=task, verb__in=["updated", "moved"])}
        assert ("priority", "No priority", "High") in entries
        assert ("state", "To Do", "In Progress") in entries
        assert ("assignees", "", setup["employee"].display_name) in entries


class TestMove:
    def test_reorder_within_and_across_columns(self, make_client, setup):
        todo = state_named(setup["space"], "To Do")
        doing = state_named(setup["space"], "In Progress")
        a, b, c = (add_task(setup["project"], setup["manager"], title=t) for t in "abc")
        client = make_client(setup["manager"])

        # c between a and b
        response = client.post(tasks_url(setup["org"], c.id, "move"), {"state_id": todo.id, "after_id": a.id, "before_id": b.id}, format="json")
        assert response.status_code == 200
        assert list(Task.objects.filter(state=todo).values_list("title", flat=True)) == ["a", "c", "b"]

        # b to the top of In Progress (empty column)
        client.post(tasks_url(setup["org"], b.id, "move"), {"state_id": doing.id}, format="json")
        # a above b in In Progress
        client.post(tasks_url(setup["org"], a.id, "move"), {"state_id": doing.id, "before_id": b.id}, format="json")
        assert list(Task.objects.filter(state=doing).values_list("title", flat=True)) == ["a", "b"]
        assert ActivityLog.objects.filter(task=a, verb="moved", new_value="In Progress").exists()

    def test_tight_positions_are_rebalanced(self, make_client, setup):
        todo = state_named(setup["space"], "To Do")
        a, b, c = (add_task(setup["project"], setup["manager"], title=t) for t in "abc")
        Task.objects.filter(pk=a.pk).update(position=1.0)
        Task.objects.filter(pk=b.pk).update(position=1.0 + 1e-9)
        make_client(setup["manager"]).post(
            tasks_url(setup["org"], c.id, "move"), {"state_id": todo.id, "after_id": a.id, "before_id": b.id}, format="json"
        )
        assert list(Task.objects.filter(state=todo).values_list("title", flat=True)) == ["a", "c", "b"]

    def test_move_to_completed_and_back(self, make_client, setup):
        task = add_task(setup["project"], setup["manager"])
        client = make_client(setup["manager"])
        client.post(tasks_url(setup["org"], task.id, "move"), {"state_id": state_named(setup["space"], "Completed").id}, format="json")
        task.refresh_from_db()
        assert task.completed_at is not None
        client.post(tasks_url(setup["org"], task.id, "move"), {"state_id": state_named(setup["space"], "To Do").id}, format="json")
        task.refresh_from_db()
        assert task.completed_at is None

    def test_move_by_category(self, make_client, setup):
        task = add_task(setup["project"], setup["admin"])
        response = make_client(setup["admin"]).post(tasks_url(setup["org"], task.id, "move"), {"category": "REVIEW"}, format="json")
        assert response.json()["state"]["name"] == "In Review"

    def test_state_of_other_space_rejected(self, make_client, setup):
        task = add_task(setup["project"], setup["admin"])
        other = add_space(setup["org"], "OPS")
        response = make_client(setup["admin"]).post(
            tasks_url(setup["org"], task.id, "move"), {"state_id": state_named(other, "To Do").id}, format="json"
        )
        assert response.status_code == 400

    def test_employee_cannot_move_foreign_task(self, make_client, setup):
        task = add_task(setup["project"], setup["colleague"])
        response = make_client(setup["employee"]).post(
            tasks_url(setup["org"], task.id, "move"), {"category": "STARTED"}, format="json"
        )
        assert response.status_code == 403


class TestFilters:
    def test_filters(self, make_client, setup):
        today = timezone.localdate()
        bug = Tag.objects.create(space=setup["space"], name="bug")
        mine = add_task(setup["project"], setup["manager"], assignees=[setup["employee"]], priority="HIGH")
        mine.tags.add(bug)
        overdue = add_task(setup["project"], setup["manager"], due_date=today - timedelta(days=1))
        add_task(setup["project"], setup["manager"], due_date=today - timedelta(days=1), state=state_named(setup["space"], "Completed"))
        unassigned = add_task(setup["project"], setup["manager"], title="Searchable needle")
        client = make_client(setup["employee"])

        def ids(**query):  # type: ignore[no-untyped-def]
            return {t["id"] for t in client.get(tasks_url(setup["org"]), query).json()["results"]}

        assert ids(assignee="me") == {mine.id}
        assert ids(priority="HIGH,URGENT") == {mine.id}
        assert ids(tag=str(bug.id)) == {mine.id}
        assert ids(due="overdue") == {overdue.id}
        assert ids(search="needle") == {unassigned.id}
        assert unassigned.id in ids(assignee="none") and mine.id not in ids(assignee="none")
        assert len(ids(space=setup["space"].id)) == 4


class TestCommentsAttachmentsActivity:
    def test_comments(self, make_client, setup):
        task = add_task(setup["project"], setup["colleague"])
        url = tasks_url(setup["org"], task.id, "comments")
        employee = make_client(setup["employee"])
        created = employee.post(url, {"body": "Looks good"}, format="json")
        assert created.status_code == 201 and created.json()["can_edit"] is True
        comment_id = created.json()["id"]

        assert make_client(setup["guest"]).post(url, {"body": "hi"}, format="json").status_code == 403
        assert make_client(setup["colleague"]).patch(f"{url}{comment_id}/", {"body": "x"}, format="json").status_code == 403
        edited = employee.patch(f"{url}{comment_id}/", {"body": "Edited"}, format="json")
        assert edited.json()["edited_at"] is not None
        assert make_client(setup["manager"]).delete(f"{url}{comment_id}/").status_code == 204
        assert ActivityLog.objects.filter(task=task, verb="commented").exists()

    def test_attachments_upload_download_delete(self, make_client, setup):
        task = add_task(setup["project"], setup["employee"])
        url = tasks_url(setup["org"], task.id, "attachments")
        client = make_client(setup["employee"])
        upload = SimpleUploadedFile("spec <v1>.html", b"<script>alert(1)</script>", content_type="text/html")
        created = client.post(url, {"file": upload}, format="multipart")
        assert created.status_code == 201, created.json()
        body = created.json()
        assert body["filename"] == "spec <v1>.html" and body["size"] == 25

        download = client.get(body["download_url"])
        assert download.status_code == 200
        assert download["Content-Type"] == "application/octet-stream"
        assert download["Content-Disposition"].startswith("attachment")
        assert b"".join(download.streaming_content) == b"<script>alert(1)</script>"

        assert make_client(setup["colleague"]).delete(f"{url}{body['id']}/").status_code == 403
        assert client.delete(f"{url}{body['id']}/").status_code == 204
        assert list(ActivityLog.objects.filter(task=task).values_list("verb", flat=True))[:2] == ["detached", "attached"]

    def test_attachment_size_limit(self, make_client, setup):
        task = add_task(setup["project"], setup["employee"])
        big = SimpleUploadedFile("big.bin", b"x" * (1024 * 1024 + 1))
        response = make_client(setup["employee"]).post(tasks_url(setup["org"], task.id, "attachments"), {"file": big}, format="multipart")
        assert response.status_code == 400

    def test_activity_list(self, make_client, setup):
        task = add_task(setup["project"], setup["employee"])
        rows = make_client(setup["guest"]).get(tasks_url(setup["org"], task.id, "activity")).json()["results"]
        assert rows[0]["verb"] == "created"


class TestTags:
    def url(self, setup, *parts):  # type: ignore[no-untyped-def]
        tail = "/".join(str(p) for p in parts)
        return f"/api/orgs/{setup['org'].id}/spaces/{setup['space'].id}/tags/" + (f"{tail}/" if tail else "")

    def test_employee_creates_manager_deletes(self, make_client, setup):
        created = make_client(setup["employee"]).post(self.url(setup), {"name": "#Security", "color": "#EF4444"}, format="json")
        assert created.status_code == 201 and created.json()["name"] == "Security"
        tag_id = created.json()["id"]
        assert make_client(setup["guest"]).post(self.url(setup), {"name": "x"}, format="json").status_code == 403
        assert make_client(setup["employee"]).delete(self.url(setup, tag_id)).status_code == 403
        assert make_client(setup["manager"]).delete(self.url(setup, tag_id)).status_code == 204


class TestIsolation:
    """Guessing ids of another organization's or an invisible space's tasks must always 404."""

    @pytest.fixture
    def foreign(self, setup):  # type: ignore[no-untyped-def]
        task = add_task(setup["project"], setup["admin"])
        stranger = UserFactory()
        stranger_org = OrganizationFactory(created_by=stranger)
        other_space_member = add_member(setup["org"])
        add_space_member(add_space(setup["org"], "HR"), other_space_member)
        return {"task": task, "stranger": stranger, "stranger_org": stranger_org, "neighbour": other_space_member}

    @pytest.mark.parametrize("suffix", ["", "comments/", "attachments/", "activity/"])
    def test_other_org_cannot_read(self, make_client, setup, foreign, suffix):
        client = make_client(foreign["stranger"])
        assert client.get(tasks_url(setup["org"], foreign["task"].id) + suffix).status_code == 404
        # Through their own org id the task simply doesn't exist either.
        assert client.get(tasks_url(foreign["stranger_org"], foreign["task"].id) + suffix).status_code == 404

    def test_member_of_other_space_cannot_reach_task(self, make_client, setup, foreign):
        client = make_client(foreign["neighbour"])
        task = foreign["task"]
        assert client.get(tasks_url(setup["org"], task.id)).status_code == 404
        assert client.patch(tasks_url(setup["org"], task.id), {"title": "x"}, format="json").status_code == 404
        assert client.post(tasks_url(setup["org"], task.id, "move"), {"category": "STARTED"}, format="json").status_code == 404
        assert client.post(tasks_url(setup["org"], task.id, "comments"), {"body": "x"}, format="json").status_code == 404
        assert client.get(tasks_url(setup["org"])).json()["results"] == []
        response = client.post(tasks_url(setup["org"]), {"project": setup["project"].id, "title": "x"}, format="json")
        assert response.status_code == 400


def test_board_query_count_does_not_grow_with_tasks(make_client, setup, django_assert_max_num_queries):
    bug = Tag.objects.create(space=setup["space"], name="bug")
    for i in range(15):
        task = add_task(setup["project"], setup["manager"], title=f"t{i}", assignees=[setup["employee"], setup["colleague"]])
        task.tags.add(bug)
    client = make_client(setup["employee"])
    with django_assert_max_num_queries(14):
        response = client.get(tasks_url(setup["org"]), {"space": setup["space"].id, "page_size": 500})
    assert len(response.json()["results"]) == 15
