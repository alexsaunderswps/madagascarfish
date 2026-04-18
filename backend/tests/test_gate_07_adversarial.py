"""
Gate 07 — MVP Public Frontend
Tests written from acceptance criteria in docs/planning/specs/gate-07-mvp-public-frontend-v2.md

Covers:
- BE-07-A: iucn_status=NE filter count must equal dashboard NE bar count (PR #34 parity check)
- BE-07-A: coverage-gap combined filter (?iucn_status=CR,EN,VU&has_captive_population=false)
- BE-07-A: iucn_status multi-select returns union, not intersection
- BE-07-A: has_localities boolean present on species detail
- BE-07-B: last_updated is ISO-8601 UTC string on /api/v1/dashboard/
- Dashboard: NE bar count includes NULL status rows (coalesce parity)
- Dashboard: species with no assessment contribute to NE bucket in chart
"""

from __future__ import annotations

from datetime import datetime

import pytest
from populations.models import ExSituPopulation, Institution
from rest_framework.test import APIClient
from species.models import Species, SpeciesLocality


# ============================================================
# Fixtures
# ============================================================


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def sp_cr(db: None) -> Species:
    """A Critically Endangered species with a captive population."""
    return Species.objects.create(
        scientific_name="Tetraodon lineatus",
        taxonomic_status="described",
        family="Tetraodontidae",
        genus="Tetraodon",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def sp_en(db: None) -> Species:
    """An Endangered species with NO captive population."""
    return Species.objects.create(
        scientific_name="Paretroplus nourissati",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="EN",
    )


@pytest.fixture
def sp_vu(db: None) -> Species:
    """A Vulnerable species with NO captive population."""
    return Species.objects.create(
        scientific_name="Paretroplus kieneri",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="VU",
    )


@pytest.fixture
def sp_ne_explicit(db: None) -> Species:
    """A species with iucn_status='NE' (explicit)."""
    return Species.objects.create(
        scientific_name="Rheocles lateralis",
        taxonomic_status="described",
        family="Bedotiidae",
        genus="Rheocles",
        endemic_status="endemic",
        iucn_status="NE",
    )


@pytest.fixture
def sp_ne_null(db: None) -> Species:
    """A species with iucn_status=NULL (never assessed, mirror policy)."""
    return Species.objects.create(
        scientific_name="Bedotia sp. 'antsirabe'",
        taxonomic_status="undescribed_morphospecies",
        provisional_name="'antsirabe'",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status=None,
    )


@pytest.fixture
def sp_ne_null_2(db: None) -> Species:
    """A second NULL-status species for count-parity tests."""
    return Species.objects.create(
        scientific_name="Bedotia sp. 'faravolo'",
        taxonomic_status="undescribed_morphospecies",
        provisional_name="'faravolo'",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status=None,
    )


@pytest.fixture
def captive_population_for_cr(db: None, sp_cr: Species) -> ExSituPopulation:
    inst = Institution.objects.create(
        name="Test Aquarium", institution_type="aquarium", country="Germany"
    )
    return ExSituPopulation.objects.create(
        species=sp_cr,
        institution=inst,
    )


# ============================================================
# BE-07-A: Dashboard NE bar count == directory filter count (PR #34)
# ============================================================


@pytest.mark.django_db
class TestNECountParity:
    """The dashboard chart's NE bar coalesces NULL+NE.
    The directory filter ?iucn_status=NE must return the same row set
    so a visitor clicking the NE bar lands on the expected result list.

    This is the core regression for PR #34.
    """

    def test_ne_bar_count_equals_directory_filter_count(
        self,
        api_client: APIClient,
        sp_ne_explicit: Species,
        sp_ne_null: Species,
        sp_ne_null_2: Species,
    ) -> None:
        # Dashboard bar count: coalesces NULL → NE
        dash_resp = api_client.get("/api/v1/dashboard/")
        assert dash_resp.status_code == 200
        dashboard_ne_count = dash_resp.json()["species_counts"]["by_iucn_status"].get("NE", 0)

        # Directory filter count: must use same coalesce logic
        dir_resp = api_client.get("/api/v1/species/?iucn_status=NE")
        assert dir_resp.status_code == 200
        directory_ne_count = dir_resp.json()["count"]

        assert dashboard_ne_count == directory_ne_count, (
            f"Dashboard NE bar shows {dashboard_ne_count} but "
            f"?iucn_status=NE returns {directory_ne_count} — "
            "clicking the NE bar will show a different count than the bar promised"
        )

    def test_ne_directory_filter_returns_both_explicit_and_null(
        self,
        api_client: APIClient,
        sp_ne_explicit: Species,
        sp_ne_null: Species,
    ) -> None:
        """NE filter must include both iucn_status='NE' and iucn_status IS NULL."""
        resp = api_client.get("/api/v1/species/?iucn_status=NE")
        data = resp.json()
        returned_ids = {r["id"] for r in data["results"]}
        assert sp_ne_explicit.pk in returned_ids, (
            "iucn_status=NE filter omitted species with explicit NE status"
        )
        assert sp_ne_null.pk in returned_ids, (
            "iucn_status=NE filter omitted species with NULL status "
            "(mirror policy: NULL = not yet assessed = NE)"
        )

    def test_null_status_excluded_from_non_ne_filter(
        self,
        api_client: APIClient,
        sp_en: Species,
        sp_ne_null: Species,
    ) -> None:
        """A non-NE filter (e.g. EN) must NOT sweep in NULL-status rows."""
        resp = api_client.get("/api/v1/species/?iucn_status=EN")
        data = resp.json()
        returned_ids = {r["id"] for r in data["results"]}
        assert sp_ne_null.pk not in returned_ids, (
            "NULL-status species incorrectly included in iucn_status=EN filter"
        )

    def test_dashboard_ne_bucket_includes_null_status_species(
        self,
        api_client: APIClient,
        sp_ne_null: Species,
    ) -> None:
        """Dashboard by_iucn_status['NE'] must count the NULL-status species
        (coalesce NULL→NE in _build_dashboard)."""
        resp = api_client.get("/api/v1/dashboard/")
        assert resp.status_code == 200
        ne_count = resp.json()["species_counts"]["by_iucn_status"].get("NE", 0)
        assert ne_count >= 1, (
            "Dashboard NE bucket is zero despite a species with NULL iucn_status existing"
        )


# ============================================================
# BE-07-A: Coverage-gap combined filter
# ============================================================


@pytest.mark.django_db
class TestCoverageGapFilter:
    """?iucn_status=CR,EN,VU&has_captive_population=false is the URL the
    dashboard coverage-gap stat deep-links to (FE-07-7 AC, FE-07-1 AC)."""

    def test_coverage_gap_filter_excludes_species_with_captive_population(
        self,
        api_client: APIClient,
        sp_cr: Species,
        sp_en: Species,
        captive_population_for_cr: ExSituPopulation,
    ) -> None:
        """CR species has captive pop → excluded. EN species has none → included."""
        resp = api_client.get(
            "/api/v1/species/?iucn_status=CR,EN,VU&has_captive_population=false"
        )
        data = resp.json()
        returned_ids = {r["id"] for r in data["results"]}
        assert sp_en.pk in returned_ids, "EN species without captive pop should be in result"
        assert sp_cr.pk not in returned_ids, (
            "CR species with captive population should be excluded from coverage-gap filter"
        )

    def test_coverage_gap_filter_excludes_non_threatened_statuses(
        self,
        api_client: APIClient,
        sp_ne_explicit: Species,
    ) -> None:
        """NE species must not appear in the CR+EN+VU filter — the gap is
        specifically about *threatened* species with no captive population."""
        resp = api_client.get(
            "/api/v1/species/?iucn_status=CR,EN,VU&has_captive_population=false"
        )
        data = resp.json()
        returned_ids = {r["id"] for r in data["results"]}
        assert sp_ne_explicit.pk not in returned_ids, (
            "NE species incorrectly appears in threatened-only coverage-gap filter"
        )

    def test_coverage_gap_filter_includes_all_three_threatened_categories(
        self,
        api_client: APIClient,
        sp_cr: Species,
        sp_en: Species,
        sp_vu: Species,
    ) -> None:
        """All three threatened categories (CR, EN, VU) with no captive population
        must appear in the combined filter result."""
        resp = api_client.get(
            "/api/v1/species/?iucn_status=CR,EN,VU&has_captive_population=false"
        )
        data = resp.json()
        returned_ids = {r["id"] for r in data["results"]}
        statuses = {r["iucn_status"] for r in data["results"]}
        assert sp_cr.pk in returned_ids
        assert sp_en.pk in returned_ids
        assert sp_vu.pk in returned_ids
        assert statuses == {"CR", "EN", "VU"}, (
            f"Expected CR, EN, VU in results; got {statuses}"
        )


# ============================================================
# BE-07-A: iucn_status multi-select (union semantics)
# ============================================================


@pytest.mark.django_db
class TestIucnMultiSelect:
    def test_multi_select_returns_union_not_intersection(
        self,
        api_client: APIClient,
        sp_cr: Species,
        sp_en: Species,
    ) -> None:
        resp = api_client.get("/api/v1/species/?iucn_status=CR,EN")
        data = resp.json()
        statuses = sorted(r["iucn_status"] for r in data["results"])
        assert "CR" in statuses
        assert "EN" in statuses
        assert data["count"] == 2

    def test_single_category_returns_only_that_category(
        self,
        api_client: APIClient,
        sp_cr: Species,
        sp_en: Species,
        sp_vu: Species,
    ) -> None:
        resp = api_client.get("/api/v1/species/?iucn_status=VU")
        data = resp.json()
        assert data["count"] == 1
        assert data["results"][0]["iucn_status"] == "VU"


# ============================================================
# BE-07-A: has_localities on species detail serializer
# ============================================================


@pytest.mark.django_db
class TestHasLocalitiesField:
    """BE-07-A AC: GET /api/v1/species/{id}/ response includes has_localities: boolean."""

    def test_has_localities_false_when_no_localities(
        self,
        api_client: APIClient,
        sp_en: Species,
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{sp_en.pk}/")
        assert resp.status_code == 200
        data = resp.json()
        assert "has_localities" in data, (
            "has_localities field missing from species detail response (BE-07-A AC)"
        )
        assert data["has_localities"] is False

    def test_has_localities_true_when_locality_exists(
        self,
        api_client: APIClient,
        sp_cr: Species,
    ) -> None:
        from django.contrib.gis.geos import Point

        SpeciesLocality.objects.create(
            species=sp_cr,
            locality_name="Test Site",
            locality_type="observation",
            presence_status="present",
            location=Point(47.5, -18.9, srid=4326),
            coordinate_precision="exact",
            source_citation="Gate 07 test",
        )
        resp = api_client.get(f"/api/v1/species/{sp_cr.pk}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_localities"] is True, (
            "has_localities should be True when at least one locality exists"
        )


# ============================================================
# BE-07-B: last_updated ISO-8601 UTC
# ============================================================


@pytest.mark.django_db
class TestDashboardLastUpdated:
    """BE-07-B: last_updated field must be present, ISO-8601 parseable, with timezone."""

    def test_last_updated_present_and_iso8601(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/dashboard/")
        assert resp.status_code == 200
        data = resp.json()
        assert "last_updated" in data, "last_updated missing from /api/v1/dashboard/ response"
        parsed = datetime.fromisoformat(data["last_updated"])
        assert parsed.tzinfo is not None, (
            "last_updated must carry timezone information (ISO-8601 UTC)"
        )

    def test_last_updated_is_string(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/dashboard/")
        data = resp.json()
        assert isinstance(data["last_updated"], str), (
            "last_updated must be a string, not a numeric timestamp"
        )


# ============================================================
# Dashboard response shape (FE-07-7 deep-link ACs require these fields)
# ============================================================


@pytest.mark.django_db
class TestDashboardShape:
    """The dashboard page deep-links rely on specific shape fields being present."""

    def test_dashboard_response_has_required_shape(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/dashboard/")
        assert resp.status_code == 200
        data = resp.json()

        # FE-07-7: coverage-gap stat pulls these two fields
        coverage = data.get("ex_situ_coverage", {})
        assert "threatened_species_without_captive_population" in coverage, (
            "threatened_species_without_captive_population missing — coverage-gap stat will break"
        )
        assert "threatened_species_total" in coverage, (
            "threatened_species_total missing — coverage-gap stat denominator will break"
        )

        # FE-07-7: IUCN chart requires by_iucn_status dict
        counts = data.get("species_counts", {})
        assert "by_iucn_status" in counts, (
            "by_iucn_status missing from species_counts — IUCN chart will be empty"
        )

        # FE-07-7: field programs section
        assert "field_programs" in data

    def test_dashboard_by_iucn_status_includes_ne_key(
        self,
        api_client: APIClient,
        sp_ne_explicit: Species,
    ) -> None:
        """NE key must be present (possibly 0) so the chart always renders the NE bar."""
        resp = api_client.get("/api/v1/dashboard/")
        data = resp.json()
        by_status = data["species_counts"]["by_iucn_status"]
        assert "NE" in by_status, (
            "NE key missing from by_iucn_status — dashboard chart will silently omit NE bar"
        )
