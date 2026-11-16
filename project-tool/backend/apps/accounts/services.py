import secrets
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.db.transaction import on_commit
from django.utils import timezone as dj_timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.exceptions import ApiError

from .models import EmailVerificationCode, User
from .tasks import send_email_task

_CODE_SALT = "apps.accounts.email-verification"


def _hash_code(user_id: int, code: str) -> str:
    return salted_hmac(_CODE_SALT, f"{user_id}:{code}").hexdigest()


def send_email(subject: str, body: str, recipients: list[str]) -> None:
    on_commit(lambda: send_email_task.delay(subject, body, recipients))


def issue_verification_code(user: User) -> None:
    """Invalidate older codes, create a new one and email it."""
    now = dj_timezone.now()
    user.verification_codes.filter(consumed_at__isnull=True).update(consumed_at=now)
    code = f"{secrets.randbelow(10**6):06d}"
    EmailVerificationCode.objects.create(
        user=user,
        code_hash=_hash_code(user.pk, code),
        expires_at=now + timedelta(minutes=settings.EMAIL_VERIFICATION_CODE_MINUTES),
    )
    send_email(
        "Your PM Suite verification code",
        f"Your verification code is {code}.\n\n"
        f"It expires in {settings.EMAIL_VERIFICATION_CODE_MINUTES} minutes. "
        "If you did not create an account, ignore this email.",
        [user.email],
    )


def _invalid_code() -> ApiError:
    return ApiError("invalid_code", "The verification code is invalid.")


def verify_email_code(email: str, code: str) -> User:
    user = User.objects.filter(email__iexact=email.strip()).first()
    if user is None:
        raise _invalid_code()
    if user.is_verified:
        return user

    error: ApiError | None = None
    # The error is raised after the block so a failed attempt is still counted.
    with transaction.atomic():
        record = (
            EmailVerificationCode.objects.select_for_update()
            .filter(user=user, consumed_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if record is None:
            error = _invalid_code()
        elif record.is_expired:
            error = ApiError("code_expired", "The verification code has expired. Request a new one.")
        elif record.attempts >= settings.EMAIL_VERIFICATION_MAX_ATTEMPTS:
            error = ApiError("too_many_attempts", "Too many wrong attempts. Request a new code.")
        elif not constant_time_compare(record.code_hash, _hash_code(user.pk, code.strip())):
            record.attempts += 1
            record.save(update_fields=["attempts"])
            error = _invalid_code()
        else:
            record.consumed_at = dj_timezone.now()
            record.save(update_fields=["consumed_at"])
            user.is_verified = True
            user.save(update_fields=["is_verified"])
    if error is not None:
        raise error
    return user


def issue_session(user: User) -> RefreshToken:
    refresh = RefreshToken.for_user(user)
    refresh["auth_time"] = int(datetime.now(tz=timezone.utc).timestamp())
    return refresh


def rotate_session(raw_refresh: str) -> tuple[User, RefreshToken]:
    """Validate a refresh token, enforce SESSION_MAX_HOURS, blacklist it and issue a new one."""
    try:
        old = RefreshToken(raw_refresh)  # verifies signature, expiry and blacklist
    except TokenError as exc:
        raise ApiError("session_expired", "Your session has expired. Sign in again.", status.HTTP_401_UNAUTHORIZED) from exc

    auth_time = int(old.get("auth_time", old["iat"]))
    session_end = auth_time + settings.SESSION_MAX_HOURS * 3600
    now = int(datetime.now(tz=timezone.utc).timestamp())
    if now >= session_end:
        old.blacklist()
        raise ApiError("session_expired", "Your session has expired. Sign in again.", status.HTTP_401_UNAUTHORIZED)

    user = User.objects.filter(pk=old["user_id"], is_active=True).first()
    if user is None:
        raise ApiError("session_expired", "Your session has expired. Sign in again.", status.HTTP_401_UNAUTHORIZED)

    old.blacklist()
    new = RefreshToken.for_user(user)
    new["auth_time"] = auth_time
    new["exp"] = min(int(new["exp"]), session_end)
    return user, new


def revoke_session(raw_refresh: str | None) -> None:
    if not raw_refresh:
        return
    try:
        RefreshToken(raw_refresh).blacklist()
    except TokenError:
        pass


def send_password_reset(email: str) -> None:
    """Email a reset link. Silent when the email is unknown, to avoid account enumeration."""
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if user is None:
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    send_email(
        "Reset your PM Suite password",
        f"Use this link to choose a new password:\n\n{link}\n\n"
        "If you did not ask for this, ignore this email.",
        [user.email],
    )
