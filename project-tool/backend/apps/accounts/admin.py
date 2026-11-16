from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import BaseUserCreationForm, UserChangeForm

from .models import EmailVerificationCode, User


class UserCreationForm(BaseUserCreationForm):
    class Meta:
        model = User
        fields = ("email",)


class UserEditForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = UserCreationForm
    form = UserEditForm
    ordering = ["email"]
    list_display = ["email", "full_name", "is_verified", "is_active", "is_staff", "points", "date_joined"]
    list_filter = ["is_verified", "is_active", "is_staff", "is_superuser"]
    search_fields = ["email", "full_name"]
    readonly_fields = ["date_joined", "last_login"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "avatar", "points")}),
        ("Status", {"fields": ("is_active", "is_verified", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)


@admin.register(EmailVerificationCode)
class EmailVerificationCodeAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at", "expires_at", "attempts", "consumed_at"]
    list_filter = ["consumed_at"]
    search_fields = ["user__email"]
    readonly_fields = ["code_hash"]
