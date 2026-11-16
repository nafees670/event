from django.db import migrations

from apps.spaces import templates


def backfill(apps, schema_editor):  # type: ignore[no-untyped-def]
    """Spaces created before workflows existed get their department template now."""
    Space = apps.get_model("spaces", "Space")
    WorkflowState = apps.get_model("spaces", "WorkflowState")
    CustomFieldDefinition = apps.get_model("spaces", "CustomFieldDefinition")

    for space in Space.objects.filter(states__isnull=True):
        default_marked = False
        for order, spec in enumerate(templates.workflow_for(space.department_type)):
            is_default = not default_marked and spec["category"] == templates.DEFAULT_STATE_CATEGORY
            default_marked = default_marked or is_default
            WorkflowState.objects.create(space=space, order=order, is_default=is_default, **spec)
        if not CustomFieldDefinition.objects.filter(space=space).exists():
            for order, spec in enumerate(templates.fields_for(space.department_type)):
                CustomFieldDefinition.objects.create(space=space, order=order, **spec)


class Migration(migrations.Migration):
    dependencies = [("spaces", "0002_customfielddefinition_workflowstate")]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
