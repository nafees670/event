from django.db.models import Count, IntegerField, OuterRef, Q, QuerySet, Subquery, Sum
from django.db.models.functions import Coalesce
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.exceptions import ApiError
from apps.organizations import access
from apps.organizations.mixins import SpaceScopedMixin
from apps.organizations.models import OrgRole
from apps.spaces.models import Space, SpaceMembership, SpaceRole, StateCategory
from apps.spaces.serializers import ReorderSerializer
from apps.spaces.services import reorder

from . import progress, services
from .models import Milestone, Project
from .serializers import (
    MilestoneOverrideSerializer,
    MilestoneSerializer,
    ProjectSerializer,
    ProjectWriteSerializer,
)

_OPEN_TASKS = ~Q(tasks__state__category=StateCategory.CANCELLED)
_DONE_TASKS = Q(tasks__state__category=StateCategory.COMPLETED)


def _forbidden() -> ApiError:
    return ApiError(
        "permission_denied",
        "Only organization admins and space managers can change this.",
        status.HTTP_403_FORBIDDEN,
    )


class ManagedSpacesMixin(SpaceScopedMixin):
    """Knows which visible spaces the user may manage (ADMIN: all; otherwise where they are MANAGER)."""

    def managed_space_ids(self) -> set[int]:
        spaces = self.get_visible_spaces()
        if self.org_membership.role != OrgRole.ADMIN:
            managed = SpaceMembership.objects.filter(user=self.request.user, role=SpaceRole.MANAGER)
            spaces = spaces.filter(pk__in=managed.values("space_id"))
        return set(spaces.values_list("pk", flat=True))


class ProjectViewSet(ManagedSpacesMixin, viewsets.ModelViewSet):
    queryset = Project.objects.none()
    serializer_class = ProjectSerializer
    search_fields = ["name", "short_code", "description"]
    filterset_fields = ["space", "status", "lead"]
    ordering_fields = ["name", "created_at", "target_date"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_scoped_queryset(self) -> QuerySet[Project]:
        weights = (
            Milestone.objects.filter(project=OuterRef("pk"))
            .values("project")
            .annotate(total=Sum("weight"))
            .values("total")
        )
        return (
            Project.objects.filter(space__in=self.get_visible_spaces())
            .select_related("space", "lead")
            .annotate(
                task_count=Count("tasks", filter=_OPEN_TASKS, distinct=True),
                completed_task_count=Count("tasks", filter=_DONE_TASKS, distinct=True),
                milestone_count=Count("milestones", distinct=True),
                milestone_weight_total=Coalesce(Subquery(weights, output_field=IntegerField()), 0),
            )
            .order_by("name")
        )

    def get_serializer_context(self):  # type: ignore[no-untyped-def]
        context = super().get_serializer_context()
        if hasattr(self, "org_membership"):
            context["managed_space_ids"] = self.managed_space_ids()
        return context

    def get_serializer(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        # Progress comes from the cache in one round trip for the whole page.
        if args and "data" not in kwargs:
            projects = args[0] if kwargs.get("many") else [args[0]]
            context = kwargs.setdefault("context", self.get_serializer_context())
            context["progress"] = progress.progress_for(p.pk for p in projects)
        return super().get_serializer(*args, **kwargs)

    def _write_serializer(self, instance: Project | None = None, partial: bool = False) -> ProjectWriteSerializer:
        serializer = ProjectWriteSerializer(
            instance,
            data=self.request.data,
            partial=partial,
            context={"organization": self.org, "visible_spaces": self.get_visible_spaces()},
        )
        serializer.is_valid(raise_exception=True)
        return serializer

    def _detail(self, project: Project, code: int = status.HTTP_200_OK) -> Response:
        return Response(self.get_serializer(self.get_queryset().get(pk=project.pk)).data, status=code)

    @extend_schema(request=ProjectWriteSerializer, responses={201: ProjectSerializer})
    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        serializer = self._write_serializer()
        space: Space = serializer.validated_data["space"]
        if not access.can_manage_space(request.user, space, self.org_membership):
            raise _forbidden()
        project = services.create_project(organization=self.org, created_by=request.user, **serializer.validated_data)
        return self._detail(project, status.HTTP_201_CREATED)

    @extend_schema(request=ProjectWriteSerializer, responses=ProjectSerializer)
    def partial_update(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        project = self.get_object()
        if not access.can_manage_space(request.user, project.space, self.org_membership):
            raise _forbidden()
        self._write_serializer(project, partial=True).save()
        return self._detail(project)

    def destroy(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        project = self.get_object()
        if not access.can_manage_space(request.user, project.space, self.org_membership):
            raise _forbidden()
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectChildMixin(SpaceScopedMixin):
    """Resolve ``project_id`` from the URL; 404 unless the project's space is visible to the user."""

    project: Project

    def resolve_scope(self, request: Request) -> None:
        super().resolve_scope(request)
        project = (
            Project.objects.filter(space__in=self.get_visible_spaces(), pk=self.kwargs["project_id"])  # type: ignore[attr-defined]
            .select_related("space")
            .first()
        )
        if project is None:
            raise NotFound()
        self.project = project

    def require_manager(self) -> None:
        if not access.can_manage_space(self.request.user, self.project.space, self.org_membership):  # type: ignore[attr-defined]
            raise _forbidden()


class MilestoneViewSet(ProjectChildMixin, viewsets.ModelViewSet):
    queryset = Milestone.objects.none()
    serializer_class = MilestoneSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_scoped_queryset(self) -> QuerySet[Milestone]:
        return (
            Milestone.objects.filter(project=self.project)
            .select_related("overridden_by")
            .annotate(
                task_count=Count("tasks", filter=_OPEN_TASKS),
                completed_task_count=Count("tasks", filter=_DONE_TASKS),
            )
            .order_by("order", "id")
        )

    def _detail(self, milestone: Milestone, code: int = status.HTTP_200_OK) -> Response:
        return Response(self.get_serializer(self.get_queryset().get(pk=milestone.pk)).data, status=code)

    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self.require_manager()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        milestone = services.save_milestone(project=self.project, data=serializer.validated_data)
        return self._detail(milestone, status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self.require_manager()
        milestone = self.get_object()
        serializer = self.get_serializer(milestone, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.save_milestone(project=self.project, data=serializer.validated_data, instance=milestone)
        return self._detail(milestone)

    def destroy(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self.require_manager()
        services.delete_milestone(self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=MilestoneOverrideSerializer, responses=MilestoneSerializer, summary="Pin the status by hand")
    @action(detail=True, methods=["post"])
    def override(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self.require_manager()
        serializer = MilestoneOverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        milestone = services.override_status(
            milestone=self.get_object(), new_status=serializer.validated_data["status"], actor=request.user
        )
        return self._detail(milestone)

    @extend_schema(request=None, responses=MilestoneSerializer, summary="Let the tasks drive the status again")
    @action(detail=True, methods=["post"], url_path="reset-status")
    def reset_status(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self.require_manager()
        milestone = services.reset_status(milestone=self.get_object(), actor=request.user)
        return self._detail(milestone)

    @extend_schema(request=ReorderSerializer, responses={204: None})
    @action(detail=False, methods=["post"])
    def reorder(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self.require_manager()
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reorder(Milestone.objects.filter(project=self.project), serializer.validated_data["ids"])
        return Response(status=status.HTTP_204_NO_CONTENT)
