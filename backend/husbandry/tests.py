"""Gate 08 acceptance tests — husbandry backend.

Mirrors the AC list in docs/planning/specs/gate-08-husbandry-backend.md
§ Acceptance Criteria. Hits the real database (per project convention —
no mocks for DB). Adversarial coverage per the Test Writer Guidance
section of the spec.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from accounts.models import User
from husbandry.models import REVIEW_STALE_AFTER_DAYS, HusbandrySource, SpeciesHusbandry
from species.models import Species

pytestmark = pytest.mark.django_db


# ---- Fixtures ------------------------------------------------------------


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def species() -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def other_species() -> Species:
    return Species.objects.create(
        scientific_name="Pachypanchax sakaramyi",
        taxonomic_status="described",
        family="Aplocheilidae",
        genus="Pachypanchax",
        endemic_status="endemic",
        iucn_status="EN",
    )


@pytest.fixture
def reviewer() -> User:
    return User.objects.create_user(
        email="reviewer@example.com",
        password="securepass12345",
        name="Dr. Reviewer",
        access_tier=5,
        is_active=True,
        orcid_id="0000-0002-1825-0097",
    )


def _make_published(species: Species, reviewer: User, **overrides) -> SpeciesHusbandry:
    """Helper: build a valid publishable husbandry record with one source."""
    defaults = dict(
        species=species,
        published=True,
        last_reviewed_by=reviewer,
        last_reviewed_at=date.today() - timedelta(days=30),
        narrative="Keeps well in species-only tanks with moderate flow.",
    )
    defaults.update(overrides)
    record = SpeciesHusbandry.objects.create(**defaults)
    HusbandrySource.objects.create(
        husbandry=record,
        label="Smith 2025 — captive husbandry notes.",
        url="https://example.org/smith-2025",
    )
    return record


# ---- AC-08.1 Model shape matches template -------------------------------


def test_ac_1_model_has_all_template_fields():
    """Every non-metadata template field maps to a SpeciesHusbandry column."""
    expected_fields = {
        # Water
        "water_temp_c_min",
        "water_temp_c_max",
        "water_ph_min",
        "water_ph_max",
        "water_hardness_dgh_min",
        "water_hardness_dgh_max",
        "water_hardness_dkh_min",
        "water_hardness_dkh_max",
        "water_flow",
        "water_notes",
        # Tank
        "tank_min_volume_liters",
        "tank_min_footprint_cm",
        "tank_aquascape",
        "tank_substrate",
        "tank_cover",
        "tank_notes",
        # Diet
        "diet_accepted_foods",
        "diet_live_food_required",
        "diet_feeding_frequency",
        "diet_notes",
        # Behavior
        "behavior_temperament",
        "behavior_recommended_sex_ratio",
        "behavior_schooling",
        "behavior_community_compatibility",
        "behavior_notes",
        # Breeding
        "breeding_spawning_mode",
        "breeding_triggers",
        "breeding_egg_count_typical",
        "breeding_fry_care",
        "breeding_survival_bottlenecks",
        "breeding_notes",
        # Difficulty — 7 factor fields, no aggregate
        "difficulty_adult_size",
        "difficulty_space_demand",
        "difficulty_temperament_challenge",
        "difficulty_water_parameter_demand",
        "difficulty_dietary_specialization",
        "difficulty_breeding_complexity",
        "difficulty_other",
        # Sourcing
        "sourcing_cares_registered_breeders",
        "sourcing_notes",
        # Narrative + governance
        "narrative",
        "contributors",
        "last_reviewed_by",
        "last_reviewed_at",
    }
    model_fields = {f.name for f in SpeciesHusbandry._meta.get_fields()}
    missing = expected_fields - model_fields
    assert not missing, f"Template fields missing from model: {missing}"


# ---- AC-08.2 No aggregate difficulty column -----------------------------


def test_ac_2_no_aggregate_difficulty_field():
    """There must be no `difficulty` column — factors only."""
    field_names = {f.name for f in SpeciesHusbandry._meta.get_fields()}
    assert "difficulty" not in field_names
    # Confirm the seven factor columns are present.
    factor_fields = [f for f in field_names if f.startswith("difficulty_")]
    assert len(factor_fields) == 7, f"Expected 7 difficulty_* columns, got {factor_fields}"


# ---- AC-08.3 Publish without source rejected ----------------------------


def test_ac_3_publish_without_source_rejected(species, reviewer):
    """Admin.save_related: publishing with zero sources must raise ValidationError."""
    from django.contrib.admin.sites import AdminSite

    from husbandry.admin import SpeciesHusbandryAdmin

    record = SpeciesHusbandry.objects.create(
        species=species,
        published=True,
        last_reviewed_by=reviewer,
        last_reviewed_at=date.today(),
    )
    # No sources attached. Simulate admin save_related.
    admin_instance = SpeciesHusbandryAdmin(SpeciesHusbandry, AdminSite())

    class _FormStub:
        def __init__(self, instance):
            self.instance = instance

        def save_m2m(self):
            return None

    # Build a fake request with a messages-framework backend attached.
    from django.contrib.messages.storage.fallback import FallbackStorage
    from django.http import HttpRequest

    request = HttpRequest()
    request.session = {}  # type: ignore[assignment]
    request._messages = FallbackStorage(request)  # type: ignore[attr-defined]

    with pytest.raises(ValidationError):
        admin_instance.save_related(request, _FormStub(record), [], change=True)

    # And the published flag should have been reverted.
    record.refresh_from_db()
    assert record.published is False


# ---- AC-08.4 Publish without reviewer rejected --------------------------


def test_ac_4_publish_without_reviewer_rejected_model_level(species):
    """Model clean() rejects published=True with missing reviewer fields."""
    record = SpeciesHusbandry(species=species, published=True)
    with pytest.raises(ValidationError) as exc:
        record.clean()
    assert "last_reviewed_by" in exc.value.message_dict
    assert "last_reviewed_at" in exc.value.message_dict


def test_ac_4_publish_with_reviewer_but_no_date_rejected(species, reviewer):
    record = SpeciesHusbandry(
        species=species,
        published=True,
        last_reviewed_by=reviewer,
        last_reviewed_at=None,
    )
    with pytest.raises(ValidationError) as exc:
        record.clean()
    assert "last_reviewed_at" in exc.value.message_dict


def test_ac_4_unpublished_never_validates_governance(species):
    """Unpublished drafts can have any shape — no governance gate."""
    record = SpeciesHusbandry(species=species, published=False)
    # Should not raise.
    record.clean()


# ---- AC-08.5 Unpublished drafts 404 + has_husbandry=false ---------------


def test_ac_5_unpublished_draft_returns_404(api_client, species, reviewer):
    """A draft record with complete governance + source must still 404."""
    record = SpeciesHusbandry.objects.create(
        species=species,
        published=False,  # draft
        last_reviewed_by=reviewer,
        last_reviewed_at=date.today(),
    )
    HusbandrySource.objects.create(husbandry=record, label="A real source")

    resp = api_client.get(f"/api/v1/species/{species.pk}/husbandry/")
    assert resp.status_code == 404
    # Adversarial: must NOT leak `published: false` in body.
    assert b"published" not in resp.content


def test_ac_5_has_husbandry_false_for_draft(api_client, species, reviewer):
    SpeciesHusbandry.objects.create(
        species=species,
        published=False,
        last_reviewed_by=reviewer,
        last_reviewed_at=date.today(),
    )
    resp = api_client.get(f"/api/v1/species/{species.pk}/")
    assert resp.status_code == 200
    assert resp.json()["has_husbandry"] is False


def test_ac_5_no_record_returns_404_and_has_husbandry_false(api_client, species):
    """Species with no husbandry row at all: 404 on husbandry, false flag on detail."""
    resp = api_client.get(f"/api/v1/species/{species.pk}/husbandry/")
    assert resp.status_code == 404

    detail = api_client.get(f"/api/v1/species/{species.pk}/")
    assert detail.status_code == 200
    assert detail.json()["has_husbandry"] is False


# ---- AC-08.6 Published record readable by Tier 1 ------------------------


def test_ac_6_published_record_returns_200_with_full_payload(
    api_client, species, reviewer
):
    _make_published(species, reviewer)

    resp = api_client.get(f"/api/v1/species/{species.pk}/husbandry/")
    assert resp.status_code == 200
    body = resp.json()

    # Shape assertions — spec calls for these specific keys.
    assert "narrative" in body
    assert "sources" in body and len(body["sources"]) == 1
    assert body["sources"][0]["label"].startswith("Smith 2025")
    assert body["last_reviewed_by"]["name"] == "Dr. Reviewer"
    assert body["last_reviewed_by"]["orcid_id"] == "0000-0002-1825-0097"
    assert "last_reviewed_at" in body
    assert "review_is_stale" in body
    assert body["review_is_stale"] is False
    # Adversarial: `published` must never be exposed.
    assert "published" not in body


def test_ac_6_has_husbandry_true_on_species_detail(api_client, species, reviewer):
    _make_published(species, reviewer)
    resp = api_client.get(f"/api/v1/species/{species.pk}/")
    assert resp.status_code == 200
    assert resp.json()["has_husbandry"] is True


# ---- AC-08.7 Stale review surfaced --------------------------------------


def test_ac_7_review_is_stale_when_older_than_24_months(api_client, species, reviewer):
    # 25 months ago — stale.
    stale_date = date.today() - timedelta(days=REVIEW_STALE_AFTER_DAYS + 10)
    _make_published(species, reviewer, last_reviewed_at=stale_date)

    resp = api_client.get(f"/api/v1/species/{species.pk}/husbandry/")
    assert resp.status_code == 200
    assert resp.json()["review_is_stale"] is True


def test_ac_7_review_exactly_730_days_old_is_not_stale(species, reviewer):
    """Boundary: exactly 730 days ago is the edge — not yet stale."""
    boundary = date.today() - timedelta(days=REVIEW_STALE_AFTER_DAYS)
    record = _make_published(species, reviewer, last_reviewed_at=boundary)
    assert record.review_is_stale is False


def test_ac_7_review_731_days_old_is_stale(species, reviewer):
    """Boundary: one day past 730 is stale."""
    over = date.today() - timedelta(days=REVIEW_STALE_AFTER_DAYS + 1)
    record = _make_published(species, reviewer, last_reviewed_at=over)
    assert record.review_is_stale is True


# ---- AC-08.8 One-to-one integrity ---------------------------------------


def test_ac_8_one_to_one_prevents_duplicate(species):
    SpeciesHusbandry.objects.create(species=species, published=False)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            SpeciesHusbandry.objects.create(species=species, published=False)


# ---- AC-08.9 Species deletion cascades ----------------------------------


def test_ac_9_species_delete_cascades(species, reviewer):
    record = _make_published(species, reviewer)
    record_pk = record.pk
    source_pks = list(record.sources.values_list("pk", flat=True))

    species.delete()

    assert not SpeciesHusbandry.objects.filter(pk=record_pk).exists()
    assert not HusbandrySource.objects.filter(pk__in=source_pks).exists()


# ---- AC-08.10 Unpublishing is reversible --------------------------------


def test_ac_10_unpublish_succeeds_without_validation(api_client, species, reviewer):
    record = _make_published(species, reviewer)
    assert api_client.get(f"/api/v1/species/{species.pk}/husbandry/").status_code == 200

    # Flip to draft; no validation should trigger.
    record.published = False
    record.save()

    # Public endpoint now 404s.
    assert api_client.get(f"/api/v1/species/{species.pk}/husbandry/").status_code == 404
    # has_husbandry flips to false.
    detail = api_client.get(f"/api/v1/species/{species.pk}/")
    assert detail.json()["has_husbandry"] is False


# ---- Adversarial tests (Test Writer Guidance) --------------------------


def test_adversarial_post_to_husbandry_endpoint_rejected(api_client, species, reviewer):
    """Read-only endpoint: POST/PUT/DELETE must never return 200."""
    _make_published(species, reviewer)
    url = f"/api/v1/species/{species.pk}/husbandry/"

    for method in ("post", "put", "patch", "delete"):
        resp = getattr(api_client, method)(url, data={}, format="json")
        assert resp.status_code in (401, 403, 405), (
            f"{method.upper()} returned {resp.status_code} (expected 401/403/405)"
        )


def test_adversarial_draft_not_leaked_via_etag_or_headers(api_client, species, reviewer):
    """Draft with source + reviewer must not leak through any side channel."""
    record = SpeciesHusbandry.objects.create(
        species=species,
        published=False,
        last_reviewed_by=reviewer,
        last_reviewed_at=date.today(),
    )
    HusbandrySource.objects.create(husbandry=record, label="A source")

    resp = api_client.get(f"/api/v1/species/{species.pk}/husbandry/")
    assert resp.status_code == 404
    # No informative headers should reveal the draft's existence.
    assert "ETag" not in resp or not resp["ETag"]
    assert b"A source" not in resp.content
    assert b"reviewer@example.com" not in resp.content


def test_adversarial_publish_flip_without_sources_rejected(species, reviewer):
    """Flipping published=False → True without sources must not succeed via admin."""
    from django.contrib.admin.sites import AdminSite
    from django.contrib.messages.storage.fallback import FallbackStorage
    from django.http import HttpRequest

    from husbandry.admin import SpeciesHusbandryAdmin

    record = SpeciesHusbandry.objects.create(
        species=species,
        published=False,
        last_reviewed_by=reviewer,
        last_reviewed_at=date.today(),
    )

    # Flip and attempt to save via admin.
    record.published = True
    record.save()

    admin_instance = SpeciesHusbandryAdmin(SpeciesHusbandry, AdminSite())

    class _FormStub:
        def __init__(self, instance):
            self.instance = instance

        def save_m2m(self):
            return None

    request = HttpRequest()
    request.session = {}  # type: ignore[assignment]
    request._messages = FallbackStorage(request)  # type: ignore[attr-defined]

    with pytest.raises(ValidationError):
        admin_instance.save_related(request, _FormStub(record), [], change=True)

    record.refresh_from_db()
    assert record.published is False


# ---- Seed command sanity ------------------------------------------------


def test_seed_husbandry_command_creates_record(species):
    """The seed management command creates a published=False record with sources."""
    from django.core.management import call_command

    call_command("seed_husbandry")

    record = SpeciesHusbandry.objects.get(species=species)
    assert record.published is False
    assert record.sources.count() == 3
    # Unpublished draft shouldn't be exposed publicly.
    client = APIClient()
    assert client.get(f"/api/v1/species/{species.pk}/husbandry/").status_code == 404


def test_seed_husbandry_is_idempotent(species):
    """Running the seed twice should not duplicate sources or fail."""
    from django.core.management import call_command

    call_command("seed_husbandry")
    call_command("seed_husbandry")

    assert SpeciesHusbandry.objects.filter(species=species).count() == 1
    assert SpeciesHusbandry.objects.get(species=species).sources.count() == 3
