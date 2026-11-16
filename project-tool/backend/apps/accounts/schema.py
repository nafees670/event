from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.CookieJWTAuthentication"
    name = "cookieAuth"

    def get_security_definition(self, auto_schema):  # type: ignore[no-untyped-def]
        return {"type": "apiKey", "in": "cookie", "name": settings.AUTH_COOKIE_ACCESS}
