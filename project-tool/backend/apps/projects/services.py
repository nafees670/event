from typing import Any

from django.db import transaction
from django.db.models import Max, Sum
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import User
from apps.core.exceptions import ApiError

from . import progress
from .models import Milestone, MilestoneStatus, Project

MAX_TOTAL_WEIGHT = 100


def create_project(*, organization, created_by: User, **data: Any) -> Project:  # type: ignore[no-untyped-def]
    return Project.objects.create(organization=organization, created_by=created_by, **data)


@transaction.atomic
def save_milestone(*, project: Project, data: dict[str, Any], instance: Milestone | None = None) -> Milestone:
    """Create or update a milestone, keeping the project's weights at or below 100% in total.

    The project row is locked so two concurrent saves can't both squeeze under the limit.
    """
    Project.objects.select_for_update().filter(pk=project.pk).first()
    siblings = project.milestones.all()
    if instance is not None:
        siblings = siblings.exclude(pk=instance.pk)
    weight = data.get("weight", instance.weight if instance else 0)
    others = siblings.aggregate(total=Sum("weight"))["total"] or 0
    if others + weight > MAX_TOTAL_WEIGHT:
        available = MAX_TOTAL_WEIGHT - others
        raise ApiError(
            "weight_over_limit",
            f"Milestone weights would add up to {others + weight}%. Only {available}% is left in this project.",
            status.HTTP_400_BAD_REQUEST,
            details={"weight": [f"At most {available}% is available."], "available": available},
        )
    progress.invalidate([project.pk])
    if instance is None:
        order = (project.milestones.aggregate(m=Max("order"))["m"] or 0) + 1
        return Milestone.objects.create(project=project, order=order, **data)
    for key, value in data.items():
        setattr(instance, key, value)
    instance.save()
    return instance


@transaction.atomic
def delete_milestone(milestone: Milestone) -> None:
    project_id = milestone.project_id
    milestone.delete()
    progress.invalidate([project_id])


def _log_status(milestone: Milestone, actor: User, old: str, new: str) -> None:
    from apps.tasks.models import ActivityLog, ActivityVerb

    ActivityLog.objects.create(
        project_id=milestone.project_id,
        milestone=milestone,
        actor=actor,
        verb=ActivityVerb.UPDATED,
        field="milestone_status",
        old_value=old,
        new_value=new,
    )


@transaction.atomic
def override_status(*, milestone: Milestone, new_status: str, actor: User) -> Milestone:
    """Pin a milestone's status by hand. Automation leaves it alone until it is reset."""
    milestone = Milestone.objects.select_for_update().get(pk=milestone.pk)
    labels = dict(MilestoneStatus.choices)
    _log_status(milestone, actor, labels[milestone.status], f"{labels[new_status]} (set manually)")
    milestone.status = new_status
    milestone.status_overridden = True
    milestone.overridden_by = actor
    milestone.overridden_at = timezone.now()
    milestone.save()
    progress.invalidate([milestone.project_id])
    return milestone


@transaction.atomic
def reset_status(*, milestone: Milestone, actor: User) -> Milestone:
    """Hand the status back to automation and recompute it from the tasks right away."""
    milestone = Milestone.objects.select_for_update().get(pk=milestone.pk)
    if milestone.status_overridden:
        _log_status(milestone, actor, "Set manually", "Automatic")
    milestone.status_overridden = False
    milestone.overridden_by = None
    milestone.overridden_at = None
    milestone.save()
    progress.refresh_milestones([milestone.pk], actor)
    milestone.refresh_from_db()
    return milestone
