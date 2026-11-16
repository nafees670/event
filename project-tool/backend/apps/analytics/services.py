"""Read-only numbers for the analytics dashboards. Everything is computed from tasks by category."""

from datetime import date, datetime, time, timedelta
from typing import Any

from django.conf import settings
from django.db.models import Count, Q, QuerySet
from django.db.models.functions import TruncWeek
from django.utils import timezone

from apps.accounts.models import User
from apps.projects import progress
from apps.projects.models import Project, ProjectStatus
from apps.spaces.models import Space, StateCategory
from apps.tasks.models import Priority, Task

VELOCITY_WEEKS = 8
_DONE = [StateCategory.COMPLETED, StateCategory.CANCELLED]
_ACTIVE = [StateCategory.STARTED, StateCategory.REVIEW]


def _counts(tasks: QuerySet[Task], today: date) -> dict[str, Any]:
    open_q = ~Q(state__category__in=_DONE)
    week_ago = timezone.now() - timedelta(days=7)
    return tasks.aggregate(
        total=Count("pk", filter=~Q(state__category=StateCategory.CANCELLED)),
        open=Count("pk", filter=open_q),
        in_progress=Count("pk", filter=Q(state__category__in=_ACTIVE)),
        completed=Count("pk", filter=Q(state__category=StateCategory.COMPLETED)),
        overdue=Count("pk", filter=open_q & Q(due_date__lt=today)),
        due_this_week=Count("pk", filter=open_q & Q(due_date__gte=today, due_date__lte=today + timedelta(days=7))),
        completed_last_7_days=Count(
            "pk", filter=Q(state__category=StateCategory.COMPLETED, completed_at__gte=week_ago)
        ),
    )


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def velocity(tasks: QuerySet[Task], today: date) -> list[dict[str, Any]]:
    """Tasks completed per week (Monday start) for the last VELOCITY_WEEKS weeks, oldest first."""
    first = _week_start(today) - timedelta(weeks=VELOCITY_WEEKS - 1)
    since = timezone.make_aware(datetime.combine(first, time.min))
    rows = (
        tasks.filter(state__category=StateCategory.COMPLETED, completed_at__gte=since)
        .annotate(week=TruncWeek("completed_at"))
        .values("week")
        .annotate(n=Count("pk"))
    )
    per_week = {timezone.localtime(r["week"]).date() if isinstance(r["week"], datetime) else r["week"]: r["n"] for r in rows}
    return [
        {"week_start": (first + timedelta(weeks=i)).isoformat(), "completed": per_week.get(first + timedelta(weeks=i), 0)}
        for i in range(VELOCITY_WEEKS)
    ]


def status_distribution(tasks: QuerySet[Task]) -> list[dict[str, Any]]:
    counts = dict(tasks.values("state__category").annotate(n=Count("pk")).values_list("state__category", "n"))
    return [{"category": value, "label": label, "count": counts.get(value, 0)} for value, label in StateCategory.choices]


def priority_distribution(tasks: QuerySet[Task]) -> list[dict[str, Any]]:
    open_tasks = tasks.exclude(state__category__in=_DONE)
    counts = dict(open_tasks.values("priority").annotate(n=Count("pk")).values_list("priority", "n"))
    return [{"priority": value, "label": label, "count": counts.get(value, 0)} for value, label in Priority.choices]


def project_rows(projects: QuerySet[Project], today: date) -> list[dict[str, Any]]:
    projects = (
        projects.exclude(status=ProjectStatus.ARCHIVED)
        .select_related("space")
        .annotate(
            open_tasks=Count("tasks", filter=~Q(tasks__state__category__in=_DONE)),
            done_tasks=Count("tasks", filter=Q(tasks__state__category=StateCategory.COMPLETED)),
            overdue_tasks=Count("tasks", filter=~Q(tasks__state__category__in=_DONE) & Q(tasks__due_date__lt=today)),
        )
    )
    numbers = progress.progress_for(p.pk for p in projects)
    rows = [
        {
            "id": p.pk,
            "name": p.name,
            "short_code": p.short_code,
            "space": p.space_id,
            "space_code": p.space.short_code,
            "status": p.status,
            "target_date": p.target_date.isoformat() if p.target_date else None,
            "progress": numbers[p.pk]["progress"],
            "open_tasks": p.open_tasks,
            "completed_tasks": p.done_tasks,
            "overdue_tasks": p.overdue_tasks,
        }
        for p in projects
    ]
    return sorted(rows, key=lambda r: (-r["progress"], r["name"]))


def workload(tasks: QuerySet[Task], people: QuerySet[User], today: date) -> list[dict[str, Any]]:
    """Per person: open work, what's in flight, overdue, and recent completions vs. capacity."""
    open_q = ~Q(assigned_tasks__state__category__in=_DONE)
    month_ago = timezone.now() - timedelta(days=30)
    scope = Q(assigned_tasks__in=tasks)
    rows = people.annotate(
        open=Count("assigned_tasks", filter=scope & open_q, distinct=True),
        in_progress=Count("assigned_tasks", filter=scope & Q(assigned_tasks__state__category__in=_ACTIVE), distinct=True),
        overdue=Count("assigned_tasks", filter=scope & open_q & Q(assigned_tasks__due_date__lt=today), distinct=True),
        completed_last_30_days=Count(
            "assigned_tasks",
            filter=scope
            & Q(assigned_tasks__state__category=StateCategory.COMPLETED, assigned_tasks__completed_at__gte=month_ago),
            distinct=True,
        ),
    ).order_by("full_name", "email")
    capacity = max(settings.WORKLOAD_CAPACITY, 1)
    result = [
        {
            "user": user,
            "open": user.open,
            "in_progress": user.in_progress,
            "overdue": user.overdue,
            "completed_last_30_days": user.completed_last_30_days,
            "utilization": round(user.open / capacity * 100),
        }
        for user in rows
    ]
    return sorted(result, key=lambda r: (-r["open"], r["user"].display_name.lower()))


def space_rows(spaces: QuerySet[Space], today: date) -> list[dict[str, Any]]:
    open_q = ~Q(tasks__state__category__in=_DONE)
    spaces = spaces.annotate(
        open_tasks=Count("tasks", filter=open_q, distinct=True),
        completed_tasks=Count("tasks", filter=Q(tasks__state__category=StateCategory.COMPLETED), distinct=True),
        overdue_tasks=Count("tasks", filter=open_q & Q(tasks__due_date__lt=today), distinct=True),
    ).order_by("name")
    projects = list(Project.objects.filter(space__in=spaces).exclude(status=ProjectStatus.ARCHIVED).values_list("pk", "space_id"))
    numbers = progress.progress_for(pk for pk, _ in projects)
    by_space: dict[int, list[float]] = {}
    for pk, space_id in projects:
        by_space.setdefault(space_id, []).append(numbers[pk]["progress"])
    return [
        {
            "id": s.pk,
            "name": s.name,
            "short_code": s.short_code,
            "color": s.color,
            "open_tasks": s.open_tasks,
            "completed_tasks": s.completed_tasks,
            "overdue_tasks": s.overdue_tasks,
            "project_count": len(by_space.get(s.pk, [])),
            "average_progress": round(sum(by_space[s.pk]) / len(by_space[s.pk]), 1) if by_space.get(s.pk) else 0.0,
        }
        for s in spaces
    ]


def build(*, spaces: QuerySet[Space], people: QuerySet[User], company: bool) -> dict[str, Any]:
    today = timezone.localdate()
    tasks = Task.objects.filter(space__in=spaces)
    data: dict[str, Any] = {
        "generated_at": timezone.now().isoformat(),
        "capacity": settings.WORKLOAD_CAPACITY,
        "kpis": _counts(tasks, today),
        "velocity": velocity(tasks, today),
        "status_distribution": status_distribution(tasks),
        "priority_distribution": priority_distribution(tasks),
        "projects": project_rows(Project.objects.filter(space__in=spaces), today),
        "workload": workload(tasks, people, today),
    }
    if company:
        data["spaces"] = space_rows(spaces, today)
    return data
