from django.db import migrations
from django.db.models import Count, Q


def backfill(apps, schema_editor):  # type: ignore[no-untyped-def]
    """Milestones created before automatic status existed get the status their tasks imply."""
    Milestone = apps.get_model("projects", "Milestone")
    rows = Milestone.objects.filter(status_overridden=False).annotate(
        n_total=Count("tasks", filter=~Q(tasks__state__category="CANCELLED")),
        n_done=Count("tasks", filter=Q(tasks__state__category="COMPLETED")),
        n_started=Count("tasks", filter=Q(tasks__state__category__in=["STARTED", "REVIEW", "COMPLETED"])),
    )
    for milestone in rows:
        if milestone.n_total and milestone.n_done == milestone.n_total:
            status = "COMPLETED"
        elif milestone.n_started:
            status = "IN_PROGRESS"
        else:
            status = "NOT_STARTED"
        if status != milestone.status:
            Milestone.objects.filter(pk=milestone.pk).update(status=status)


class Migration(migrations.Migration):
    dependencies = [("projects", "0001_initial"), ("tasks", "0001_initial")]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
