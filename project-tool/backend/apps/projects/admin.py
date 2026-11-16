from django.contrib import admin

from .models import Milestone, Project


class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 0
    fields = ["name", "weight", "due_date", "status", "status_overridden", "order"]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["short_code", "name", "space", "organization", "status", "lead", "created_at"]
    list_filter = ["status", "organization", "space"]
    search_fields = ["name", "short_code", "space__name", "organization__name"]
    autocomplete_fields = ["lead", "space", "organization", "created_by"]
    readonly_fields = ["task_counter", "created_at", "updated_at"]
    inlines = [MilestoneInline]


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "weight", "status", "status_overridden", "due_date"]
    list_filter = ["status", "status_overridden", "project__organization"]
    search_fields = ["name", "project__name", "project__short_code"]
    autocomplete_fields = ["project", "overridden_by"]
