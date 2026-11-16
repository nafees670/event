from collections.abc import Iterable
from typing import Any

from django.db import transaction
from django.db.models import F, Max
from django.utils import timezone

from apps.accounts.models import User
from apps.core.exceptions import ApiError
from apps.projects import progress
from apps.projects.models import Project
from apps.spaces.models import Space, StateCategory, WorkflowState

from .models import ActivityLog, ActivityVerb, Priority, Task

# Gap between neighbouring cards. Midpoints are used on moves; when two neighbours get closer
# than MIN_GAP the whole column is renumbered.
POSITION_STEP = 1024.0
MIN_GAP = 1e-6

# Fields recorded in the activity log, with how to display their values.
_TRACKED_FIELDS = ["title", "description", "state", "priority", "milestone", "start_date", "due_date"]


def _display(field: str, value: Any) -> str:
    if value is None or value == "":
        return ""
    if field == "description":
        # The log notes that the description changed; it doesn't keep copies of it.
        return ""
    if field == "priority":
        return str(Priority(value).label)
    if hasattr(value, "name"):
        return str(value.name)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _names(objects: Iterable[Any]) -> str:
    return ", ".join(sorted(getattr(o, "display_name", None) or getattr(o, "name", str(o)) for o in objects))


def log(task: Task, actor: User | None, verb: str, field: str = "", old: str = "", new: str = "") -> ActivityLog:
    return ActivityLog.objects.create(
        project_id=task.project_id, task=task, actor=actor, verb=verb, field=field, old_value=old, new_value=new
    )


def default_state(space: Space) -> WorkflowState:
    state = space.states.filter(is_default=True).first() or space.states.first()
    if state is None:
        raise ApiError("no_workflow", "This space has no workflow states. Add one in the space settings.")
    return state


def _end_of_column(state: WorkflowState, exclude: Task | None = None) -> float:
    tasks = Task.objects.filter(state=state)
    if exclude is not None:
        tasks = tasks.exclude(pk=exclude.pk)
    top = tasks.aggregate(m=Max("position"))["m"]
    return POSITION_STEP if top is None else top + POSITION_STEP


def _sync_completed_at(task: Task, state: WorkflowState) -> None:
    if state.category == StateCategory.COMPLETED:
        task.completed_at = task.completed_at or timezone.now()
    else:
        task.completed_at = None


@transaction.atomic
def create_task(*, project: Project, actor: User, data: dict[str, Any]) -> Task:
    assignees = data.pop("assignees", [])
    tags = data.pop("tags", [])
    state = data.pop("state", None) or default_state(project.space)

    # Numbers are handed out under a row lock so concurrent creates never collide.
    Project.objects.filter(pk=project.pk).update(task_counter=F("task_counter") + 1)
    number = Project.objects.select_for_update().values_list("task_counter", flat=True).get(pk=project.pk)

    task = Task(
        space_id=project.space_id,
        project=project,
        number=number,
        state=state,
        position=_end_of_column(state),
        created_by=actor,
        **data,
    )
    _sync_completed_at(task, state)
    task.save()
    task.assignees.set(assignees)
    task.tags.set(tags)
    log(task, actor, ActivityVerb.CREATED)
    progress.refresh_milestones([task.milestone_id], actor)
    progress.invalidate([project.pk])
    return task


@transaction.atomic
def update_task(*, task: Task, actor: User, data: dict[str, Any]) -> Task:
    task = Task.objects.select_for_update(of=("self",)).select_related("state", "milestone").get(pk=task.pk)
    assignees = data.pop("assignees", None)
    tags = data.pop("tags", None)
    entries: list[tuple[str, str, str]] = []
    old_milestone_id = task.milestone_id

    for field, value in data.items():
        old = getattr(task, field)
        if old == value:
            continue
        if field in _TRACKED_FIELDS:
            entries.append((field, _display(field, old), _display(field, value)))
        elif field == "custom_fields":
            entries.append((field, "", ""))
        setattr(task, field, value)

    if any(field == "state" for field, _, _ in entries):
        # A state change from the drawer puts the card at the bottom of its new column.
        task.position = _end_of_column(task.state, exclude=task)
        _sync_completed_at(task, task.state)
    task.save()

    if assignees is not None:
        before = list(task.assignees.all())
        if {u.pk for u in before} != {u.pk for u in assignees}:
            task.assignees.set(assignees)
            entries.append(("assignees", _names(before), _names(assignees)))
    if tags is not None:
        before_tags = list(task.tags.all())
        if {t.pk for t in before_tags} != {t.pk for t in tags}:
            task.tags.set(tags)
            entries.append(("tags", _names(before_tags), _names(tags)))

    for field, old_value, new_value in entries:
        verb = ActivityVerb.MOVED if field == "state" else ActivityVerb.UPDATED
        log(task, actor, verb, field, old_value, new_value)
    if any(field in ("state", "milestone") for field, _, _ in entries):
        progress.refresh_milestones([old_milestone_id, task.milestone_id], actor)
        progress.invalidate([task.project_id])
    return task


def _rebalance(state: WorkflowState) -> None:
    tasks = list(Task.objects.filter(state=state).order_by("position", "id"))
    for index, item in enumerate(tasks, start=1):
        item.position = index * POSITION_STEP
    Task.objects.bulk_update(tasks, ["position"])


def _position_between(state: WorkflowState, task: Task, after_id: int | None, before_id: int | None) -> float:
    """Position for ``task`` between two cards of ``state``. Unknown or stale neighbours are ignored."""
    neighbours = {
        t.pk: t.position
        for t in Task.objects.filter(state=state, pk__in=[i for i in (after_id, before_id) if i]).exclude(pk=task.pk)
    }
    low = neighbours.get(after_id) if after_id else None
    high = neighbours.get(before_id) if before_id else None
    if low is not None and high is not None and low >= high:
        # The client's view was out of date: fall back to "right after the upper neighbour".
        high = None
    if low is None and high is None:
        return _end_of_column(state, exclude=task)
    if low is None:
        return high - POSITION_STEP  # type: ignore[operator]
    if high is None:
        nxt = (
            Task.objects.filter(state=state, position__gt=low)
            .exclude(pk=task.pk)
            .order_by("position")
            .values_list("position", flat=True)
            .first()
        )
        if nxt is None:
            return low + POSITION_STEP
        high = nxt
    if high - low < MIN_GAP:
        _rebalance(state)
        return _position_between(state, task, after_id, before_id)
    return (low + high) / 2


@transaction.atomic
def move_task(
    *, task: Task, actor: User, state: WorkflowState, after_id: int | None = None, before_id: int | None = None
) -> Task:
    """Place a task in a board column, between two neighbouring cards (both optional)."""
    task = Task.objects.select_for_update(of=("self",)).select_related("state").get(pk=task.pk)
    old_state = task.state
    task.position = _position_between(state, task, after_id, before_id)
    task.state = state
    _sync_completed_at(task, state)
    task.save(update_fields=["state", "position", "completed_at", "updated_at"])
    if old_state.pk != state.pk:
        log(task, actor, ActivityVerb.MOVED, "state", old_state.name, state.name)
        if old_state.category != state.category:
            progress.refresh_milestones([task.milestone_id], actor)
            progress.invalidate([task.project_id])
    return task


def state_for_category(space: Space, category: str) -> WorkflowState:
    """The first state of ``category`` in a space; used by the cross-space board."""
    state = space.states.filter(category=category).order_by("order", "id").first()
    if state is None:
        raise ApiError(
            "no_state_for_category",
            f"{space.name} has no workflow state in the {category.lower()} group.",
        )
    return state


@transaction.atomic
def delete_task(*, task: Task, actor: User) -> None:
    milestone_id, project_id = task.milestone_id, task.project_id
    task.delete()
    progress.refresh_milestones([milestone_id], actor)
    progress.invalidate([project_id])
