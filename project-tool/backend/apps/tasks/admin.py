from django.contrib import admin

from .models import ActivityLog, Attachment, Comment, Tag, Task


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "space", "color", "created_at"]
    list_filter = ["space__organization", "space"]
    search_fields = ["name", "space__name"]
    autocomplete_fields = ["space"]


class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    fields = ["author", "body", "created_at"]
    readonly_fields = ["created_at"]
    autocomplete_fields = ["author"]


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0
    fields = ["filename", "size", "uploaded_by", "created_at"]
    readonly_fields = fields


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ["__str__", "project", "state", "priority", "due_date", "created_by", "updated_at"]
    list_filter = ["priority", "state__category", "space__organization", "space"]
    search_fields = ["title", "description", "project__short_code", "project__name"]
    autocomplete_fields = ["space", "project", "milestone", "assignees", "tags", "created_by"]
    readonly_fields = ["number", "completed_at", "created_at", "updated_at"]
    list_select_related = ["project", "state", "created_by"]
    inlines = [CommentInline, AttachmentInline]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["task", "author", "created_at", "edited_at"]
    search_fields = ["body", "task__title", "author__email"]
    list_filter = ["created_at"]
    autocomplete_fields = ["task", "author"]


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ["filename", "task", "size", "content_type", "uploaded_by", "created_at"]
    search_fields = ["filename", "task__title"]
    list_filter = ["content_type", "created_at"]
    autocomplete_fields = ["task", "uploaded_by"]


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor", "verb", "field", "task", "project"]
    list_filter = ["verb", "project__organization"]
    search_fields = ["task__title", "actor__email", "field", "old_value", "new_value"]
    readonly_fields = [f.name for f in ActivityLog._meta.fields]
