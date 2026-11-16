from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("orgs", views.OrganizationViewSet, basename="org")

org_router = SimpleRouter()
org_router.register("members", views.MemberViewSet, basename="org-member")
org_router.register("invitations", views.InvitationViewSet, basename="org-invitation")

urlpatterns = [
    path("", include(router.urls)),
    path("orgs/<int:org_id>/", include(org_router.urls)),
    path("invitations/<str:token>/", views.PublicInvitationView.as_view(), name="invitation-public"),
    path("invitations/<str:token>/accept/", views.AcceptInvitationView.as_view(), name="invitation-accept"),
]
