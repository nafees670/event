"""Consistent API error format.

Every error response has the shape::

    {"error": {"code": "<machine_code>", "message": "<human text>", "details": {...}}}
"""

from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ApiError(exceptions.APIException):
    """An API error with an explicit machine-readable code."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail=message, code=code)
        self.status_code = status_code
        self.error_code = code
        self.details = details or {}


class NoSpaceAssigned(ApiError):
    def __init__(self) -> None:
        super().__init__(
            code="no_space_assigned",
            message="You are not assigned to a space yet. Ask an organization admin to add you to one.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


_STATUS_CODES = {
    status.HTTP_400_BAD_REQUEST: "bad_request",
    status.HTTP_401_UNAUTHORIZED: "not_authenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_429_TOO_MANY_REQUESTS: "throttled",
}


def _first_message(detail: Any) -> str:
    if isinstance(detail, list) and detail:
        return _first_message(detail[0])
    if isinstance(detail, dict) and detail:
        return _first_message(next(iter(detail.values())))
    return str(detail)


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ApiError):
        code, message, details = exc.error_code, str(exc.detail), exc.details
    elif isinstance(exc, exceptions.ValidationError):
        code = "validation_error"
        details = exc.detail if isinstance(exc.detail, dict) else {"non_field_errors": exc.detail}
        message = _first_message(exc.detail)
    else:
        detail = getattr(exc, "detail", response.data)
        message = _first_message(detail)
        codes = exc.get_codes() if isinstance(exc, exceptions.APIException) else None
        code = codes if isinstance(codes, str) else _STATUS_CODES.get(response.status_code, "error")
        details = {}
        if isinstance(exc, exceptions.Throttled) and exc.wait is not None:
            details = {"retry_after_seconds": int(exc.wait)}

    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
