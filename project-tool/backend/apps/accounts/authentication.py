from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):  # type: ignore[no-untyped-def]
        return reason


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticate with the access token in the httpOnly cookie.

    Because the browser sends cookies automatically, unsafe requests must also
    pass Django's CSRF check (double-submit of the ``csrftoken`` cookie).
    """

    def authenticate(self, request: Request):  # type: ignore[no-untyped-def]
        raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if not raw_token:
            return None
        validated = self.get_validated_token(raw_token.encode())
        user = self.get_user(validated)
        if not user.is_verified:
            raise exceptions.AuthenticationFailed("Email address is not verified.", code="email_not_verified")
        self.enforce_csrf(request)
        return user, validated

    def enforce_csrf(self, request: Request) -> None:
        check = _CSRFCheck(lambda req: None)  # type: ignore[arg-type,return-value]
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF failed: {reason}", code="csrf_failed")

    def authenticate_header(self, request: Request) -> str:
        # Makes DRF answer 401 (not 403) when credentials are missing or invalid.
        return 'Cookie realm="api"'
