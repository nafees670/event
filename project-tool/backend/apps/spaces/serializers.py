from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer

from .models import (
    CustomFieldDefinition,
    FieldType,
    Space,
    SpaceMembership,
    SpaceRole,
    WorkflowState,
    short_code_validator,
)


class ShortCodeField(serializers.CharField):
    """Accepts "dev" as "DEV": upper-cases before the format validator runs."""

    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        kwargs.setdefault("max_length", 10)
        kwargs.setdefault("validators", [short_code_validator])
        super().__init__(**kwargs)

    def to_internal_value(self, data):  # type: ignore[no-untyped-def]
        return super().to_internal_value(data).upper()


class SpaceSerializer(serializers.ModelSerializer):
    my_role = serializers.CharField(read_only=True, allow_null=True)
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Space
        fields = [
            "id",
            "name",
            "short_code",
            "department_type",
            "color",
            "description",
            "my_role",
            "member_count",
            "created_at",
        ]
        read_only_fields = fields


class SpaceMembershipSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = SpaceMembership
        fields = ["id", "user", "role", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class SpaceMembershipCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    role = serializers.ChoiceField(choices=SpaceRole.choices, default=SpaceRole.EMPLOYEE)


class SpaceRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=SpaceRole.choices)


class SpaceWriteSerializer(serializers.ModelSerializer):
    """Create (org ADMIN) and update (ADMIN or space MANAGER). The department type is fixed after creation."""

    short_code = ShortCodeField()

    class Meta:
        model = Space
        fields = ["name", "short_code", "department_type", "color", "description"]

    def get_fields(self):  # type: ignore[no-untyped-def]
        fields = super().get_fields()
        if self.instance is not None:
            fields["department_type"].read_only = True
        return fields

    def validate_short_code(self, value: str) -> str:
        clash = Space.objects.filter(organization=self.context["organization"], short_code=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Another space already uses this code.", code="short_code_taken")
        return value


class WorkflowStateSerializer(serializers.ModelSerializer):
    task_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = WorkflowState
        fields = ["id", "name", "color", "category", "order", "is_default", "task_count"]
        read_only_fields = ["id", "order", "task_count"]

    def validate_name(self, value: str) -> str:
        value = value.strip()
        clash = WorkflowState.objects.filter(space=self.context["space"], name__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("This space already has a state with that name.", code="name_taken")
        return value


class CustomFieldSerializer(serializers.ModelSerializer):
    options = serializers.ListField(
        child=serializers.CharField(max_length=60, allow_blank=True), required=False, max_length=50, allow_empty=True
    )

    class Meta:
        model = CustomFieldDefinition
        fields = ["id", "name", "field_type", "options", "required", "order"]
        read_only_fields = ["id", "order"]

    def get_fields(self):  # type: ignore[no-untyped-def]
        fields = super().get_fields()
        if self.instance is not None:
            # Changing the type would invalidate values already stored on tasks.
            fields["field_type"].read_only = True
        return fields

    def validate_name(self, value: str) -> str:
        value = value.strip()
        clash = CustomFieldDefinition.objects.filter(space=self.context["space"], name__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("This space already has a field with that name.", code="name_taken")
        return value

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        field_type = attrs.get("field_type", getattr(self.instance, "field_type", None))
        options = [o.strip() for o in attrs.get("options", getattr(self.instance, "options", [])) if o.strip()]
        if field_type == FieldType.SELECT:
            if not options:
                raise serializers.ValidationError({"options": "Add at least one option."})
            if len(set(options)) != len(options):
                raise serializers.ValidationError({"options": "Options must be unique."})
        else:
            options = []
        attrs["options"] = options
        return attrs


class ReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
