from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.exceptions import ApiError

from . import services
from .cookies import clear_auth_cookies, set_auth_cookies
from .models import User
from .serializers import (
    DetailSerializer,
    EmailSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    RegisterSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)


class PublicAPIView(APIView):
    """Endpoints that must work without (and ignore) any existing session."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(PublicAPIView):
    throttle_classes: list = []

    @extend_schema(responses=DetailSerializer, summary="Set the csrftoken cookie")
    def get(self, request: Request) -> Response:
        return Response({"detail": "ok"})


class RegisterView(PublicAPIView):
    throttle_scope = "register"

    @extend_schema(request=RegisterSerializer, responses={201: DetailSerializer})
    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            user = User.objects.create_user(
                email=data["email"], password=data["password"], full_name=data.get("full_name", "")
            )
            services.issue_verification_code(user)
        return Response(
            {"detail": "Account created. Check your email for the 6-digit verification code."},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(PublicAPIView):
    throttle_scope = "verify"

    @extend_schema(request=VerifyEmailSerializer, responses=DetailSerializer)
    def post(self, request: Request) -> Response:
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.verify_email_code(serializer.validated_data["email"], serializer.validated_data["code"])
        return Response({"detail": "Email verified. You can now sign in."})


class ResendVerificationView(PublicAPIView):
    throttle_scope = "verify"

    @extend_schema(request=EmailSerializer, responses=DetailSerializer)
    def post(self, request: Request) -> Response:
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_verified=False).first()
        if user is not None:
            with transaction.atomic():
                services.issue_verification_code(user)
        return Response({"detail": "If that account is awaiting verification, a new code has been sent."})


class LoginView(PublicAPIView):
    throttle_scope = "login"

    @extend_schema(request=LoginSerializer, responses=UserSerializer)
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            email=serializer.validated_data["email"].strip().lower(),
            password=serializer.validated_data["password"],
        )
        if user is None:
            raise ApiError("invalid_credentials", "Email or password is incorrect.", status.HTTP_401_UNAUTHORIZED)
        if not user.is_verified:
            raise ApiError(
                "email_not_verified", "Verify your email address before signing in.", status.HTTP_403_FORBIDDEN
            )
        update_last_login(User, user)
        response = Response(UserSerializer(user, context={"request": request}).data)
        set_auth_cookies(response, services.issue_session(user))
        return response


class RefreshView(PublicAPIView):
    throttle_classes: list = []

    @extend_schema(request=None, responses=DetailSerializer)
    def post(self, request: Request) -> Response:
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not raw:
            response = Response(
                {"error": {"code": "session_expired", "message": "Sign in again.", "details": {}}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_auth_cookies(response)
            return response
        try:
            _user, refresh = services.rotate_session(raw)
        except ApiError as exc:
            response = Response(
                {"error": {"code": exc.error_code, "message": str(exc.detail), "details": {}}},
                status=exc.status_code,
            )
            clear_auth_cookies(response)
            return response
        response = Response({"detail": "Session refreshed."})
        set_auth_cookies(response, refresh)
        return response


class LogoutView(PublicAPIView):
    throttle_classes: list = []

    @extend_schema(request=None, responses=DetailSerializer)
    def post(self, request: Request) -> Response:
        services.revoke_session(request.COOKIES.get(settings.AUTH_COOKIE_REFRESH))
        response = Response({"detail": "Signed out."})
        clear_auth_cookies(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(responses=UserSerializer)
    def get(self, request: Request) -> Response:
        return Response(UserSerializer(request.user, context={"request": request}).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request: Request) -> Response:
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordResetRequestView(PublicAPIView):
    throttle_scope = "password_reset"

    @extend_schema(request=EmailSerializer, responses=DetailSerializer)
    def post(self, request: Request) -> Response:
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.send_password_reset(serializer.validated_data["email"])
        return Response({"detail": "If an account exists for that email, a reset link has been sent."})


class PasswordResetConfirmView(PublicAPIView):
    throttle_scope = "password_reset"

    @extend_schema(request=PasswordResetConfirmSerializer, responses=DetailSerializer)
    def post(self, request: Request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["new_password"])
        # Proving control of the inbox also proves ownership of the address.
        user.is_verified = True
        user.save(update_fields=["password", "is_verified"])
        return Response({"detail": "Password updated. You can now sign in."})
