from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("projects", views.ProjectViewSet, basename="project")

project_router = SimpleRouter()
project_router.register("milestones", views.MilestoneViewSet, basename="project-milestone")

urlpatterns = [
    path("orgs/<int:org_id>/", include(router.urls)),
    path("orgs/<int:org_id>/projects/<int:project_id>/", include(project_router.urls)),
]
