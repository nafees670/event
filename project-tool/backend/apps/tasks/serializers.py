from django.conf import settings
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UserSummarySerializer
from apps.organizations import access
from apps.projects.models import Milestone, Project
from apps.spaces.models import StateCategory, WorkflowState
from apps.spaces.services import clean_custom_values

from .models import ActivityLog, Attachment, Comment, Priority, Tag, Task


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "color"]
        read_only_fields = ["id"]

    def validate_name(self, value: str) -> str:
        value = value.strip().lstrip("#")
        if not value:
            raise serializers.ValidationError("Enter a tag name.")
        clash = Tag.objects.filter(space=self.context["space"], name__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("This tag already exists.", code="name_taken")
        return value


class StateSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowState
        fields = ["id", "name", "color", "category"]
        read_only_fields = fields


class ProjectSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "name", "short_code"]
        read_only_fields = fields


class MilestoneSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = ["id", "name"]
        read_only_fields = fields


class TaskSerializer(serializers.ModelSerializer):
    key = serializers.CharField(read_only=True)
    project = ProjectSummarySerializer(read_only=True)
    state = StateSummarySerializer(read_only=True)
    milestone = MilestoneSummarySerializer(read_only=True)
    assignees = UserSummarySerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    comment_count = serializers.IntegerField(read_only=True, default=0)
    attachment_count = serializers.IntegerField(read_only=True, default=0)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "key",
            "number",
            "space",
            "project",
            "title",
            "description",
            "state",
            "priority",
            "milestone",
            "assignees",
            "tags",
            "start_date",
            "due_date",
            "custom_fields",
            "position",
            "completed_at",
            "created_by",
            "comment_count",
            "attachment_count",
            "can_edit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_can_edit(self, task: Task) -> bool:
        membership = self.context.get("org_membership")
        if membership is None:
            return False
        roles: dict[int, str] = self.context.get("space_roles", {})
        return access.can_edit_task(self.context["request"].user, task, membership, roles.get(task.space_id, ""))


class TaskWriteSerializer(serializers.ModelSerializer):
    """Validates references against the task's space: state, milestone, assignees, tags, custom fields."""

    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.none())
    state_id = serializers.PrimaryKeyRelatedField(
        source="state", queryset=WorkflowState.objects.all(), required=False
    )
    milestone_id = serializers.PrimaryKeyRelatedField(
        source="milestone", queryset=Milestone.objects.all(), allow_null=True, required=False
    )
    assignee_ids = serializers.PrimaryKeyRelatedField(
        source="assignees", queryset=User.objects.all(), many=True, required=False
    )
    tag_ids = serializers.PrimaryKeyRelatedField(source="tags", queryset=Tag.objects.all(), many=True, required=False)
    custom_fields = serializers.DictField(required=False)
    priority = serializers.ChoiceField(choices=Priority.choices, required=False)

    class Meta:
        model = Task
        fields = [
            "project",
            "title",
            "description",
            "state_id",
            "priority",
            "milestone_id",
            "assignee_ids",
            "tag_ids",
            "start_date",
            "due_date",
            "custom_fields",
        ]

    def get_fields(self):  # type: ignore[no-untyped-def]
        fields = super().get_fields()
        fields["project"].queryset = self.context.get("projects", Project.objects.none())
        if self.instance is not None:
            fields["project"].read_only = True
        return fields

    def validate_title(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Enter a title.")
        return value

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        project: Project = attrs.get("project") or self.instance.project
        space = project.space
        errors: dict[str, str] = {}

        state = attrs.get("state")
        if state is not None and state.space_id != space.pk:
            errors["state_id"] = "Pick a state of this project's space."
        milestone = attrs.get("milestone")
        if milestone is not None and milestone.project_id != project.pk:
            errors["milestone_id"] = "Pick a milestone of this project."
        for user in attrs.get("assignees", []):
            if not access.is_space_participant(user.pk, space):
                errors["assignee_ids"] = f"{user.display_name} is not a member of this space."
                break
        if any(tag.space_id != space.pk for tag in attrs.get("tags", [])):
            errors["tag_ids"] = "Pick tags of this project's space."
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        due = attrs.get("due_date", getattr(self.instance, "due_date", None))
        if start and due and due < start:
            errors["due_date"] = "The due date can't be before the start date."
        if errors:
            raise serializers.ValidationError(errors)

        if "custom_fields" in attrs:
            attrs["custom_fields"] = clean_custom_values(space, attrs["custom_fields"])
        # ``custom_fields`` replaces the whole mapping, so required fields are checked on every write of it.
        if self.instance is None or "custom_fields" in attrs:
            values = attrs.get("custom_fields", {})
            missing = [f.name for f in space.custom_fields.filter(required=True) if str(f.pk) not in values]
            if missing:
                raise serializers.ValidationError({"custom_fields": f"Fill in: {', '.join(missing)}."})
        return attrs


class TaskMoveSerializer(serializers.Serializer):
    """Move a card. Give ``state_id`` (a space board) or ``category`` (the cross-space board)."""

    state_id = serializers.IntegerField(required=False)
    category = serializers.ChoiceField(choices=StateCategory.choices, required=False)
    after_id = serializers.IntegerField(required=False, allow_null=True)
    before_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        if ("state_id" in attrs) == ("category" in attrs):
            raise serializers.ValidationError("Send either state_id or category.")
        return attrs


class CommentSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "author", "body", "edited_at", "created_at", "can_edit"]
        read_only_fields = ["id", "author", "edited_at", "created_at", "can_edit"]

    def get_can_edit(self, comment: Comment) -> bool:
        return comment.author_id == self.context["request"].user.pk

    def validate_body(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Write something first.")
        if len(value) > 10_000:
            raise serializers.ValidationError("Keep comments under 10,000 characters.")
        return value


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSummarySerializer(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "filename", "size", "content_type", "uploaded_by", "created_at", "download_url"]
        read_only_fields = fields

    def get_download_url(self, attachment: Attachment) -> str:
        task = attachment.task
        return f"/api/orgs/{task.space.organization_id}/tasks/{task.pk}/attachments/{attachment.pk}/download/"


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):  # type: ignore[no-untyped-def]
        limit = settings.MAX_ATTACHMENT_MB * 1024 * 1024
        if value.size > limit:
            raise serializers.ValidationError(f"Files can be at most {settings.MAX_ATTACHMENT_MB} MB.")
        return value


class ActivitySerializer(serializers.ModelSerializer):
    actor = UserSummarySerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "actor", "verb", "field", "old_value", "new_value", "created_at"]
        read_only_fields = fields
