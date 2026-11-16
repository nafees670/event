"""Milestone progress, automatic milestone status and weighted project progress.

* Milestone progress = completed tasks / tasks, cancelled tasks excluded; no tasks -> 0.
* Project progress   = sum(milestone.weight * milestone progress), in percent (0-100).
* Milestone status follows its tasks unless an ADMIN or space MANAGER pinned it
  (``status_overridden``).

Results are cached per project in Redis and invalidated whenever a task, milestone or
workflow state that feeds them changes (after the transaction commits).
"""

from collections.abc import Iterable
from dataclasses import dataclass

from django.core.cache import cache
from django.db.transaction import on_commit
from django.db.models import Count, Q

from apps.accounts.models import User
from apps.spaces.models import StateCategory

from .models import Milestone, MilestoneStatus

CACHE_TIMEOUT = 60 * 60
_STARTED = [StateCategory.STARTED, StateCategory.REVIEW, StateCategory.COMPLETED]


def _cache_key(project_id: int) -> str:
    return f"project-progress:v1:{project_id}"


@dataclass(frozen=True)
class MilestoneCounts:
    total: int
    completed: int
    started: int

    @property
    def progress(self) -> float:
        """Share of done tasks, 0.0-1.0."""
        return self.completed / self.total if self.total else 0.0


def _counts(milestones) -> dict[int, MilestoneCounts]:  # type: ignore[no-untyped-def]
    rows = milestones.annotate(
        n_total=Count("tasks", filter=~Q(tasks__state__category=StateCategory.CANCELLED)),
        n_done=Count("tasks", filter=Q(tasks__state__category=StateCategory.COMPLETED)),
        n_started=Count("tasks", filter=Q(tasks__state__category__in=_STARTED)),
    ).values_list("pk", "n_total", "n_done", "n_started")
    return {pk: MilestoneCounts(total, done, started) for pk, total, done, started in rows}


def automatic_status(counts: MilestoneCounts) -> str:
    if counts.total and counts.completed == counts.total:
        return MilestoneStatus.COMPLETED
    if counts.started:
        return MilestoneStatus.IN_PROGRESS
    return MilestoneStatus.NOT_STARTED


def _compute(project_ids: list[int]) -> dict[int, dict]:
    """Progress for several projects in one query."""
    result: dict[int, dict] = {pk: {"progress": 0.0, "milestones": {}} for pk in project_ids}
    milestones = Milestone.objects.filter(project_id__in=project_ids)
    weights = dict(milestones.values_list("pk", "weight"))
    owners = dict(milestones.values_list("pk", "project_id"))
    for pk, counts in _counts(milestones).items():
        share = round(counts.progress * 100, 1)
        entry = result[owners[pk]]
        entry["milestones"][pk] = share
        entry["progress"] += weights[pk] * counts.progress
    for entry in result.values():
        entry["progress"] = round(min(entry["progress"], 100.0), 1)
    return result


def progress_for(project_ids: Iterable[int]) -> dict[int, dict]:
    """``{project_id: {"progress": 42.5, "milestones": {milestone_id: 80.0}}}``, cached."""
    ids = list(dict.fromkeys(project_ids))
    if not ids:
        return {}
    cached = cache.get_many([_cache_key(pk) for pk in ids])
    result = {pk: cached[_cache_key(pk)] for pk in ids if _cache_key(pk) in cached}
    missing = [pk for pk in ids if pk not in result]
    if missing:
        fresh = _compute(missing)
        cache.set_many({_cache_key(pk): value for pk, value in fresh.items()}, CACHE_TIMEOUT)
        result.update(fresh)
    return result


def invalidate(project_ids: Iterable[int]) -> None:
    """Drop cached progress now and again after commit.

    The second delete catches a reader that cached the pre-commit numbers in between.
    """
    keys = [_cache_key(pk) for pk in set(project_ids)]
    if keys:
        cache.delete_many(keys)
        on_commit(lambda: cache.delete_many(keys))


def refresh_milestones(milestone_ids: Iterable[int | None], actor: User | None = None) -> None:
    """Re-derive the status of milestones whose tasks changed, and drop their projects' cache.

    Pinned (overridden) milestones keep their status. Status changes are written to the
    activity log so the history shows when a milestone completed or reopened.
    """
    from apps.tasks.models import ActivityLog, ActivityVerb

    ids = {pk for pk in milestone_ids if pk}
    if not ids:
        return
    milestones = list(Milestone.objects.select_for_update().filter(pk__in=ids))
    counts = _counts(Milestone.objects.filter(pk__in=ids))
    labels = dict(MilestoneStatus.choices)
    for milestone in milestones:
        if milestone.status_overridden:
            continue
        status = automatic_status(counts.get(milestone.pk, MilestoneCounts(0, 0, 0)))
        if status == milestone.status:
            continue
        ActivityLog.objects.create(
            project_id=milestone.project_id,
            milestone=milestone,
            actor=actor,
            verb=ActivityVerb.UPDATED,
            field="milestone_status",
            old_value=labels[milestone.status],
            new_value=labels[status],
        )
        milestone.status = status
        milestone.save(update_fields=["status", "updated_at"])
    invalidate(m.project_id for m in milestones)


def refresh_projects(project_ids: Iterable[int], actor: User | None = None) -> None:
    """Refresh every milestone of some projects (bulk changes: state category edits, deletes)."""
    ids = list(set(project_ids))
    refresh_milestones(Milestone.objects.filter(project_id__in=ids).values_list("pk", flat=True), actor)
    invalidate(ids)
