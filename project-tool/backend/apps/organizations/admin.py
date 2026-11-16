from django.contrib import admin

from .models import Invitation, Organization, OrgMembership


class OrgMembershipInline(admin.TabularInline):
    model = OrgMembership
    extra = 0
    autocomplete_fields = ["user"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "created_by", "created_at"]
    search_fields = ["name", "slug"]
    list_filter = ["created_at"]
    prepopulated_fields = {"slug": ("name",)}
    inlines = [OrgMembershipInline]


@admin.register(OrgMembership)
class OrgMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "created_at"]
    list_filter = ["role", "organization"]
    search_fields = ["user__email", "organization__name"]
    autocomplete_fields = ["user", "organization"]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["email", "organization", "role", "space", "status", "expires_at", "accepted_at", "revoked_at"]
    list_filter = ["role", "organization", "accepted_at", "revoked_at"]
    search_fields = ["email", "organization__name"]
    readonly_fields = ["token_hash", "accepted_at", "accepted_by", "created_at"]
