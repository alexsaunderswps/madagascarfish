"""CORS surface for the Next.js frontend (Gate 07)."""

import pytest
from django.test import Client, override_settings


@pytest.fixture
def client() -> Client:
    return Client()


@pytest.mark.django_db
def test_cors_preflight_allowed_for_localhost_dev(client: Client) -> None:
    response = client.options(
        "/api/v1/health/",
        HTTP_ORIGIN="http://localhost:3000",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
    )
    assert response.status_code == 200
    assert response["access-control-allow-origin"] == "http://localhost:3000"


@pytest.mark.django_db
@override_settings(
    CORS_ALLOWED_ORIGIN_REGEXES=[r"^https:\/\/[a-z0-9-]+\.vercel\.app$"],
    CORS_ALLOWED_ORIGINS=[],
)
def test_cors_preflight_allowed_for_vercel_preview(client: Client) -> None:
    origin = "https://madagascarfish-git-gate-07-frontend.vercel.app"
    response = client.options(
        "/api/v1/health/",
        HTTP_ORIGIN=origin,
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
    )
    assert response.status_code == 200
    assert response["access-control-allow-origin"] == origin


@pytest.mark.django_db
@override_settings(
    CORS_ALLOWED_ORIGIN_REGEXES=[r"^https:\/\/[a-z0-9-]+\.vercel\.app$"],
    CORS_ALLOWED_ORIGINS=[],
)
def test_cors_preflight_rejects_unknown_origin(client: Client) -> None:
    response = client.options(
        "/api/v1/health/",
        HTTP_ORIGIN="https://evil.example.com",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
    )
    assert "access-control-allow-origin" not in response


@pytest.mark.django_db
@override_settings(
    CORS_ALLOWED_ORIGIN_REGEXES=[r"^https:\/\/[a-z0-9-]+\.vercel\.app$"],
    CORS_ALLOWED_ORIGINS=[],
)
def test_cors_does_not_apply_to_admin(client: Client) -> None:
    """CORS_URLS_REGEX limits CORS to /api/*; admin should not emit CORS headers."""
    response = client.options(
        "/admin/",
        HTTP_ORIGIN="https://madagascarfish-git-gate-07-frontend.vercel.app",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
    )
    assert "access-control-allow-origin" not in response
