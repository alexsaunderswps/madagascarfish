from unittest.mock import patch

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.mark.django_db
def test_health_check_returns_200(client: APIClient) -> None:
    response = client.get("/api/v1/health/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert data["database"] == "connected"


@pytest.mark.django_db
def test_health_check_no_auth_required(client: APIClient) -> None:
    """Health check must be accessible without any authentication."""
    response = client.get("/api/v1/health/")
    assert response.status_code == 200


def test_health_check_db_error_returns_503(client: APIClient) -> None:
    with patch("config.views.connection") as mock_conn:
        mock_conn.ensure_connection.side_effect = Exception("db down")
        response = client.get("/api/v1/health/")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "error"


def test_health_check_cache_error_returns_503(client: APIClient) -> None:
    with patch("config.views.cache") as mock_cache:
        mock_cache.set.side_effect = Exception("redis down")
        response = client.get("/api/v1/health/")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["cache"] == "error"
