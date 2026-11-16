import mimetypes
from datetime import timedelta

import django_filters
from django.db.models import Count, Prefetch, QuerySet
from django.http import FileResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.core.exceptions import ApiError
from apps.core.pagination import StandardPagination
from apps.organizations import access
from apps.organizations.mixins import SpaceChildMixin, SpaceScopedMixin
from apps.organizations.permissions import CanManageSpaceOrReadOnly
from apps.projects.models import Project
from apps.spaces.models import SpaceMembership, StateCategory, WorkflowState

from . import services
from .models import ActivityLog, ActivityVerb, Attachment, Comment, Tag, Task
from .serializers import (
    ActivitySerializer,
    AttachmentSerializer,
    AttachmentUploadSerializer,
    CommentSerializer,
    TagSerializer,
    TaskMoveSerializer,
    TaskSerializer,
    TaskWriteSerializer,
)


def _forbidden(message: str = "You can't change this task.") -> ApiError:
    return ApiError("permission_denied", message, status.HTTP_403_FORBIDDEN)


class TaskPagination(StandardPagination):
    # The board loads a whole space at once.
    page_size = 100
    max_page_size = 500


class TaskFilter(django_filters.FilterSet):
    space = django_filters.NumberFilter(field_name="space_id")
    project = django_filters.BaseInFilter(field_name="project_id")
    state = django_filters.NumberFilter(field_name="state_id")
    category = django_filters.BaseInFilter(field_name="state__category")
    milestone = django_filters.NumberFilter(field_name="milestone_id")
    priority = django_filters.BaseInFilter(field_name="priority")
    tag = django_filters.BaseInFilter(field_name="tags", distinct=True)
    assignee = django_filters.CharFilter(method="filter_assignee", help_text='A user id, "me" or "none".')
    due_after = django_filters.DateFilter(field_name="due_date", lookup_expr="gte")
    due_before = django_filters.DateFilter(field_name="due_date", lookup_expr="lte")
    due = django_filters.ChoiceFilter(
        method="filter_due", choices=[("overdue", "Overdue"), ("week", "Due in 7 days"), ("none", "No due date")]
    )

    class Meta:
        model = Task
        fields: list[str] = []

    def filter_assignee(self, queryset: QuerySet[Task], name: str, value: str) -> QuerySet[Task]:
        if value == "none":
            return queryset.filter(assignees__isnull=True)
        if value == "me":
            return queryset.filter(assignees=self.request.user).distinct()
        ids = [int(v) for v in value.split(",") if v.strip().isdigit()]
        return queryset.filter(assignees__in=ids).distinct() if ids else queryset.none()

    def filter_due(self, queryset: QuerySet[Task], name: str, value: str) -> QuerySet[Task]:
        today = timezone.localdate()
        if value == "none":
            return queryset.filter(due_date__isnull=True)
        open_tasks = queryset.exclude(state__category__in=[StateCategory.COMPLETED, StateCategory.CANCELLED])
        if value == "overdue":
            return open_tasks.filter(due_date__lt=today)
        return open_tasks.filter(due_date__gte=today, due_date__lte=today + timedelta(days=7))


def task_queryset(spaces: QuerySet) -> QuerySet[Task]:  # type: ignore[type-arg]
    return (
        Task.objects.filter(space__in=spaces)
        .select_related("space", "project", "state", "milestone", "created_by")
        .prefetch_related(
            Prefetch("assignees", queryset=User.objects.order_by("full_name", "email")),
            "tags",
        )
        .annotate(
            comment_count=Count("comments", distinct=True),
            attachment_count=Count("attachments", distinct=True),
        )
    )


class TaskViewSet(SpaceScopedMixin, viewsets.ModelViewSet):
    """Tasks of every space the user can see. Filter with ``?space=`` for one board."""

    queryset = Task.objects.none()
    serializer_class = TaskSerializer
    pagination_class = TaskPagination
    filterset_class = TaskFilter
    search_fields = ["title", "description"]
    ordering_fields = ["position", "created_at", "updated_at", "due_date", "priority", "number"]
    ordering = ["position", "id"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_scoped_queryset(self) -> QuerySet[Task]:
        return task_queryset(self.get_visible_spaces())

    def get_serializer_context(self):  # type: ignore[no-untyped-def]
        context = super().get_serializer_context()
        if hasattr(self, "org_membership"):
            context["org_membership"] = self.org_membership
            context["space_roles"] = dict(
                SpaceMembership.objects.filter(user=self.request.user, space__organization=self.org).values_list(
                    "space_id", "role"
                )
            )
        return context

    def _write_serializer(self, instance: Task | None = None) -> TaskWriteSerializer:
        projects = Project.objects.filter(space__in=self.get_visible_spaces()).select_related("space")
        serializer = TaskWriteSerializer(
            instance, data=self.request.data, partial=instance is not None, context={"projects": projects}
        )
        serializer.is_valid(raise_exception=True)
        return serializer

    def _detail(self, task: Task, code: int = status.HTTP_200_OK) -> Response:
        return Response(self.get_serializer(self.get_queryset().get(pk=task.pk)).data, status=code)

    def _require_edit(self, task: Task) -> None:
        if not access.can_edit_task(self.request.user, task, self.org_membership):
            raise _forbidden("You can only change tasks you created or are assigned to.")

    @extend_schema(request=TaskWriteSerializer, responses={201: TaskSerializer})
    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        serializer = self._write_serializer()
        data = dict(serializer.validated_data)
        project: Project = data.pop("project")
        if not access.can_contribute(request.user, project.space, self.org_membership):
            raise _forbidden("Guests can't create tasks.")
        task = services.create_task(project=project, actor=request.user, data=data)
        return self._detail(task, status.HTTP_201_CREATED)

    @extend_schema(request=TaskWriteSerializer, responses=TaskSerializer)
    def partial_update(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        task = self.get_object()
        self._require_edit(task)
        serializer = self._write_serializer(task)
        services.update_task(task=task, actor=request.user, data=dict(serializer.validated_data))
        return self._detail(task)

    def destroy(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        task = self.get_object()
        is_manager = access.can_manage_space(request.user, task.space, self.org_membership)
        is_creator = task.created_by_id == request.user.pk and access.can_contribute(
            request.user, task.space, self.org_membership
        )
        if not (is_manager or is_creator):
            raise _forbidden("Only managers and the task's creator can delete it.")
        services.delete_task(task=task, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=TaskMoveSerializer, responses=TaskSerializer)
    @action(detail=True, methods=["post"])
    def move(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        task = self.get_object()
        self._require_edit(task)
        serializer = TaskMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "state_id" in data:
            state = WorkflowState.objects.filter(space=task.space, pk=data["state_id"]).first()
            if state is None:
                raise ApiError("invalid_state", "Pick a state of this task's space.")
        else:
            state = services.state_for_category(task.space, data["category"])
        services.move_task(
            task=task, actor=request.user, state=state, after_id=data.get("after_id"), before_id=data.get("before_id")
        )
        return self._detail(task)


class TaskChildMixin(SpaceScopedMixin):
    """Resolve ``task_id`` from the URL; 404 unless its space is visible to the user."""

    task: Task

    def resolve_scope(self, request: Request) -> None:
        super().resolve_scope(request)
        task = (
            Task.objects.filter(space__in=self.get_visible_spaces(), pk=self.kwargs["task_id"])  # type: ignore[attr-defined]
            .select_related("space", "project")
            .first()
        )
        if task is None:
            raise NotFound()
        self.task = task

    def require_contributor(self) -> None:
        if not access.can_contribute(self.request.user, self.task.space, self.org_membership):  # type: ignore[attr-defined]
            raise _forbidden("Guests can only read.")

    def is_manager(self) -> bool:
        return access.can_manage_space(self.request.user, self.task.space, self.org_membership)  # type: ignore[attr-defined]


class CommentViewSet(TaskChildMixin, viewsets.ModelViewSet):
    queryset = Comment.objects.none()
    serializer_class = CommentSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_scoped_queryset(self) -> QuerySet[Comment]:
        return Comment.objects.filter(task=self.task).select_related("author")

    def perform_create(self, serializer: CommentSerializer) -> None:
        self.require_contributor()
        comment = serializer.save(task=self.task, author=self.request.user)
        services.log(self.task, self.request.user, ActivityVerb.COMMENTED, new=comment.body[:200])

    def perform_update(self, serializer: CommentSerializer) -> None:
        if serializer.instance.author_id != self.request.user.pk:
            raise _forbidden("You can only edit your own comments.")
        serializer.save(edited_at=timezone.now())

    def perform_destroy(self, instance: Comment) -> None:
        if instance.author_id != self.request.user.pk and not self.is_manager():
            raise _forbidden("You can only delete your own comments.")
        instance.delete()


class AttachmentViewSet(
    TaskChildMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Attachment.objects.none()
    serializer_class = AttachmentSerializer
    pagination_class = None
    parser_classes = [MultiPartParser]

    def get_scoped_queryset(self) -> QuerySet[Attachment]:
        return Attachment.objects.filter(task=self.task).select_related("uploaded_by", "task__space")

    @extend_schema(request={"multipart/form-data": AttachmentUploadSerializer}, responses={201: AttachmentSerializer})
    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        self.require_contributor()
        upload = AttachmentUploadSerializer(data=request.data)
        upload.is_valid(raise_exception=True)
        file = upload.validated_data["file"]
        filename = (file.name or "file").replace("/", "_").replace("\\", "_")[:255]
        attachment = Attachment(
            task=self.task,
            filename=filename,
            size=file.size,
            content_type=(file.content_type or mimetypes.guess_type(filename)[0] or "")[:120],
            uploaded_by=request.user,
        )
        attachment.file.save(filename, file, save=False)
        attachment.save()
        services.log(self.task, request.user, ActivityVerb.ATTACHED, new=filename)
        return Response(self.get_serializer(attachment).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance: Attachment) -> None:
        if instance.uploaded_by_id != self.request.user.pk and not self.is_manager():
            raise _forbidden("You can only remove files you uploaded.")
        instance.file.delete(save=False)
        instance.delete()
        services.log(self.task, self.request.user, ActivityVerb.DETACHED, old=instance.filename)

    @extend_schema(responses={(200, "application/octet-stream"): bytes})
    @action(detail=True, methods=["get"])
    def download(self, request: Request, *args, **kwargs) -> FileResponse:  # type: ignore[no-untyped-def]
        attachment = self.get_object()
        try:
            handle = attachment.file.open("rb")
        except FileNotFoundError as exc:
            raise NotFound("The file is missing from storage.") from exc
        # Always a download (never rendered inline), so uploaded HTML/SVG can't run on our origin.
        response = FileResponse(handle, as_attachment=True, filename=attachment.filename)
        response["Content-Type"] = "application/octet-stream"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ActivityViewSet(TaskChildMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = ActivityLog.objects.none()
    serializer_class = ActivitySerializer

    def get_scoped_queryset(self) -> QuerySet[ActivityLog]:
        return ActivityLog.objects.filter(task=self.task).select_related("actor")


class TagViewSet(SpaceChildMixin, viewsets.ModelViewSet):
    """Tags of a space. Contributors create them; managers rename and delete."""

    queryset = Tag.objects.none()
    serializer_class = TagSerializer
    pagination_class = None
    permission_classes = [IsAuthenticated, CanManageSpaceOrReadOnly]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["name"]

    def get_permissions(self):  # type: ignore[no-untyped-def]
        # Creating a tag is part of everyday task work, so it isn't limited to managers.
        if self.action == "create":
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_scoped_queryset(self) -> QuerySet[Tag]:
        return Tag.objects.filter(space=self.space).annotate(task_count=Count("tasks"))

    def get_serializer_context(self):  # type: ignore[no-untyped-def]
        context = super().get_serializer_context()
        if hasattr(self, "space"):
            context["space"] = self.space
        return context

    def perform_create(self, serializer: TagSerializer) -> None:
        if not access.can_contribute(self.request.user, self.space, self.org_membership):
            raise _forbidden("Guests can't create tags.")
        serializer.save(space=self.space)

