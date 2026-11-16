from django.conf import settings
from rest_framework.test import APIClient

from apps.accounts.services import issue_session


def login(client: APIClient, user) -> APIClient:  # type: ignore[no-untyped-def]
    """Authenticate a client the same way the browser does: with the auth cookies."""
    refresh = issue_session(user)
    client.cookies[settings.AUTH_COOKIE_ACCESS] = str(refresh.access_token)
    client.cookies[settings.AUTH_COOKIE_REFRESH] = str(refresh)
    return client
