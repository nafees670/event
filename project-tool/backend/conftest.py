import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.core.tests.factories import OrganizationFactory, UserFactory
from apps.core.tests.utils import login


@pytest.fixture(autouse=True)
def _clear_cache():
    # Throttle counters live in the cache.
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _send_emails_immediately(monkeypatch):
    # Test transactions never commit, so emails queued with on_commit would never go out.
    monkeypatch.setattr("apps.accounts.services.on_commit", lambda callback: callback())
    monkeypatch.setattr("apps.projects.progress.on_commit", lambda callback: callback())


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def make_client():
    def _make(user):  # type: ignore[no-untyped-def]
        return login(APIClient(), user)

    return _make


@pytest.fixture
def user(db):  # type: ignore[no-untyped-def]
    return UserFactory()


@pytest.fixture
def org_with_admin(db):  # type: ignore[no-untyped-def]
    """An organization created through the service, plus its admin."""
    admin = UserFactory()
    org = OrganizationFactory(created_by=admin)
    return org, admin
