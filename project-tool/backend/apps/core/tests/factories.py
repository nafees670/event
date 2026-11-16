import factory

from apps.accounts.models import User
from apps.organizations.models import OrgMembership, OrgRole
from apps.organizations.services import create_organization
from apps.spaces.models import SpaceMembership, SpaceRole
from apps.spaces.services import create_space

PASSWORD = "Sup3r-Secret-pass!"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.test")
    full_name = factory.Faker("name")
    is_verified = True
    password = factory.PostGenerationMethodCall("set_password", PASSWORD)

    @factory.post_generation
    def _save(obj, create, extracted, **kwargs):  # type: ignore[no-untyped-def]  # noqa: N805
        if create:
            obj.save()


class OrganizationFactory(factory.Factory):
    """Builds orgs through the real service so the General space and ADMIN exist."""

    class Meta:
        model = dict

    name = factory.Sequence(lambda n: f"Org {n}")
    created_by = factory.SubFactory(UserFactory)

    @classmethod
    def _create(cls, model_class, name, created_by):  # type: ignore[no-untyped-def]
        return create_organization(user=created_by, name=name)

    _build = _create


def add_member(org, user=None, role=OrgRole.MEMBER):  # type: ignore[no-untyped-def]
    user = user or UserFactory()
    OrgMembership.objects.create(user=user, organization=org, role=role)
    return user


def add_space(org, code="DEV", name=None, creator=None):  # type: ignore[no-untyped-def]
    return create_space(organization=org, name=name or f"Space {code}", short_code=code, created_by=creator)


def add_space_member(space, user, role=SpaceRole.EMPLOYEE):  # type: ignore[no-untyped-def]
    return SpaceMembership.objects.create(user=user, space=space, role=role)


def add_project(space, code="PRJ", name=None, creator=None):  # type: ignore[no-untyped-def]
    from apps.projects.models import Project

    return Project.objects.create(
        organization_id=space.organization_id,
        space=space,
        name=name or f"Project {code}",
        short_code=code,
        created_by=creator,
    )


def add_task(project, creator=None, title="A task", state=None, assignees=(), **data):  # type: ignore[no-untyped-def]
    from apps.tasks.services import create_task

    if state is not None:
        data["state"] = state
    return create_task(
        project=project, actor=creator, data={"title": title, "assignees": list(assignees), **data}
    )


def state_named(space, name):  # type: ignore[no-untyped-def]
    return space.states.get(name=name)
