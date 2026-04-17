"""Unit tests for the FE-07-11 revalidate admin action."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import requests
from django.test import override_settings

from species.admin_revalidate import PUBLIC_PATHS, _post_revalidate


@override_settings(NEXT_REVALIDATE_URL="", NEXT_REVALIDATE_SECRET="secret")
def test_post_revalidate_requires_url_configured() -> None:
    ok, msg = _post_revalidate()
    assert ok is False
    assert "not configured" in msg


@override_settings(NEXT_REVALIDATE_URL="http://fe/api/revalidate", NEXT_REVALIDATE_SECRET="")
def test_post_revalidate_requires_secret_configured() -> None:
    ok, msg = _post_revalidate()
    assert ok is False
    assert "not configured" in msg


@override_settings(
    NEXT_REVALIDATE_URL="http://fe/api/revalidate",
    NEXT_REVALIDATE_SECRET="shh",
    NEXT_REVALIDATE_TIMEOUT_SECONDS=7,
)
def test_post_revalidate_success_reports_count() -> None:
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "ok": True,
        "revalidated": ["/", "/species"],
    }
    with patch("species.admin_revalidate.requests.post", return_value=mock_resp) as p:
        ok, msg = _post_revalidate()

    assert ok is True
    assert "Revalidated 2 path" in msg
    p.assert_called_once()
    kwargs = p.call_args.kwargs
    assert kwargs["json"] == {"paths": PUBLIC_PATHS}
    assert kwargs["headers"] == {"X-Revalidate-Secret": "shh"}
    assert kwargs["timeout"] == 7


@override_settings(NEXT_REVALIDATE_URL="http://fe/api/revalidate", NEXT_REVALIDATE_SECRET="shh")
def test_post_revalidate_reports_timeout() -> None:
    with patch("species.admin_revalidate.requests.post", side_effect=requests.Timeout()):
        ok, msg = _post_revalidate()
    assert ok is False
    assert "timed out" in msg


@override_settings(NEXT_REVALIDATE_URL="http://fe/api/revalidate", NEXT_REVALIDATE_SECRET="shh")
def test_post_revalidate_reports_http_error() -> None:
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "unauthorized"
    with patch("species.admin_revalidate.requests.post", return_value=mock_resp):
        ok, msg = _post_revalidate()
    assert ok is False
    assert "HTTP 401" in msg


@override_settings(NEXT_REVALIDATE_URL="http://fe/api/revalidate", NEXT_REVALIDATE_SECRET="shh")
def test_post_revalidate_reports_network_error() -> None:
    with patch(
        "species.admin_revalidate.requests.post",
        side_effect=requests.ConnectionError("refused"),
    ):
        ok, msg = _post_revalidate()
    assert ok is False
    assert "Revalidate request failed" in msg


@pytest.mark.django_db
@override_settings(NEXT_REVALIDATE_URL="http://fe/api/revalidate", NEXT_REVALIDATE_SECRET="shh")
def test_admin_action_uses_message_user() -> None:
    from django.contrib import admin, messages
    from django.test import RequestFactory

    from species.admin_revalidate import revalidate_public_pages
    from species.models import Species

    modeladmin = MagicMock(spec=admin.ModelAdmin)
    request = RequestFactory().post("/")
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"ok": True, "revalidated": PUBLIC_PATHS}
    with patch("species.admin_revalidate.requests.post", return_value=mock_resp):
        revalidate_public_pages(modeladmin, request, Species.objects.none())
    modeladmin.message_user.assert_called_once()
    _, kwargs = modeladmin.message_user.call_args
    assert kwargs["level"] == messages.SUCCESS
