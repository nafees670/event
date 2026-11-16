from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import HealthView

api_patterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.organizations.urls")),
    path("", include("apps.spaces.urls")),
    path("", include("apps.projects.urls")),
    path("", include("apps.tasks.urls")),
    path("", include("apps.analytics.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_patterns)),
    # Nginx forwards /media to Django. Only public files (avatars) live here;
    # project files are stored in PRIVATE_STORAGE_ROOT and served via the API.
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]

urlpatterns += staticfiles_urlpatterns()
