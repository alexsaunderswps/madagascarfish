"""Tests for SiteMapAsset model + API (Gate 1 registry redesign S14–S15)."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from rest_framework.test import APIClient

from species.models import SiteMapAsset


def _png_bytes() -> bytes:
    # 1x1 transparent PNG — enough for ImageField to accept it.
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0P\x0f\x00\x05\x01\x01\x02"
        b"\xa5\xf6\r\xe0\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.django_db
class TestSiteMapAssetModel:
    def test_pre_seed_created_exactly_two_rows(self) -> None:
        slots = set(SiteMapAsset.objects.values_list("slot", flat=True))
        assert slots == {"hero_thumb", "profile_panel"}

    def test_slot_uniqueness_enforced_at_db_level(self) -> None:
        with pytest.raises(IntegrityError):
            SiteMapAsset.objects.create(
                slot="hero_thumb", expected_width_px=160, expected_height_px=320
            )

    def test_seed_rows_carry_expected_dimensions(self) -> None:
        hero = SiteMapAsset.objects.get(slot="hero_thumb")
        panel = SiteMapAsset.objects.get(slot="profile_panel")
        assert (hero.expected_width_px, hero.expected_height_px) == (160, 320)
        assert (panel.expected_width_px, panel.expected_height_px) == (180, 360)


@pytest.mark.django_db
class TestSiteMapAssetEndpoint:
    def test_returns_404_when_slot_is_unknown(self) -> None:
        response = APIClient().get("/api/v1/site-map-assets/bogus/")
        assert response.status_code == 404

    def test_returns_404_when_image_is_empty(self) -> None:
        # Pre-seeded rows have no image uploaded.
        response = APIClient().get("/api/v1/site-map-assets/hero_thumb/")
        assert response.status_code == 404

    def test_returns_payload_when_image_uploaded(self) -> None:
        asset = SiteMapAsset.objects.get(slot="hero_thumb")
        asset.image = SimpleUploadedFile("h.png", _png_bytes(), content_type="image/png")
        asset.alt_text = "Madagascar silhouette with highlighted basins"
        asset.credit = "MFFCP"
        asset.save()

        response = APIClient().get("/api/v1/site-map-assets/hero_thumb/")
        assert response.status_code == 200
        body = response.json()
        assert body["alt"] == "Madagascar silhouette with highlighted basins"
        assert body["credit"] == "MFFCP"
        assert body["width"] == 160
        assert body["height"] == 320
        assert body["url"].endswith(".png")

    def test_endpoint_sets_long_cache_control(self) -> None:
        asset = SiteMapAsset.objects.get(slot="profile_panel")
        asset.image = SimpleUploadedFile("p.png", _png_bytes(), content_type="image/png")
        asset.save()
        response = APIClient().get("/api/v1/site-map-assets/profile_panel/")
        assert "public" in response["Cache-Control"]
        assert "max-age=3600" in response["Cache-Control"]


@pytest.mark.django_db
class TestSiteMapAssetAdminRevalidate:
    def test_admin_save_invokes_revalidate_hook(self, admin_user) -> None:
        client = APIClient()
        client.force_authenticate(admin_user)
        client.force_login(admin_user)

        asset = SiteMapAsset.objects.get(slot="hero_thumb")

        with patch("species.admin._post_revalidate", return_value=(True, "ok")) as mock:
            client.post(
                f"/admin/species/sitemapasset/{asset.pk}/change/",
                {
                    "slot": "hero_thumb",
                    "expected_width_px": 160,
                    "expected_height_px": 320,
                    "alt_text": "",
                    "credit": "",
                    "usage_notes": "",
                    "_save": "Save",
                },
                follow=True,
            )
            assert mock.called


@pytest.fixture
def admin_user(db):
    from accounts.models import User

    return User.objects.create_superuser(email="admin-smt@example.com", password="pw-smt-12345")
