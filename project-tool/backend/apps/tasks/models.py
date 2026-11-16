import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models

from apps.spaces.models import color_validator


class PrivateStorage(FileSystemStorage):
    """Files outside MEDIA_ROOT. Nginx never serves them; the API streams them after a permission check."""

    def __init__(self) -> None:
        super().__init__(location=settings.PRIVATE_STORAGE_ROOT, base_url=None)


private_storage = PrivateStorage()


class Priority(models.TextChoices):
    URGENT = "URGENT", "Urgent"
    HIGH = "HIGH", "High"
    MEDIUM = "MEDIUM", "Medium"
    LOW = "LOW", "Low"
    NONE = "NONE", "No priority"


class Tag(models.Model):
    space = models.ForeignKey("spaces.Space", on_delete=models.CASCADE, related_name="tags")
    name = models.CharField(max_length=40)
    color = models.CharField(max_length=7, default="#64748B", validators=[color_validator])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["space", "name"], name="unique_tag_per_space")]

    def __str__(self) -> str:
        return f"#{self.name}"


class Task(models.Model):
    # ``space`` duplicates ``project.space`` so board and permission queries don't need a join.
    space = models.ForeignKey("spaces.Space", on_delete=models.CASCADE, related_name="tasks")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="tasks")
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    # RESTRICT (not PROTECT) so deleting a whole space still cascades; a lone state with tasks can't go.
    state = models.ForeignKey("spaces.WorkflowState", on_delete=models.RESTRICT, related_name="tasks")
    priority = models.CharField(max_length=6, choices=Priority.choices, default=Priority.NONE)
    milestone = models.ForeignKey(
        "projects.Milestone", null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks"
    )
    assignees = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="assigned_tasks")
    tags = models.ManyToManyField(Tag, blank=True, related_name="tasks")
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    # Order inside a board column. Floats so a move only rewrites the moved task.
    position = models.FloatField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_tasks"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["project", "number"], name="unique_task_number_per_project")]
        indexes = [
            models.Index(fields=["space", "state", "position"]),
            models.Index(fields=["project", "state"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.key} {self.title}"

    @property
    def key(self) -> str:
        return f"{self.project.short_code}-{self.number}"


class Comment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    body = models.TextField()
    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"Comment on {self.task_id} by {self.author_id}"


def attachment_path(instance: "Attachment", filename: str) -> str:
    # The stored name is random; the original name is kept in ``filename`` for downloads.
    suffix = Path(filename).suffix.lower()[:10]
    return f"tasks/{instance.task.space.organization_id}/{instance.task_id}/{uuid.uuid4().hex}{suffix}"


class Attachment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=attachment_path, storage=private_storage, max_length=255)
    filename = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField()
    content_type = models.CharField(max_length=120, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return self.filename


class ActivityVerb(models.TextChoices):
    CREATED = "created", "Created"
    UPDATED = "updated", "Updated"
    MOVED = "moved", "Moved"
    COMMENTED = "commented", "Commented"
    ATTACHED = "attached", "Attached a file"
    DETACHED = "detached", "Removed a file"


class ActivityLog(models.Model):
    """Append-only history of a task (and, later, of milestones)."""

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="activity")
    task = models.ForeignKey(Task, null=True, blank=True, on_delete=models.CASCADE, related_name="activity")
    milestone = models.ForeignKey(
        "projects.Milestone", null=True, blank=True, on_delete=models.CASCADE, related_name="activity"
    )
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    verb = models.CharField(max_length=20, choices=ActivityVerb.choices)
    field = models.CharField(max_length=40, blank=True)
    # Human-readable values ("In Progress", "Areeba, Zain"), so history survives later renames.
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["task", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.actor_id} {self.verb} {self.field}".strip()
