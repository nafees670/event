from django.urls import path

from . import views

urlpatterns = [
    path("orgs/<int:org_id>/analytics/", views.AnalyticsView.as_view(), name="analytics"),
]
