from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("spaces", views.SpaceViewSet, basename="space")

space_router = SimpleRouter()
space_router.register("members", views.SpaceMemberViewSet, basename="space-member")
space_router.register("states", views.WorkflowStateViewSet, basename="space-state")
space_router.register("fields", views.CustomFieldViewSet, basename="space-field")

urlpatterns = [
    path("orgs/<int:org_id>/", include(router.urls)),
    path("orgs/<int:org_id>/spaces/<int:space_id>/", include(space_router.urls)),
]
