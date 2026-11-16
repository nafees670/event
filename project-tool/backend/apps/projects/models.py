from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models

from apps.spaces.models import short_code_validator


class ProjectStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    ON_HOLD = "ON_HOLD", "On hold"
    COMPLETED = "COMPLETED", "Completed"
    ARCHIVED = "ARCHIVED", "Archived"


class Project(models.Model):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="projects")
    space = models.ForeignKey("spaces.Space", on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=120)
    # Prefix of task ids ("QORE" -> "QORE-12"); unique in the organization so ids are unambiguous.
    short_code = models.CharField(max_length=10, validators=[short_code_validator])
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=ProjectStatus.choices, default=ProjectStatus.ACTIVE)
    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="led_projects"
    )
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    repo_url = models.URLField(blank=True)
    docs_url = models.URLField(blank=True)
    drive_url = models.URLField(blank=True)
    # Last number handed out to a task of this project. Incremented atomically.
    task_counter = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "short_code"], name="unique_project_code_per_org"),
        ]
        indexes = [models.Index(fields=["space", "status"])]

    def __str__(self) -> str:
        return f"{self.short_code} {self.name}"


class MilestoneStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", "Not started"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    COMPLETED = "COMPLETED", "Completed"


class Milestone(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="milestones")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    # Share of the project, in percent. The weights of a project may not add up to more than 100.
    weight = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(100)])
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=MilestoneStatus.choices, default=MilestoneStatus.NOT_STARTED)
    # Set when an admin or space manager pins the status by hand; automation leaves it alone then.
    status_overridden = models.BooleanField(default=False)
    overridden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    overridden_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(weight__lte=100), name="milestone_weight_at_most_100"),
        ]

    def __str__(self) -> str:
        return f"{self.project.short_code}: {self.name} ({self.weight}%)"
