from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("tasks", views.TaskViewSet, basename="task")

task_router = SimpleRouter()
task_router.register("comments", views.CommentViewSet, basename="task-comment")
task_router.register("attachments", views.AttachmentViewSet, basename="task-attachment")
task_router.register("activity", views.ActivityViewSet, basename="task-activity")

space_router = SimpleRouter()
space_router.register("tags", views.TagViewSet, basename="space-tag")

urlpatterns = [
    path("orgs/<int:org_id>/", include(router.urls)),
    path("orgs/<int:org_id>/tasks/<int:task_id>/", include(task_router.urls)),
    path("orgs/<int:org_id>/spaces/<int:space_id>/", include(space_router.urls)),
]
