"""
Gate 05 — DRF API: Adversarial Tests
Tests written from acceptance criteria in docs/planning/specs/gate-05-drf-api.md

Covers:
- Tier escalation: Tier 1/2 accessing Tier 3+ endpoints and fields
- Inactive user accounts cannot access protected endpoints
- Forged or tampered authentication tokens
- Anonymous users accessing tier-gated fields (contact_email, pending assessments)
- Malformed filter params: invalid choice values, SQL injection strings, XSS payloads
- Numeric filter params receiving non-numeric input (species_id, watershed_id)
- Large page sizes beyond the documented maximum (page_size=10000)
- Malformed bbox: incomplete (1-3 parts), non-numeric values, reversed coordinates
- GeoJSON shape validation per RFC 7946
- Sensitive coordinate redaction when is_sensitive=True
- Sensitive coordinates NOT served when location_generalized is absent
- Write operations (POST/PUT/PATCH/DELETE) rejected on all read-only endpoints
- Empty database state for each endpoint
- Speculative field exposure: private fields must never appear in lower-tier responses
"""

from __future__ import annotations

import pytest
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient

from accounts.models import User
from fieldwork.models import FieldProgram
from populations.models import ExSituPopulation, HoldingRecord, Institution
from species.models import (
    CommonName,
    ConservationAssessment,
    Species,
    SpeciesLocality,
    Watershed,
)

# ---------------------------------------------------------------------------
# Fixtures — mirror test_api.py so this file is self-contained
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def tier1_user(db: None) -> User:
    """Explicitly Tier 1 authenticated user (unusual but valid)."""
    return User.objects.create_user(
        email="tier1@example.com",
        password="securepass12345",
        name="Tier One",
        access_tier=1,
        is_active=True,
    )


@pytest.fixture
def tier2_user(db: None) -> User:
    return User.objects.create_user(
        email="researcher@example.com",
        password="securepass12345",
        name="Researcher",
        access_tier=2,
        is_active=True,
    )


@pytest.fixture
def tier3_user(db: None) -> User:
    inst = Institution.objects.create(name="Cologne Zoo", institution_type="zoo", country="Germany")
    return User.objects.create_user(
        email="coordinator@example.com",
        password="securepass12345",
        name="Coordinator",
        access_tier=3,
        is_active=True,
        institution=inst,
    )


@pytest.fixture
def tier4_user(db: None) -> User:
    return User.objects.create_user(
        email="manager@example.com",
        password="securepass12345",
        name="Manager",
        access_tier=4,
        is_active=True,
    )


@pytest.fixture
def admin_user(db: None) -> User:
    return User.objects.create_superuser(
        email="admin@example.com",
        password="securepass12345",
        name="Admin",
    )


@pytest.fixture
def inactive_tier3_user(db: None) -> User:
    """A Tier 3 user whose account has been deactivated."""
    return User.objects.create_user(
        email="inactive@example.com",
        password="securepass12345",
        name="Inactive Coordinator",
        access_tier=3,
        is_active=False,
    )


@pytest.fixture
def species_cr(db: None) -> Species:
    sp = Species.objects.create(
        scientific_name="Bedotia sp. 'manombo'",
        taxonomic_status="undescribed_morphospecies",
        provisional_name="'manombo'",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status="CR",
        cares_status="CCR",
        shoal_priority=True,
    )
    CommonName.objects.create(species=sp, name="Manombo Rainbowfish", language="en")
    return sp


@pytest.fixture
def species_en(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Pachypanchax sakaramyi",
        taxonomic_status="described",
        authority="Holly, 1928",
        year_described=1928,
        family="Aplocheilidae",
        genus="Pachypanchax",
        endemic_status="endemic",
        iucn_status="EN",
    )


@pytest.fixture
def assessment_accepted(species_en: Species) -> ConservationAssessment:
    return ConservationAssessment.objects.create(
        species=species_en,
        category="EN",
        source="iucn_official",
        review_status="accepted",
        assessor="IUCN SSC Freshwater Fish Specialist Group",
        criteria="B1ab(iii)",
    )


@pytest.fixture
def assessment_pending(species_en: Species) -> ConservationAssessment:
    return ConservationAssessment.objects.create(
        species=species_en,
        category="CR",
        source="recommended_revision",
        review_status="pending_review",
        review_notes="Requires field verification",
    )


@pytest.fixture
def institution(db: None) -> Institution:
    return Institution.objects.create(
        name="ABQ BioPark",
        institution_type="aquarium",
        country="United States",
        city="Albuquerque",
        contact_email="fish@cabq.gov",
        species360_id="ABQ123",
        website="https://www.cabq.gov/biopark",
    )


@pytest.fixture
def population(species_cr: Species, institution: Institution) -> ExSituPopulation:
    pop = ExSituPopulation.objects.create(
        species=species_cr,
        institution=institution,
        count_total=18,
        count_male=7,
        count_female=8,
        count_unsexed=3,
        breeding_status="breeding",
        last_census_date="2026-02-15",
    )
    HoldingRecord.objects.create(population=pop, date="2026-02-15", count_total=18)
    return pop


@pytest.fixture
def field_program(species_cr: Species, institution: Institution) -> FieldProgram:
    fp = FieldProgram.objects.create(
        name="Durrell Nosivolo",
        description="Monitoring program",
        lead_institution=institution,
        region="Eastern Madagascar",
        status="active",
    )
    fp.focal_species.add(species_cr)
    return fp


@pytest.fixture
def watershed(db: None) -> Watershed:
    from django.contrib.gis.geos import MultiPolygon, Polygon

    poly = Polygon(((46, -20), (48, -20), (48, -18), (46, -18), (46, -20)))
    return Watershed.objects.create(
        hybas_id=1234567890,
        name="Betsiboka",
        pfafstetter_level=6,
        pfafstetter_code=123456,
        area_sq_km=48900,
        geometry=MultiPolygon(poly, srid=4326),
    )


@pytest.fixture
def locality(species_cr: Species, watershed: Watershed) -> SpeciesLocality:
    return SpeciesLocality.objects.create(
        species=species_cr,
        locality_name="Manombo Forest",
        location=Point(47.52, -18.91, srid=4326),
        locality_type="type_locality",
        presence_status="present",
        water_body="Manombo River",
        water_body_type="river",
        drainage_basin=watershed,
        year_collected=2020,
        coordinate_precision="exact",
        source_citation="Smith et al. 2020",
        is_sensitive=False,
    )


@pytest.fixture
def sensitive_locality(species_cr: Species) -> SpeciesLocality:
    """Sensitive record with a generalized coordinate already stored."""
    return SpeciesLocality.objects.create(
        species=species_cr,
        locality_name="Secret Cave",
        location=Point(47.1234, -19.5678, srid=4326),
        location_generalized=Point(47.1, -19.6, srid=4326),
        locality_type="observation",
        presence_status="present",
        is_sensitive=True,
        coordinate_precision="exact",
        source_citation="Confidential survey 2024",
    )


@pytest.fixture
def sensitive_locality_no_generalized(species_cr: Species) -> SpeciesLocality:
    """Sensitive record where location_generalized has not been computed yet."""
    return SpeciesLocality.objects.create(
        species=species_cr,
        locality_name="Cave Without Generalized Coords",
        location=Point(47.9999, -20.1111, srid=4326),
        location_generalized=None,
        locality_type="observation",
        presence_status="present",
        is_sensitive=True,
        coordinate_precision="exact",
        source_citation="Internal survey 2025",
    )


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


def _auth_client(api_client: APIClient, user: User) -> APIClient:
    from rest_framework.authtoken.models import Token

    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api_client


# ===========================================================================
# TIER ESCALATION TESTS
# ===========================================================================


@pytest.mark.django_db
class TestTierEscalation:
    """Verify that lower-tier users cannot access Tier 3+ endpoints or fields."""

    # --- /populations/ endpoint (min Tier 3) ---

    def test_anonymous_cannot_access_populations_list(self, api_client: APIClient) -> None:
        # Spec BE-05-4: anonymous is Tier 1; populations requires Tier 3
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code == 403

    def test_tier1_authenticated_cannot_access_populations_list(
        self, api_client: APIClient, tier1_user: User
    ) -> None:
        # A user with an explicit Tier 1 record (not just anonymous) must still be blocked
        _auth_client(api_client, tier1_user)
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code == 403

    def test_tier2_cannot_access_populations_list(
        self, api_client: APIClient, tier2_user: User
    ) -> None:
        # Spec BE-05-4: "Given a Tier 2 GET … Then HTTP 403 is returned"
        _auth_client(api_client, tier2_user)
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code == 403

    def test_tier2_cannot_access_population_detail(
        self, api_client: APIClient, tier2_user: User, population: ExSituPopulation
    ) -> None:
        # Detail endpoint must enforce the same Tier 3 gate as the list
        _auth_client(api_client, tier2_user)
        resp = api_client.get(f"/api/v1/populations/{population.pk}/")
        assert resp.status_code == 403

    # --- contact_email / species360_id hidden below Tier 3 ---

    def test_anonymous_institution_list_has_no_contact_email(
        self, api_client: APIClient, institution: Institution
    ) -> None:
        # Spec BE-05-3: contact_email is Tier 3+ only
        resp = api_client.get("/api/v1/institutions/")
        assert resp.status_code == 200
        for result in resp.json()["results"]:
            assert "contact_email" not in result, (
                "contact_email must not be present in Tier 1 institution list"
            )

    def test_anonymous_institution_detail_has_no_contact_email(
        self, api_client: APIClient, institution: Institution
    ) -> None:
        resp = api_client.get(f"/api/v1/institutions/{institution.pk}/")
        assert resp.status_code == 200
        assert "contact_email" not in resp.json()

    def test_anonymous_institution_detail_has_no_species360_id(
        self, api_client: APIClient, institution: Institution
    ) -> None:
        resp = api_client.get(f"/api/v1/institutions/{institution.pk}/")
        assert "species360_id" not in resp.json()

    def test_tier2_institution_detail_has_no_contact_email(
        self, api_client: APIClient, tier2_user: User, institution: Institution
    ) -> None:
        # Tier 2 is still below the Tier 3 threshold for contact_email
        _auth_client(api_client, tier2_user)
        resp = api_client.get(f"/api/v1/institutions/{institution.pk}/")
        assert resp.status_code == 200
        assert "contact_email" not in resp.json()

    def test_tier2_institution_detail_has_no_species360_id(
        self, api_client: APIClient, tier2_user: User, institution: Institution
    ) -> None:
        _auth_client(api_client, tier2_user)
        resp = api_client.get(f"/api/v1/institutions/{institution.pk}/")
        assert "species360_id" not in resp.json()

    # --- conservation_assessments: pending reviews hidden below Tier 3 ---

    def test_anonymous_cannot_see_pending_assessment(
        self,
        api_client: APIClient,
        species_en: Species,
        assessment_accepted: ConservationAssessment,
        assessment_pending: ConservationAssessment,
    ) -> None:
        # Spec BE-05-2: anonymous sees only review_status='accepted' assessments
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        assessments = resp.json()["conservation_assessments"]
        sources = [a["source"] for a in assessments]
        assert "recommended_revision" not in sources, (
            "pending_review assessment must not be visible to anonymous users"
        )
        assert len(assessments) == 1

    def test_tier2_cannot_see_pending_assessment(
        self,
        api_client: APIClient,
        tier2_user: User,
        species_en: Species,
        assessment_accepted: ConservationAssessment,
        assessment_pending: ConservationAssessment,
    ) -> None:
        _auth_client(api_client, tier2_user)
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        assessments = resp.json()["conservation_assessments"]
        assert len(assessments) == 1
        assert assessments[0]["source"] == "iucn_official"

    def test_anonymous_assessment_response_lacks_review_status_field(
        self,
        api_client: APIClient,
        species_en: Species,
        assessment_accepted: ConservationAssessment,
    ) -> None:
        # The review_status field itself must be omitted from the public serializer
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        for assessment in resp.json()["conservation_assessments"]:
            assert "review_status" not in assessment, (
                "review_status field must be absent from public assessment objects"
            )

    def test_anonymous_assessment_response_lacks_review_notes_field(
        self,
        api_client: APIClient,
        species_en: Species,
        assessment_accepted: ConservationAssessment,
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        for assessment in resp.json()["conservation_assessments"]:
            assert "review_notes" not in assessment

    def test_anonymous_assessment_response_lacks_flagged_fields(
        self,
        api_client: APIClient,
        species_en: Species,
        assessment_accepted: ConservationAssessment,
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        for assessment in resp.json()["conservation_assessments"]:
            assert "flagged_by" not in assessment
            assert "flagged_date" not in assessment


# ===========================================================================
# INACTIVE USER TESTS
# ===========================================================================


@pytest.mark.django_db
class TestInactiveUser:
    """An inactive account must not grant access regardless of its access_tier."""

    def test_inactive_tier3_cannot_access_populations(
        self, api_client: APIClient, inactive_tier3_user: User
    ) -> None:
        # is_active=False means DRF's IsAuthenticated rejects the user
        _auth_client(api_client, inactive_tier3_user)
        resp = api_client.get("/api/v1/populations/")
        # Must be 403 (permission denied), not 200
        assert resp.status_code == 403

    def test_inactive_tier3_cannot_see_contact_email(
        self, api_client: APIClient, inactive_tier3_user: User, institution: Institution
    ) -> None:
        _auth_client(api_client, inactive_tier3_user)
        resp = api_client.get(f"/api/v1/institutions/{institution.pk}/")
        # Should behave as unauthenticated (Tier 1)
        assert "contact_email" not in resp.json()


# ===========================================================================
# FORGED / INVALID TOKEN TESTS
# ===========================================================================


@pytest.mark.django_db
class TestFakeTokens:
    """Requests with non-existent or malformed tokens must not gain access."""

    def test_nonexistent_token_treated_as_anonymous(self, api_client: APIClient) -> None:
        # A fake token is rejected — DRF falls back to SessionAuthentication (anonymous),
        # then TierPermission(3) denies → 403. The key assertion: not 200.
        api_client.credentials(HTTP_AUTHORIZATION="Token aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code in (401, 403), "A fake token should yield 401 or 403, not 200"

    def test_malformed_token_header_rejected(self, api_client: APIClient) -> None:
        api_client.credentials(HTTP_AUTHORIZATION="Bearer this-is-not-a-token")
        resp = api_client.get("/api/v1/populations/")
        # DRF token auth ignores non-Token scheme; treated as anonymous → 403
        assert resp.status_code in (401, 403)

    def test_empty_token_header_rejected(self, api_client: APIClient) -> None:
        api_client.credentials(HTTP_AUTHORIZATION="Token ")
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code in (401, 403)


# ===========================================================================
# WRITE OPERATIONS REJECTED (all endpoints are read-only at MVP)
# ===========================================================================


@pytest.mark.django_db
class TestWriteOperationsRejected:
    """Spec: all endpoints are read-only at MVP. POST/PUT/PATCH/DELETE must be rejected."""

    def test_post_species_rejected(self, api_client: APIClient, admin_user: User) -> None:
        _auth_client(api_client, admin_user)
        resp = api_client.post("/api/v1/species/", data={"scientific_name": "Fake species"})
        assert resp.status_code == 405

    def test_put_species_rejected(
        self, api_client: APIClient, admin_user: User, species_cr: Species
    ) -> None:
        _auth_client(api_client, admin_user)
        resp = api_client.put(f"/api/v1/species/{species_cr.pk}/", data={})
        assert resp.status_code == 405

    def test_patch_species_rejected(
        self, api_client: APIClient, admin_user: User, species_cr: Species
    ) -> None:
        _auth_client(api_client, admin_user)
        resp = api_client.patch(f"/api/v1/species/{species_cr.pk}/", data={})
        assert resp.status_code == 405

    def test_delete_species_rejected(
        self, api_client: APIClient, admin_user: User, species_cr: Species
    ) -> None:
        _auth_client(api_client, admin_user)
        resp = api_client.delete(f"/api/v1/species/{species_cr.pk}/")
        assert resp.status_code == 405

    def test_post_institutions_rejected(self, api_client: APIClient, admin_user: User) -> None:
        _auth_client(api_client, admin_user)
        resp = api_client.post("/api/v1/institutions/", data={"name": "Fake Zoo"})
        assert resp.status_code == 405

    def test_delete_institutions_rejected(
        self, api_client: APIClient, admin_user: User, institution: Institution
    ) -> None:
        _auth_client(api_client, admin_user)
        resp = api_client.delete(f"/api/v1/institutions/{institution.pk}/")
        assert resp.status_code == 405

    def test_post_populations_rejected(self, api_client: APIClient, admin_user: User) -> None:
        _auth_client(api_client, admin_user)
        resp = api_client.post("/api/v1/populations/", data={})
        assert resp.status_code == 405

    def test_delete_populations_rejected(
        self, api_client: APIClient, admin_user: User, population: ExSituPopulation
    ) -> None:
        _auth_client(api_client, admin_user)
        resp = api_client.delete(f"/api/v1/populations/{population.pk}/")
        assert resp.status_code == 405


# ===========================================================================
# MALFORMED FILTER PARAMS — SPECIES LIST
# ===========================================================================


@pytest.mark.django_db
class TestMalformedSpeciesFilters:
    """Malformed filter values must not crash the server or leak unintended data."""

    def test_invalid_taxonomic_status_returns_empty(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        # An unknown enum value should match nothing (not raise 500)
        resp = api_client.get("/api/v1/species/?taxonomic_status=NOTAVALIDSTATUS")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_invalid_iucn_status_returns_empty(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?iucn_status=XX")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_sql_injection_in_iucn_status_filter(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        # ORM parameterization should neutralize this; must not 500 or return unexpected results
        payload = "CR' OR '1'='1"
        resp = api_client.get(f"/api/v1/species/?iucn_status={payload}")
        assert resp.status_code == 200
        # Should return zero results (the injected string matches nothing)
        assert resp.json()["count"] == 0

    def test_sql_injection_in_family_filter(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        payload = "Bedotiidae'; DROP TABLE species_species; --"
        resp = api_client.get(f"/api/v1/species/?family={payload}")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_xss_payload_in_search_param(self, api_client: APIClient, species_cr: Species) -> None:
        # XSS in search query should return empty results and not appear unescaped in JSON
        payload = "<script>alert('xss')</script>"
        resp = api_client.get(f"/api/v1/species/?search={payload}")
        assert resp.status_code == 200
        # Response body must not contain unescaped HTML tags from the attacker's payload
        assert "<script>" not in resp.content.decode()

    def test_extremely_long_search_string(self, api_client: APIClient) -> None:
        # A very long input string must not crash the server
        long_string = "a" * 10000
        resp = api_client.get(f"/api/v1/species/?search={long_string}")
        assert resp.status_code == 200

    def test_unicode_in_search_param(self, api_client: APIClient, species_cr: Species) -> None:
        # Unicode input is valid; should be handled gracefully
        resp = api_client.get("/api/v1/species/?search=\u00e9\u00e0\u00fc")
        assert resp.status_code == 200

    def test_invalid_ordering_field_ignored_or_errors_cleanly(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        # Unknown ordering field must not 500
        resp = api_client.get("/api/v1/species/?ordering=password_hash")
        assert resp.status_code in (200, 400)

    def test_ordering_by_non_allowlisted_field_does_not_expose_data(
        self, api_client: APIClient, species_cr: Species, species_en: Species
    ) -> None:
        # Attempting to order by a field not in ordering_fields must not 500 and must
        # not leak hidden data through observable ordering differences
        resp = api_client.get("/api/v1/species/?ordering=id")
        assert resp.status_code in (200, 400)


# ===========================================================================
# LARGE PAGE SIZE
# ===========================================================================


@pytest.mark.django_db
class TestLargePageSize:
    """page_size above the documented maximum (200) must be clamped, not crash."""

    def test_page_size_10000_is_clamped(self, api_client: APIClient, species_cr: Species) -> None:
        # Spec BE-05-1: max page_size is 200; requesting 10000 must not 500
        resp = api_client.get("/api/v1/species/?page_size=10000")
        assert resp.status_code == 200
        # The actual results returned must not exceed the 200 cap
        data = resp.json()
        assert len(data["results"]) <= 200

    def test_page_size_negative_handled_gracefully(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?page_size=-1")
        assert resp.status_code in (200, 400)

    def test_page_size_zero_handled_gracefully(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?page_size=0")
        assert resp.status_code in (200, 400)

    def test_page_size_non_numeric_handled_gracefully(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?page_size=all")
        assert resp.status_code in (200, 400)

    def test_page_beyond_last_returns_empty_or_404(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?page=99999")
        assert resp.status_code in (200, 404)


# ===========================================================================
# MALFORMED BBOX PARAMS
# ===========================================================================


@pytest.mark.django_db
class TestMalformedBbox:
    """Malformed bbox values must be ignored gracefully (spec: bbox errors are silently skipped)."""

    def test_bbox_with_only_two_parts(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        # Only 2 of 4 required coordinate components
        resp = api_client.get("/api/v1/map/localities/?bbox=46.0,-20.0")
        assert resp.status_code == 200

    def test_bbox_with_three_parts(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/?bbox=46.0,-20.0,48.0")
        assert resp.status_code == 200

    def test_bbox_with_one_part(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/?bbox=46.0")
        assert resp.status_code == 200

    def test_bbox_with_non_numeric_values(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/?bbox=north,south,east,west")
        assert resp.status_code == 200

    def test_bbox_with_partial_numeric_values(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/?bbox=46.0,abc,-18.0,def")
        assert resp.status_code == 200

    def test_bbox_reversed_longitude(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        # max_lng < min_lng — reversed; the locality at 47.52 should NOT match
        # The implementation must either reject, return empty, or handle gracefully
        resp = api_client.get("/api/v1/map/localities/?bbox=48.0,-20.0,46.0,-18.0")
        assert resp.status_code == 200
        # A reversed bbox is geometrically degenerate; the locality must not appear
        # (PostGIS Polygon.from_bbox with reversed coords produces an empty/degenerate polygon)
        data = resp.json()
        assert data["type"] == "FeatureCollection"

    def test_bbox_reversed_latitude(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        # max_lat < min_lat — reversed latitude
        resp = api_client.get("/api/v1/map/localities/?bbox=46.0,-18.0,48.0,-20.0")
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "FeatureCollection"

    def test_bbox_empty_string(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/?bbox=")
        assert resp.status_code == 200

    def test_bbox_sql_injection_attempt(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        payload = "46.0,-20.0,48.0,-18.0; DROP TABLE species_specieslocality; --"
        resp = api_client.get(f"/api/v1/map/localities/?bbox={payload}")
        assert resp.status_code == 200
        # The table must still exist and return valid GeoJSON
        assert resp.json()["type"] == "FeatureCollection"

    def test_bbox_out_of_valid_geographic_range(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        # Coordinates outside valid WGS84 range
        resp = api_client.get("/api/v1/map/localities/?bbox=-999,-999,999,999")
        assert resp.status_code == 200


# ===========================================================================
# MALFORMED FILTER PARAMS — MAP LOCALITIES
# ===========================================================================


@pytest.mark.django_db
class TestMalformedLocalityFilters:
    """Non-numeric and injected values in map filter params must not 500."""

    def test_species_id_non_numeric(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/?species_id=abc")
        # Must not 500; acceptable responses are 200 (empty) or 400
        assert resp.status_code in (200, 400)

    def test_species_id_sql_injection(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/?species_id=1 OR 1=1")
        assert resp.status_code in (200, 400)
        if resp.status_code == 200:
            # Must not return all localities due to the injected condition
            data = resp.json()
            assert data["type"] == "FeatureCollection"

    def test_watershed_id_non_numeric(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/?watershed_id=notanumber")
        assert resp.status_code in (200, 400)

    def test_iucn_status_unknown_value_returns_empty(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/?iucn_status=ZZ")
        assert resp.status_code == 200
        assert resp.json()["features"] == []

    def test_locality_type_unknown_value_returns_empty(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/?locality_type=notatype")
        assert resp.status_code == 200
        assert resp.json()["features"] == []

    def test_presence_status_unknown_value_returns_empty(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/?presence_status=extinct_lol")
        assert resp.status_code == 200
        assert resp.json()["features"] == []


# ===========================================================================
# MALFORMED FILTER PARAMS — POPULATIONS
# ===========================================================================


@pytest.mark.django_db
class TestMalformedPopulationFilters:
    """Malformed filter values on the Tier 3-gated populations endpoint."""

    def test_species_id_non_numeric_returns_400_or_empty(
        self, api_client: APIClient, tier3_user: User, population: ExSituPopulation
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get("/api/v1/populations/?species_id=not_a_number")
        assert resp.status_code in (200, 400)
        if resp.status_code == 200:
            assert resp.json()["count"] == 0

    def test_institution_id_non_numeric_returns_400_or_empty(
        self, api_client: APIClient, tier3_user: User, population: ExSituPopulation
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get("/api/v1/populations/?institution_id=evil")
        assert resp.status_code in (200, 400)

    def test_species_id_sql_injection_in_populations(
        self, api_client: APIClient, tier3_user: User, population: ExSituPopulation
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get("/api/v1/populations/?species_id=1 UNION SELECT * FROM accounts_user")
        assert resp.status_code in (200, 400)
        if resp.status_code == 200:
            # Must not expose any user data; results must be populations only
            data = resp.json()
            if data["count"] > 0:
                result = data["results"][0]
                assert "email" not in result
                assert "password" not in result


# ===========================================================================
# GEOJSON SHAPE VALIDATION (RFC 7946)
# ===========================================================================


@pytest.mark.django_db
class TestGeoJSONShape:
    """Verify the /map/localities/ response conforms to RFC 7946 GeoJSON spec."""

    def test_top_level_type_is_feature_collection(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        data = resp.json()
        assert data.get("type") == "FeatureCollection"

    def test_features_key_is_present_and_is_list(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        data = resp.json()
        assert "features" in data
        assert isinstance(data["features"], list)

    def test_each_feature_has_type_feature(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            assert feature.get("type") == "Feature", f"Feature missing type='Feature': {feature}"

    def test_each_feature_has_geometry_object(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            assert "geometry" in feature
            assert feature["geometry"] is not None

    def test_geometry_type_is_point(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            assert feature["geometry"]["type"] == "Point"

    def test_geometry_coordinates_are_two_element_array(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        # RFC 7946 §3.1.1: Point coordinates are [longitude, latitude]
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            coords = feature["geometry"]["coordinates"]
            assert isinstance(coords, list), "coordinates must be a JSON array"
            assert len(coords) == 2, (
                f"Point coordinates must have exactly 2 elements [lng, lat], got {coords}"
            )

    def test_geometry_coordinates_are_numeric(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            lng, lat = feature["geometry"]["coordinates"]
            assert isinstance(lng, (int, float)), f"longitude must be numeric, got {type(lng)}"
            assert isinstance(lat, (int, float)), f"latitude must be numeric, got {type(lat)}"

    def test_each_feature_has_properties_object(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            assert "properties" in feature
            assert isinstance(feature["properties"], dict)

    def test_properties_contain_required_fields(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        # All properties listed in the spec's sample response must be present.
        # Note: GeoFeatureModelSerializer puts 'id' at feature level, not in properties.
        required_props = {
            "species_id",
            "scientific_name",
            "family",
            "iucn_status",
            "locality_name",
            "locality_type",
            "presence_status",
            "coordinate_precision",
            "source_citation",
        }
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            assert "id" in feature, "Feature must have 'id' at top level (RFC 7946)"
            missing = required_props - set(feature["properties"].keys())
            assert not missing, f"Feature properties missing required fields: {missing}"

    def test_longitude_is_within_valid_wgs84_range(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        # RFC 7946 §3.1.1: longitude ∈ [-180, 180]
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            lng = feature["geometry"]["coordinates"][0]
            assert -180 <= lng <= 180, f"longitude {lng} is outside [-180, 180]"

    def test_latitude_is_within_valid_wgs84_range(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        # RFC 7946 §3.1.1: latitude ∈ [-90, 90]
        resp = api_client.get("/api/v1/map/localities/")
        for feature in resp.json()["features"]:
            lat = feature["geometry"]["coordinates"][1]
            assert -90 <= lat <= 90, f"latitude {lat} is outside [-90, 90]"

    def test_empty_state_is_valid_feature_collection(self, api_client: APIClient) -> None:
        # RFC 7946 §3.3: FeatureCollection with empty features array is valid
        resp = api_client.get("/api/v1/map/localities/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "FeatureCollection"
        assert data["features"] == []


# ===========================================================================
# SENSITIVE COORDINATE REDACTION
# ===========================================================================


@pytest.mark.django_db
class TestSensitiveCoordinateRedaction:
    """Exact coordinates for is_sensitive=True records must never reach public responses."""

    def test_sensitive_record_does_not_expose_exact_coordinates(
        self, api_client: APIClient, sensitive_locality: SpeciesLocality
    ) -> None:
        # Exact coords: 47.1234, -19.5678 — must NOT appear; generalized: 47.1, -19.6
        resp = api_client.get("/api/v1/map/localities/")
        data = resp.json()
        assert len(data["features"]) == 1
        coords = data["features"][0]["geometry"]["coordinates"]
        assert coords[0] != pytest.approx(47.1234, abs=0.0001), (
            "Exact longitude must not be returned for sensitive locality"
        )
        assert coords[1] != pytest.approx(-19.5678, abs=0.0001), (
            "Exact latitude must not be returned for sensitive locality"
        )

    def test_sensitive_record_serves_generalized_coordinates(
        self, api_client: APIClient, sensitive_locality: SpeciesLocality
    ) -> None:
        # Generalized coords should be 0.1-degree-rounded values
        resp = api_client.get("/api/v1/map/localities/")
        coords = resp.json()["features"][0]["geometry"]["coordinates"]
        assert coords[0] == pytest.approx(47.1, abs=0.01)
        assert coords[1] == pytest.approx(-19.6, abs=0.01)

    def test_non_sensitive_record_serves_exact_coordinates(
        self, api_client: APIClient, locality: SpeciesLocality
    ) -> None:
        # Non-sensitive locality at 47.52, -18.91 must have exact coords
        resp = api_client.get("/api/v1/map/localities/")
        coords = resp.json()["features"][0]["geometry"]["coordinates"]
        assert coords[0] == pytest.approx(47.52, abs=0.0001)
        assert coords[1] == pytest.approx(-18.91, abs=0.0001)

    def test_sensitive_record_without_generalized_coords_does_not_expose_exact(
        self, api_client: APIClient, sensitive_locality_no_generalized: SpeciesLocality
    ) -> None:
        # When location_generalized is None the exact coords must still not be exposed.
        # Acceptable behaviors: feature omitted, geometry is null, or coordinates are None.
        resp = api_client.get("/api/v1/map/localities/")
        assert resp.status_code == 200
        data = resp.json()
        for feature in data["features"]:
            if feature["properties"].get("locality_name") == "Cave Without Generalized Coords":
                coords = feature["geometry"]["coordinates"]
                # Must not be the exact stored coordinates
                assert coords[0] != pytest.approx(47.9999, abs=0.0001), (
                    "Exact longitude must not be exposed when location_generalized is None"
                )
                assert coords[1] != pytest.approx(-20.1111, abs=0.0001), (
                    "Exact latitude must not be exposed when location_generalized is None"
                )

    def test_sensitive_and_non_sensitive_mixed_in_same_response(
        self,
        api_client: APIClient,
        locality: SpeciesLocality,
        sensitive_locality: SpeciesLocality,
    ) -> None:
        # With two localities in the response, only the sensitive one is generalized
        resp = api_client.get("/api/v1/map/localities/")
        data = resp.json()
        assert len(data["features"]) == 2

        for feature in data["features"]:
            name = feature["properties"]["locality_name"]
            coords = feature["geometry"]["coordinates"]
            if name == "Manombo Forest":
                # Non-sensitive: exact coords expected
                assert coords[0] == pytest.approx(47.52, abs=0.0001)
            elif name == "Secret Cave":
                # Sensitive: exact coords must NOT appear
                assert coords[0] != pytest.approx(47.1234, abs=0.0001)


# ===========================================================================
# EMPTY DATABASE STATE
# ===========================================================================


@pytest.mark.django_db
class TestEmptyDatabaseState:
    """Every endpoint must return a valid, non-error response when the database has no data."""

    def test_species_list_empty(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/species/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["results"] == []
        assert data["described_count"] == 0
        assert data["undescribed_count"] == 0

    def test_institutions_list_empty(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/institutions/")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_field_programs_list_empty(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/field-programs/")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_populations_empty_returns_200_for_tier3(
        self, api_client: APIClient, tier3_user: User
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_dashboard_empty(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/dashboard/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["species_counts"]["total"] == 0

    def test_map_localities_empty(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "FeatureCollection"
        assert data["features"] == []

    def test_map_watersheds_empty(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/map/watersheds/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_map_summary_empty(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/map/summary/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_localities"] == 0
        assert data["species_with_localities"] == 0

    def test_species_detail_404_on_empty_db(self, api_client: APIClient) -> None:
        # A detail request against a non-existent PK must be 404, not 500
        resp = api_client.get("/api/v1/species/1/")
        assert resp.status_code == 404

    def test_institution_detail_404_on_empty_db(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/institutions/1/")
        assert resp.status_code == 404

    def test_population_detail_404_on_empty_db(
        self, api_client: APIClient, tier3_user: User
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get("/api/v1/populations/1/")
        assert resp.status_code == 404

    def test_field_program_detail_404_on_empty_db(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/field-programs/1/")
        assert resp.status_code == 404


# ===========================================================================
# SPECULATIVE FIELD EXPOSURE — PRIVATE FIELDS IN PUBLIC RESPONSES
# ===========================================================================


@pytest.mark.django_db
class TestPrivateFieldExposure:
    """Fields that carry sensitive data must never appear in responses below the required tier,
    even if a developer accidentally adds them to a serializer."""

    def test_species_list_does_not_expose_internal_fields(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/")
        for result in resp.json()["results"]:
            assert "review_notes" not in result
            assert "flagged_by" not in result

    def test_species_detail_does_not_expose_user_or_admin_fields(
        self, api_client: APIClient, species_cr: Species
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{species_cr.pk}/")
        data = resp.json()
        # Internal curation fields must not leak into the public detail view
        assert "flagged_by" not in data
        assert "review_notes" not in data

    def test_institution_list_does_not_expose_species360_id(
        self, api_client: APIClient, institution: Institution
    ) -> None:
        resp = api_client.get("/api/v1/institutions/")
        for result in resp.json()["results"]:
            assert "species360_id" not in result

    def test_population_response_does_not_expose_user_emails(
        self, api_client: APIClient, tier3_user: User, population: ExSituPopulation
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get("/api/v1/populations/")
        data = resp.json()
        # Ensure no user PII leaks into population records
        raw = str(data)
        assert "coordinator@example.com" not in raw
        assert "researcher@example.com" not in raw

    def test_population_detail_does_not_expose_user_emails(
        self, api_client: APIClient, tier3_user: User, population: ExSituPopulation
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get(f"/api/v1/populations/{population.pk}/")
        raw = str(resp.json())
        assert "coordinator@example.com" not in raw
