import pytest


@pytest.mark.django_db
def test_health_is_public(api_client):
    response = api_client.get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_unauthenticated_error_has_consistent_shape(api_client):
    response = api_client.get("/api/orgs/")
    assert response.status_code == 401
    body = response.json()
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["error"]["code"] == "not_authenticated"


@pytest.mark.django_db
def test_validation_error_shape(api_client):
    response = api_client.post("/api/auth/login/", {"email": "not-an-email"}, format="json")
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "email" in error["details"] and "password" in error["details"]


@pytest.mark.django_db
def test_openapi_schema_renders(api_client):
    response = api_client.get("/api/schema/")
    assert response.status_code == 200
