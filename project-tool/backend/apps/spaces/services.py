import datetime as dt
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.db.models import Max
from rest_framework import status

from apps.accounts.models import User
from apps.core.exceptions import ApiError

from . import templates
from .models import (
    CustomFieldDefinition,
    DepartmentType,
    FieldType,
    Space,
    SpaceMembership,
    SpaceRole,
    WorkflowState,
)


@transaction.atomic
def create_space(
    *,
    organization,  # type: ignore[no-untyped-def]
    name: str,
    short_code: str,
    created_by: User | None,
    department_type: str = DepartmentType.GENERAL,
    color: str = "#6366F1",
    description: str = "",
) -> Space:
    """Create a space and copy its department template (workflow + custom fields)."""
    space = Space.objects.create(
        organization=organization,
        name=name,
        short_code=short_code.upper(),
        department_type=department_type,
        color=color,
        description=description,
        created_by=created_by,
    )
    apply_template(space)
    return space


def apply_template(space: Space) -> None:
    """Give a space the workflow and fields of its department type. Only for empty spaces."""
    default_marked = False
    states = []
    for order, spec in enumerate(templates.workflow_for(space.department_type)):
        is_default = not default_marked and spec["category"] == templates.DEFAULT_STATE_CATEGORY
        default_marked = default_marked or is_default
        states.append(WorkflowState(space=space, order=order, is_default=is_default, **spec))
    WorkflowState.objects.bulk_create(states)
    CustomFieldDefinition.objects.bulk_create(
        CustomFieldDefinition(space=space, order=order, **spec)
        for order, spec in enumerate(templates.fields_for(space.department_type))
    )


def set_space_membership(*, user: User, space: Space, role: str) -> SpaceMembership:
    from apps.organizations.models import OrgMembership, OrgRole

    org_role = (
        OrgMembership.objects.filter(user=user, organization_id=space.organization_id)
        .values_list("role", flat=True)
        .first()
    )
    if org_role is None:
        raise ValueError("User must be a member of the space's organization.")
    # Guests of the organization can only ever be guests of a space.
    if org_role == OrgRole.GUEST:
        role = SpaceRole.GUEST
    membership, _ = SpaceMembership.objects.update_or_create(user=user, space=space, defaults={"role": role})
    return membership


# --- Workflow states -------------------------------------------------------------


def _next_order(queryset) -> int:  # type: ignore[no-untyped-def]
    current = queryset.aggregate(m=Max("order"))["m"]
    return 0 if current is None else current + 1


@transaction.atomic
def create_state(*, space: Space, name: str, category: str, color: str, is_default: bool = False) -> WorkflowState:
    state = WorkflowState.objects.create(
        space=space, name=name, category=category, color=color, order=_next_order(space.states.all())
    )
    if is_default:
        set_default_state(state)
    return state


@transaction.atomic
def set_default_state(state: WorkflowState) -> None:
    WorkflowState.objects.filter(space_id=state.space_id, is_default=True).exclude(pk=state.pk).update(is_default=False)
    if not state.is_default:
        state.is_default = True
        state.save(update_fields=["is_default"])


@transaction.atomic
def delete_state(state: WorkflowState, move_to: WorkflowState | None) -> None:
    """Delete a state. Its tasks must be moved first, so nothing ends up without a state."""
    from apps.tasks.models import Task

    space = state.space
    if space.states.count() <= 1:
        raise ApiError("last_state", "A space needs at least one workflow state.", status.HTTP_409_CONFLICT)
    has_tasks = Task.objects.filter(state=state).exists()
    if has_tasks and move_to is None:
        raise ApiError(
            "state_has_tasks",
            "Tasks still use this state. Choose a state to move them to.",
            status.HTTP_409_CONFLICT,
        )
    if move_to is not None:
        if move_to.pk == state.pk or move_to.space_id != state.space_id:
            raise ApiError("invalid_move_to", "Choose another state of the same space.")
        Task.objects.filter(state=state).update(state=move_to)
        if move_to.category != state.category:
            _refresh_space_progress(space)
    was_default = state.is_default
    state.delete()
    if was_default:
        replacement = space.states.exclude(category__in=["COMPLETED", "CANCELLED"]).first() or space.states.first()
        if replacement:
            set_default_state(replacement)


def _refresh_space_progress(space: Space) -> None:
    from apps.projects import progress

    progress.refresh_projects(space.projects.values_list("pk", flat=True))


@transaction.atomic
def update_state(state: WorkflowState, data: dict[str, Any]) -> WorkflowState:
    """Save state edits; a new category changes what its tasks count as, so progress follows."""
    category_changed = "category" in data and data["category"] != state.category
    for key, value in data.items():
        setattr(state, key, value)
    state.save()
    if category_changed:
        _refresh_space_progress(state.space)
    return state


@transaction.atomic
def reorder(queryset, ordered_ids: list[int]) -> None:  # type: ignore[no-untyped-def]
    """Apply a full ordering. ``ordered_ids`` must contain exactly the ids of ``queryset``."""
    existing = set(queryset.values_list("id", flat=True))
    if set(ordered_ids) != existing or len(ordered_ids) != len(existing):
        raise ApiError("invalid_order", "Send every id exactly once.")
    items = {obj.pk: obj for obj in queryset}
    for order, pk in enumerate(ordered_ids):
        items[pk].order = order
    queryset.model.objects.bulk_update(items.values(), ["order"])


# --- Custom fields ---------------------------------------------------------------


def create_field(*, space: Space, **data: Any) -> CustomFieldDefinition:
    return CustomFieldDefinition.objects.create(space=space, order=_next_order(space.custom_fields.all()), **data)


def clean_field_value(field: CustomFieldDefinition, value: Any, space: Space) -> Any:
    """Validate one custom field value and return it in its stored (JSON) form."""
    if value in (None, ""):
        if field.required:
            raise ValueError("This field is required.")
        return None
    if field.field_type == FieldType.TEXT:
        text = str(value).strip()
        if len(text) > 500:
            raise ValueError("Use at most 500 characters.")
        return text
    if field.field_type == FieldType.NUMBER:
        try:
            number = Decimal(str(value))
        except InvalidOperation as exc:
            raise ValueError("Enter a number.") from exc
        if not number.is_finite():
            raise ValueError("Enter a number.")
        return float(number)
    if field.field_type == FieldType.DATE:
        try:
            return dt.date.fromisoformat(str(value)).isoformat()
        except ValueError as exc:
            raise ValueError("Use the format YYYY-MM-DD.") from exc
    if field.field_type == FieldType.SELECT:
        if value not in field.options:
            raise ValueError("Pick one of the options.")
        return value
    if field.field_type == FieldType.USER:
        try:
            user_id = int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("Pick a person.") from exc
        if not SpaceMembership.objects.filter(space=space, user_id=user_id).exists():
            raise ValueError("Pick a member of this space.")
        return user_id
    raise ValueError("Unknown field type.")


def clean_custom_values(space: Space, values: dict[str, Any]) -> dict[str, Any]:
    """Validate a ``{field_id: value}`` mapping against the space's field definitions.

    Unknown ids are rejected; empty values are dropped so the stored JSON stays small.
    """
    fields = {str(f.pk): f for f in space.custom_fields.all()}
    errors: dict[str, str] = {}
    cleaned: dict[str, Any] = {}
    for key, value in values.items():
        field = fields.get(str(key))
        if field is None:
            errors[str(key)] = "Unknown field."
            continue
        try:
            stored = clean_field_value(field, value, space)
        except ValueError as exc:
            errors[str(key)] = str(exc)
            continue
        if stored is not None:
            cleaned[str(key)] = stored
    if errors:
        raise ApiError("invalid_custom_fields", "Some custom fields are invalid.", details={"custom_fields": errors})
    return cleaned
