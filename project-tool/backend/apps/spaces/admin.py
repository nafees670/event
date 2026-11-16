from django.contrib import admin

from .models import CustomFieldDefinition, Space, SpaceMembership, WorkflowState


class SpaceMembershipInline(admin.TabularInline):
    model = SpaceMembership
    extra = 0
    autocomplete_fields = ["user"]


class WorkflowStateInline(admin.TabularInline):
    model = WorkflowState
    extra = 0
    fields = ["name", "category", "color", "order", "is_default"]


class CustomFieldInline(admin.TabularInline):
    model = CustomFieldDefinition
    extra = 0
    fields = ["name", "field_type", "options", "required", "order"]


@admin.register(Space)
class SpaceAdmin(admin.ModelAdmin):
    list_display = ["name", "short_code", "organization", "department_type", "created_at"]
    list_filter = ["department_type", "organization"]
    search_fields = ["name", "short_code", "organization__name"]
    inlines = [SpaceMembershipInline, WorkflowStateInline, CustomFieldInline]


@admin.register(SpaceMembership)
class SpaceMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "space", "role", "created_at"]
    list_filter = ["role", "space__organization"]
    search_fields = ["user__email", "space__name", "space__short_code"]
    autocomplete_fields = ["user", "space"]


@admin.register(WorkflowState)
class WorkflowStateAdmin(admin.ModelAdmin):
    list_display = ["name", "space", "category", "order", "is_default"]
    list_filter = ["category", "space__organization"]
    search_fields = ["name", "space__name", "space__short_code"]
    autocomplete_fields = ["space"]


@admin.register(CustomFieldDefinition)
class CustomFieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ["name", "space", "field_type", "required", "order"]
    list_filter = ["field_type", "required", "space__organization"]
    search_fields = ["name", "space__name", "space__short_code"]
    autocomplete_fields = ["space"]
