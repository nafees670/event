from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UserSummarySerializer
from apps.organizations import access
from apps.spaces.models import Space
from apps.spaces.serializers import ShortCodeField

from .models import Milestone, MilestoneStatus, Project


class ProjectSerializer(serializers.ModelSerializer):
    lead = UserSummarySerializer(read_only=True)
    space_code = serializers.CharField(source="space.short_code", read_only=True)
    task_count = serializers.IntegerField(read_only=True, default=0)
    completed_task_count = serializers.IntegerField(read_only=True, default=0)
    milestone_count = serializers.IntegerField(read_only=True, default=0)
    milestone_weight_total = serializers.IntegerField(read_only=True, default=0)
    progress = serializers.SerializerMethodField(help_text="Weighted project progress, 0-100.")
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "space",
            "space_code",
            "name",
            "short_code",
            "description",
            "status",
            "lead",
            "start_date",
            "target_date",
            "repo_url",
            "docs_url",
            "drive_url",
            "task_count",
            "completed_task_count",
            "milestone_count",
            "milestone_weight_total",
            "progress",
            "can_manage",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_progress(self, project: Project) -> float:
        entry = self.context.get("progress", {}).get(project.pk)
        return entry["progress"] if entry else 0.0

    def get_can_manage(self, project: Project) -> bool:
        managed = self.context.get("managed_space_ids")
        return managed is not None and project.space_id in managed


class ProjectWriteSerializer(serializers.ModelSerializer):
    space = serializers.PrimaryKeyRelatedField(queryset=Space.objects.none())
    short_code = ShortCodeField()
    lead_id = serializers.PrimaryKeyRelatedField(
        source="lead", queryset=User.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Project
        fields = [
            "space",
            "name",
            "short_code",
            "description",
            "status",
            "lead_id",
            "start_date",
            "target_date",
            "repo_url",
            "docs_url",
            "drive_url",
        ]

    def get_fields(self):  # type: ignore[no-untyped-def]
        fields = super().get_fields()
        fields["space"].queryset = self.context.get("visible_spaces", Space.objects.none())
        if self.instance is not None:
            # Moving a project between spaces would break its tasks' workflow states.
            fields["space"].read_only = True
        return fields

    def validate_short_code(self, value: str) -> str:
        clash = Project.objects.filter(organization=self.context["organization"], short_code=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Another project already uses this code.", code="short_code_taken")
        return value

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        space = attrs.get("space") or self.instance.space
        lead = attrs.get("lead")
        if lead is not None and not access.is_space_participant(lead.pk, space):
            raise serializers.ValidationError({"lead_id": "The lead must be a member of the project's space."})
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        target = attrs.get("target_date", getattr(self.instance, "target_date", None))
        if start and target and target < start:
            raise serializers.ValidationError({"target_date": "The target date can't be before the start date."})
        return attrs


class MilestoneSerializer(serializers.ModelSerializer):
    overridden_by = UserSummarySerializer(read_only=True)
    task_count = serializers.IntegerField(read_only=True, default=0)
    completed_task_count = serializers.IntegerField(read_only=True, default=0)
    progress = serializers.SerializerMethodField(help_text="Share of done tasks, 0-100.")

    class Meta:
        model = Milestone
        fields = [
            "id",
            "name",
            "description",
            "weight",
            "due_date",
            "status",
            "status_overridden",
            "overridden_by",
            "overridden_at",
            "order",
            "task_count",
            "completed_task_count",
            "progress",
            "created_at",
        ]
        # Status is driven by tasks (and manual overrides) in the progress engine, not edited here.
        read_only_fields = [
            "id",
            "status",
            "status_overridden",
            "overridden_by",
            "overridden_at",
            "order",
            "task_count",
            "completed_task_count",
            "progress",
            "created_at",
        ]
        extra_kwargs = {"weight": {"min_value": 0, "max_value": 100}}

    def get_progress(self, milestone: Milestone) -> float:
        total = getattr(milestone, "task_count", 0)
        return round(milestone.completed_task_count / total * 100, 1) if total else 0.0


class MilestoneOverrideSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=MilestoneStatus.choices)
