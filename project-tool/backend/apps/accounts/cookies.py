"""Helpers to set and clear the auth cookies on a response."""

from datetime import datetime, timezone

from django.conf import settings
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

REFRESH_COOKIE_PATH = "/api/auth/"


def _cookie_kwargs() -> dict:
    return {
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "domain": settings.AUTH_COOKIE_DOMAIN,
    }


def set_auth_cookies(response: Response, refresh: RefreshToken) -> None:
    access = refresh.access_token
    now = datetime.now(tz=timezone.utc).timestamp()
    refresh_max_age = max(int(refresh["exp"] - now), 0)
    access_max_age = max(int(access["exp"] - now), 0)
    kwargs = _cookie_kwargs()
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS, str(access), max_age=access_max_age, httponly=True, path="/", **kwargs
    )
    response.set_cookie(
        settings.AUTH_COOKIE_REFRESH,
        str(refresh),
        max_age=refresh_max_age,
        httponly=True,
        path=REFRESH_COOKIE_PATH,
        **kwargs,
    )
    # Lets the Next.js middleware know a session exists without exposing a token.
    response.set_cookie(
        settings.AUTH_COOKIE_SESSION, "1", max_age=refresh_max_age, httponly=True, path="/", **kwargs
    )


def clear_auth_cookies(response: Response) -> None:
    domain = settings.AUTH_COOKIE_DOMAIN
    samesite = settings.AUTH_COOKIE_SAMESITE
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/", domain=domain, samesite=samesite)
    response.delete_cookie(settings.AUTH_COOKIE_REFRESH, path=REFRESH_COOKIE_PATH, domain=domain, samesite=samesite)
    response.delete_cookie(settings.AUTH_COOKIE_SESSION, path="/", domain=domain, samesite=samesite)
