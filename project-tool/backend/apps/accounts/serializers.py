from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "display_name", "avatar", "is_verified", "points", "date_joined"]
        read_only_fields = ["id", "email", "is_verified", "points", "date_joined"]


class UserSummarySerializer(serializers.ModelSerializer):
    """Compact user shape used inside other resources (members, assignees)."""

    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "display_name", "avatar"]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists. Sign in or request a new verification code.",
                code="email_taken",
            )
        return value

    def validate(self, attrs: dict) -> dict:
        candidate = User(email=attrs["email"], full_name=attrs.get("full_name", ""))
        password_validation.validate_password(attrs["password"], user=candidate)
        return attrs


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Enter the 6-digit code."})


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs: dict) -> dict:
        invalid = serializers.ValidationError(
            {"token": "This reset link is invalid or has expired."}, code="invalid_reset_link"
        )
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=user_id, is_active=True)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            raise invalid from None
        if not default_token_generator.check_token(user, attrs["token"]):
            raise invalid
        password_validation.validate_password(attrs["new_password"], user=user)
        attrs["user"] = user
        return attrs


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()
