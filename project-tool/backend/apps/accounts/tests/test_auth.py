import re
from datetime import timedelta

import pytest
from django.conf import settings
from django.core import mail
from freezegun import freeze_time
from rest_framework.test import APIClient

from apps.accounts.models import EmailVerificationCode, User
from apps.core.tests.factories import PASSWORD, UserFactory
from apps.core.tests.utils import login

pytestmark = pytest.mark.django_db

STRONG_PASSWORD = "Correct-Horse-42"


def register(client: APIClient, email: str = "new@example.test") -> str:
    """Register and return the code from the verification email."""
    mail.outbox.clear()
    response = client.post(
        "/api/auth/register/", {"email": email, "password": STRONG_PASSWORD, "full_name": "New Person"}, format="json"
    )
    assert response.status_code == 201, response.json()
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


def do_login(client: APIClient, email: str, password: str = STRONG_PASSWORD):  # type: ignore[no-untyped-def]
    return client.post("/api/auth/login/", {"email": email, "password": password}, format="json")


class TestRegistrationAndVerification:
    def test_full_flow_register_verify_login(self, api_client):
        code = register(api_client, "Mixed.Case@Example.test")
        user = User.objects.get(email="mixed.case@example.test")
        assert not user.is_verified
        assert EmailVerificationCode.objects.get(user=user).code_hash != code  # only a hash is stored

        assert do_login(api_client, "mixed.case@example.test").json()["error"]["code"] == "email_not_verified"

        response = api_client.post("/api/auth/verify-email/", {"email": user.email, "code": code}, format="json")
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.is_verified

        response = do_login(api_client, user.email)
        assert response.status_code == 200
        assert response.json()["email"] == user.email
        for name in (settings.AUTH_COOKIE_ACCESS, settings.AUTH_COOKIE_REFRESH, settings.AUTH_COOKIE_SESSION):
            cookie = response.cookies[name]
            assert cookie["httponly"] and cookie["secure"]
            assert cookie["samesite"] == "Lax"
        assert response.cookies[settings.AUTH_COOKIE_REFRESH]["path"] == "/api/auth/"

        assert api_client.get("/api/auth/me/").json()["email"] == user.email

    def test_duplicate_email_rejected(self, api_client):
        UserFactory(email="taken@example.test")
        response = api_client.post(
            "/api/auth/register/", {"email": "TAKEN@example.test", "password": STRONG_PASSWORD}, format="json"
        )
        assert response.status_code == 400
        assert "email" in response.json()["error"]["details"]

    def test_weak_password_rejected(self, api_client):
        response = api_client.post("/api/auth/register/", {"email": "a@example.test", "password": "123"}, format="json")
        assert response.status_code == 400
        assert "non_field_errors" in response.json()["error"]["details"] or "password" in str(response.json())

    def test_wrong_code_counts_attempts_then_locks(self, api_client):
        code = register(api_client)
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(settings.EMAIL_VERIFICATION_MAX_ATTEMPTS):
            response = api_client.post("/api/auth/verify-email/", {"email": "new@example.test", "code": wrong}, format="json")
            assert response.json()["error"]["code"] == "invalid_code"
        assert EmailVerificationCode.objects.get().attempts == settings.EMAIL_VERIFICATION_MAX_ATTEMPTS
        response = api_client.post("/api/auth/verify-email/", {"email": "new@example.test", "code": code}, format="json")
        assert response.json()["error"]["code"] == "too_many_attempts"

    def test_expired_code(self, api_client):
        code = register(api_client)
        with freeze_time(timedelta(minutes=settings.EMAIL_VERIFICATION_CODE_MINUTES + 1)):
            response = api_client.post("/api/auth/verify-email/", {"email": "new@example.test", "code": code}, format="json")
        assert response.json()["error"]["code"] == "code_expired"

    def test_resend_invalidates_previous_code(self, api_client):
        old_code = register(api_client)
        api_client.post("/api/auth/resend-verification/", {"email": "new@example.test"}, format="json")
        new_code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        if old_code != new_code:
            response = api_client.post(
                "/api/auth/verify-email/", {"email": "new@example.test", "code": old_code}, format="json"
            )
            assert response.status_code == 400
        response = api_client.post("/api/auth/verify-email/", {"email": "new@example.test", "code": new_code}, format="json")
        assert response.status_code == 200

    def test_resend_does_not_reveal_unknown_email(self, api_client):
        response = api_client.post("/api/auth/resend-verification/", {"email": "nobody@example.test"}, format="json")
        assert response.status_code == 200
        assert len(mail.outbox) == 0


class TestLoginSession:
    def test_wrong_password(self, api_client):
        user = UserFactory()
        response = do_login(api_client, user.email, "wrong-password")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "invalid_credentials"

    def test_refresh_rotates_and_blacklists_old_token(self, api_client):
        user = UserFactory()
        do_login(api_client, user.email, PASSWORD)
        old_refresh = api_client.cookies[settings.AUTH_COOKIE_REFRESH].value

        response = api_client.post("/api/auth/refresh/")
        assert response.status_code == 200
        new_refresh = response.cookies[settings.AUTH_COOKIE_REFRESH].value
        assert new_refresh and new_refresh != old_refresh

        replay = APIClient()
        replay.cookies[settings.AUTH_COOKIE_REFRESH] = old_refresh
        response = replay.post("/api/auth/refresh/")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "session_expired"

    def test_session_cannot_outlive_session_max_hours(self, api_client):
        user = UserFactory()
        do_login(api_client, user.email, PASSWORD)
        with freeze_time(timedelta(hours=settings.SESSION_MAX_HOURS - 1)):
            assert api_client.post("/api/auth/refresh/").status_code == 200
        with freeze_time(timedelta(hours=settings.SESSION_MAX_HOURS, minutes=1)):
            response = api_client.post("/api/auth/refresh/")
        assert response.status_code == 401
        assert response.cookies[settings.AUTH_COOKIE_SESSION].value == ""

    def test_logout_clears_cookies_and_revokes_refresh(self, api_client):
        user = UserFactory()
        do_login(api_client, user.email, PASSWORD)
        refresh = api_client.cookies[settings.AUTH_COOKIE_REFRESH].value
        response = api_client.post("/api/auth/logout/")
        assert response.status_code == 200
        assert response.cookies[settings.AUTH_COOKIE_ACCESS].value == ""

        replay = APIClient()
        replay.cookies[settings.AUTH_COOKIE_REFRESH] = refresh
        assert replay.post("/api/auth/refresh/").status_code == 401

    def test_me_requires_auth(self, api_client):
        assert api_client.get("/api/auth/me/").status_code == 401

    def test_unverified_access_token_is_rejected(self, make_client):
        user = UserFactory(is_verified=False)
        assert make_client(user).get("/api/auth/me/").status_code == 401

    def test_csrf_enforced_for_cookie_auth(self, user):
        client = login(APIClient(enforce_csrf_checks=True), user)
        response = client.patch("/api/auth/me/", {"full_name": "X"}, format="json")
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "csrf_failed"

        client.get("/api/auth/csrf/")
        token = client.cookies["csrftoken"].value
        response = client.patch("/api/auth/me/", {"full_name": "X"}, format="json", HTTP_X_CSRFTOKEN=token)
        assert response.status_code == 200
        assert response.json()["full_name"] == "X"


class TestRateLimits:
    def test_login_is_rate_limited(self, api_client):
        limit = int(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["login"].split("/")[0])
        for _ in range(limit):
            do_login(api_client, "x@example.test", "nope")
        response = do_login(api_client, "x@example.test", "nope")
        assert response.status_code == 429
        assert response.json()["error"]["code"] == "throttled"

    def test_register_is_rate_limited(self, api_client):
        limit = int(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["register"].split("/")[0])
        for i in range(limit):
            api_client.post("/api/auth/register/", {"email": f"r{i}@example.test", "password": "x"}, format="json")
        response = api_client.post("/api/auth/register/", {"email": "z@example.test", "password": "x"}, format="json")
        assert response.status_code == 429

    def test_verify_is_rate_limited(self, api_client):
        limit = int(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["verify"].split("/")[0])
        payload = {"email": "x@example.test", "code": "123456"}
        for _ in range(limit):
            api_client.post("/api/auth/verify-email/", payload, format="json")
        assert api_client.post("/api/auth/verify-email/", payload, format="json").status_code == 429


class TestPasswordReset:
    def test_reset_flow(self, api_client):
        user = UserFactory()
        response = api_client.post("/api/auth/password-reset/", {"email": user.email}, format="json")
        assert response.status_code == 200
        link = re.search(r"uid=(\S+)&token=(\S+)", mail.outbox[-1].body)
        uid, token = link.group(1), link.group(2)

        response = api_client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "new_password": "Brand-New-Pass-9"},
            format="json",
        )
        assert response.status_code == 200
        assert do_login(api_client, user.email, "Brand-New-Pass-9").status_code == 200

        # Token is single-use: the password hash changed, so it no longer validates.
        response = api_client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": uid, "token": token, "new_password": "Another-Pass-77"},
            format="json",
        )
        assert response.status_code == 400

    def test_unknown_email_is_silent(self, api_client):
        response = api_client.post("/api/auth/password-reset/", {"email": "ghost@example.test"}, format="json")
        assert response.status_code == 200
        assert len(mail.outbox) == 0

    def test_bad_token(self, api_client):
        response = api_client.post(
            "/api/auth/password-reset/confirm/",
            {"uid": "MQ", "token": "bad-token", "new_password": "Brand-New-Pass-9"},
            format="json",
        )
        assert response.status_code == 400
