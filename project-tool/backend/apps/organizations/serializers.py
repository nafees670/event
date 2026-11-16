from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer
from apps.spaces.models import Space, SpaceRole

from .models import Invitation, Organization, OrgMembership, OrgRole


class OrganizationSerializer(serializers.ModelSerializer):
    my_role = serializers.CharField(read_only=True)
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "my_role", "member_count", "created_at"]
        read_only_fields = ["id", "slug", "created_at"]

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Use at least 2 characters.")
        return value


class MemberSpaceSerializer(serializers.Serializer):
    membership_id = serializers.IntegerField(source="id")
    space_id = serializers.IntegerField(source="space.id")
    name = serializers.CharField(source="space.name")
    short_code = serializers.CharField(source="space.short_code")
    role = serializers.CharField()


class OrgMembershipSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    spaces = serializers.SerializerMethodField()

    class Meta:
        model = OrgMembership
        fields = ["id", "user", "role", "spaces", "created_at"]
        read_only_fields = ["id", "user", "spaces", "created_at"]

    def get_spaces(self, obj: OrgMembership) -> list[dict]:
        memberships = getattr(obj.user, "org_space_memberships", [])
        return MemberSpaceSerializer(memberships, many=True).data


class OrgRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=OrgRole.choices)


class InvitationSerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)
    invited_by = UserSummarySerializer(read_only=True)
    space_name = serializers.CharField(source="space.name", read_only=True, default=None)

    class Meta:
        model = Invitation
        fields = [
            "id",
            "email",
            "role",
            "space",
            "space_name",
            "space_role",
            "status",
            "invited_by",
            "expires_at",
            "accepted_at",
            "created_at",
        ]
        read_only_fields = fields


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=OrgRole.choices, default=OrgRole.MEMBER)
    space = serializers.PrimaryKeyRelatedField(queryset=Space.objects.none(), required=False, allow_null=True)
    space_role = serializers.ChoiceField(choices=SpaceRole.choices, required=False, allow_blank=True)

    def __init__(self, *args, **kwargs) -> None:  # type: ignore[no-untyped-def]
        super().__init__(*args, **kwargs)
        org = self.context.get("organization")
        if org is not None:
            # Only spaces of this organization can be targeted.
            self.fields["space"].queryset = Space.objects.filter(organization=org)  # type: ignore[attr-defined]


class InvitationCreatedSerializer(InvitationSerializer):
    """Returned once on create/resend: includes the join link, which is never stored."""

    invite_url = serializers.CharField(read_only=True)

    class Meta(InvitationSerializer.Meta):
        fields = [*InvitationSerializer.Meta.fields, "invite_url"]
        read_only_fields = fields


class PublicInvitationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name")
    space_name = serializers.CharField(source="space.name", default=None)
    invited_by_name = serializers.CharField(source="invited_by.display_name", default=None)
    status = serializers.CharField()

    class Meta:
        model = Invitation
        fields = ["email", "role", "organization_name", "space_name", "invited_by_name", "status", "expires_at"]
        read_only_fields = fields
