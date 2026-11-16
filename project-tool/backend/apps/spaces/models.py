from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models


class DepartmentType(models.TextChoices):
    ENGINEERING = "ENGINEERING", "Engineering"
    MARKETING = "MARKETING", "Marketing"
    SALES = "SALES", "Sales"
    OPERATIONS = "OPERATIONS", "Operations"
    HR = "HR", "HR"
    GENERAL = "GENERAL", "General"


class SpaceRole(models.TextChoices):
    MANAGER = "MANAGER", "Manager"
    EMPLOYEE = "EMPLOYEE", "Employee"
    GUEST = "GUEST", "Guest"


short_code_validator = RegexValidator(
    r"^[A-Z][A-Z0-9]{1,9}$", "Use 2-10 uppercase letters or digits, starting with a letter."
)
color_validator = RegexValidator(r"^#[0-9a-fA-F]{6}$", "Use a hex color such as #6366F1.")


class Space(models.Model):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="spaces")
    name = models.CharField(max_length=100)
    short_code = models.CharField(max_length=10, validators=[short_code_validator])
    department_type = models.CharField(max_length=20, choices=DepartmentType.choices, default=DepartmentType.GENERAL)
    color = models.CharField(max_length=7, default="#6366F1", validators=[color_validator])
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "short_code"], name="unique_space_code_per_org"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.short_code})"


class SpaceMembership(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="space_memberships")
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=SpaceRole.choices, default=SpaceRole.EMPLOYEE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["space__name", "user__email"]
        constraints = [models.UniqueConstraint(fields=["user", "space"], name="unique_space_membership")]

    def __str__(self) -> str:
        return f"{self.user} in {self.space} ({self.role})"


class StateCategory(models.TextChoices):
    """What a workflow state *means*. Progress, analytics and automation only look at this."""

    BACKLOG = "BACKLOG", "Backlog"
    UNSTARTED = "UNSTARTED", "Unstarted"
    STARTED = "STARTED", "Started"
    REVIEW = "REVIEW", "Review"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class WorkflowState(models.Model):
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="states")
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7, default="#94A3B8", validators=[color_validator])
    category = models.CharField(max_length=10, choices=StateCategory.choices)
    order = models.PositiveIntegerField(default=0)
    # New tasks land here when no state is given. Exactly one per space.
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["space", "name"], name="unique_state_name_per_space"),
            models.UniqueConstraint(
                fields=["space"], condition=models.Q(is_default=True), name="one_default_state_per_space"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.space.short_code}: {self.name} ({self.category})"


class FieldType(models.TextChoices):
    TEXT = "text", "Text"
    NUMBER = "number", "Number"
    DATE = "date", "Date"
    SELECT = "select", "Select"
    USER = "user", "Person"


class CustomFieldDefinition(models.Model):
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="custom_fields")
    name = models.CharField(max_length=60)
    field_type = models.CharField(max_length=10, choices=FieldType.choices)
    # Choices for SELECT fields; ignored for every other type.
    options = models.JSONField(default=list, blank=True)
    required = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [models.UniqueConstraint(fields=["space", "name"], name="unique_field_name_per_space")]

    def __str__(self) -> str:
        return f"{self.space.short_code}: {self.name} ({self.field_type})"
