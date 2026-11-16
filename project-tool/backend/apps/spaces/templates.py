"""Department templates: the workflow and custom fields a new space starts with.

Templates are only copied at creation time. Afterwards every space owns its states and
fields and can change them freely.
"""

from typing import TypedDict

from .models import DepartmentType, FieldType, StateCategory


class StateSpec(TypedDict):
    name: str
    category: str
    color: str


class FieldSpec(TypedDict, total=False):
    name: str
    field_type: str
    options: list[str]


_BACKLOG: StateSpec = {"name": "Backlog", "category": StateCategory.BACKLOG, "color": "#94A3B8"}
_CANCELLED: StateSpec = {"name": "Cancelled", "category": StateCategory.CANCELLED, "color": "#64748B"}

DEFAULT_WORKFLOW: list[StateSpec] = [
    _BACKLOG,
    {"name": "To Do", "category": StateCategory.UNSTARTED, "color": "#60A5FA"},
    {"name": "In Progress", "category": StateCategory.STARTED, "color": "#F59E0B"},
    {"name": "In Review", "category": StateCategory.REVIEW, "color": "#A855F7"},
    {"name": "Completed", "category": StateCategory.COMPLETED, "color": "#10B981"},
    _CANCELLED,
]

WORKFLOWS: dict[str, list[StateSpec]] = {
    DepartmentType.MARKETING: [
        _BACKLOG,
        {"name": "Planned", "category": StateCategory.UNSTARTED, "color": "#60A5FA"},
        {"name": "In Progress", "category": StateCategory.STARTED, "color": "#F59E0B"},
        {"name": "In Review", "category": StateCategory.REVIEW, "color": "#A855F7"},
        {"name": "Published", "category": StateCategory.COMPLETED, "color": "#10B981"},
        _CANCELLED,
    ],
    DepartmentType.SALES: [
        _BACKLOG,
        {"name": "Prospecting", "category": StateCategory.UNSTARTED, "color": "#60A5FA"},
        {"name": "Negotiation", "category": StateCategory.STARTED, "color": "#F59E0B"},
        {"name": "Proposal Review", "category": StateCategory.REVIEW, "color": "#A855F7"},
        {"name": "Won", "category": StateCategory.COMPLETED, "color": "#10B981"},
        {"name": "Lost", "category": StateCategory.CANCELLED, "color": "#EF4444"},
    ],
    DepartmentType.OPERATIONS: [
        _BACKLOG,
        {"name": "To Do", "category": StateCategory.UNSTARTED, "color": "#60A5FA"},
        {"name": "In Progress", "category": StateCategory.STARTED, "color": "#F59E0B"},
        {"name": "Awaiting Vendor", "category": StateCategory.REVIEW, "color": "#A855F7"},
        {"name": "Done", "category": StateCategory.COMPLETED, "color": "#10B981"},
        _CANCELLED,
    ],
}

FIELDS: dict[str, list[FieldSpec]] = {
    DepartmentType.ENGINEERING: [
        {"name": "Story points", "field_type": FieldType.NUMBER},
        {"name": "Component", "field_type": FieldType.SELECT, "options": ["Frontend", "Backend", "Infrastructure", "Mobile"]},
    ],
    DepartmentType.MARKETING: [
        {"name": "Channel", "field_type": FieldType.SELECT, "options": ["SEO", "PPC", "Social", "Email", "Content"]},
        {"name": "Budget", "field_type": FieldType.NUMBER},
    ],
    DepartmentType.SALES: [
        {"name": "Client", "field_type": FieldType.TEXT},
        {"name": "Deal value", "field_type": FieldType.NUMBER},
    ],
    DepartmentType.OPERATIONS: [
        {"name": "Vendor", "field_type": FieldType.TEXT},
        {"name": "Cost", "field_type": FieldType.NUMBER},
    ],
    DepartmentType.HR: [
        {"name": "Employee", "field_type": FieldType.USER},
        {"name": "Stage", "field_type": FieldType.SELECT, "options": ["Sourcing", "Interview", "Offer", "Onboarding"]},
    ],
}

# The state new tasks start in: the first UNSTARTED state of the workflow.
DEFAULT_STATE_CATEGORY = StateCategory.UNSTARTED


def workflow_for(department_type: str) -> list[StateSpec]:
    return WORKFLOWS.get(department_type, DEFAULT_WORKFLOW)


def fields_for(department_type: str) -> list[FieldSpec]:
    return FIELDS.get(department_type, [])
