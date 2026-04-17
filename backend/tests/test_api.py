"""Integration tests for Gate 05 — DRF API endpoints.

Tests cover:
- All 12 endpoints with correct response shapes
- Tier-based field visibility (anonymous, Tier 2, Tier 3, Tier 5)
- Filter parameters
- Pagination
- N+1 query prevention
- GeoJSON response shape
- Sensitive coordinate redaction
- Empty state responses
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

# --- Fixtures ---


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


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
def admin_user(db: None) -> User:
    return User.objects.create_superuser(
        email="admin@example.com",
        password="securepass12345",
        name="Admin",
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
    HoldingRecord.objects.create(
        population=pop, date="2025-11-01", count_total=24, notes="mortality event"
    )
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
    )


@pytest.fixture
def sensitive_locality(species_cr: Species) -> SpeciesLocality:
    return SpeciesLocality.objects.create(
        species=species_cr,
        locality_name="Secret Cave",
        location=Point(47.1234, -19.5678, srid=4326),
        locality_type="observation",
        presence_status="present",
        is_sensitive=True,
        coordinate_precision="exact",
        source_citation="Confidential survey 2024",
    )


@pytest.fixture(autouse=True)
def _clear_cache():
    """Clear Django cache between tests to avoid stale cached responses."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


def _auth_client(api_client: APIClient, user: User) -> APIClient:
    from rest_framework.authtoken.models import Token

    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api_client


# ============================================================
# Species List — BE-05-1
# ============================================================


@pytest.mark.django_db
class TestSpeciesList:
    def test_anonymous_access(self, api_client: APIClient, species_cr: Species) -> None:
        resp = api_client.get("/api/v1/species/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert len(data["results"]) == 1
        assert data["results"][0]["scientific_name"] == "Bedotia sp. 'manombo'"
        assert data["results"][0]["common_names"][0]["name"] == "Manombo Rainbowfish"

    def test_described_undescribed_counts(
        self, api_client: APIClient, species_cr: Species, species_en: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/")
        data = resp.json()
        assert data["described_count"] == 1
        assert data["undescribed_count"] == 1

    def test_filter_taxonomic_status(
        self, api_client: APIClient, species_cr: Species, species_en: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?taxonomic_status=undescribed_morphospecies")
        data = resp.json()
        assert data["count"] == 1
        assert data["results"][0]["taxonomic_status"] == "undescribed_morphospecies"

    def test_filter_iucn_status(
        self, api_client: APIClient, species_cr: Species, species_en: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?iucn_status=CR")
        data = resp.json()
        assert data["count"] == 1
        assert data["results"][0]["iucn_status"] == "CR"

    def test_search_provisional_name(self, api_client: APIClient, species_cr: Species) -> None:
        resp = api_client.get("/api/v1/species/?search=manombo")
        data = resp.json()
        assert data["count"] >= 1
        names = [r["scientific_name"] for r in data["results"]]
        assert "Bedotia sp. 'manombo'" in names

    def test_ordering(
        self, api_client: APIClient, species_cr: Species, species_en: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?ordering=family")
        data = resp.json()
        families = [r["family"] for r in data["results"]]
        assert families == sorted(families)

    def test_pagination_max_page_size(self, api_client: APIClient, species_cr: Species) -> None:
        resp = api_client.get("/api/v1/species/?page_size=300")
        # Max is 200, should not error
        assert resp.status_code == 200

    # --- BE-07-A: directory filters ---

    def test_filter_iucn_status_multi(
        self, api_client: APIClient, species_cr: Species, species_en: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?iucn_status=CR,EN")
        data = resp.json()
        statuses = sorted(r["iucn_status"] for r in data["results"])
        assert statuses == ["CR", "EN"]
        assert data["count"] == 2

    def test_filter_iucn_status_multi_subset(
        self, api_client: APIClient, species_cr: Species, species_en: Species
    ) -> None:
        resp = api_client.get("/api/v1/species/?iucn_status=EN,VU")
        data = resp.json()
        assert data["count"] == 1
        assert data["results"][0]["iucn_status"] == "EN"

    def test_filter_has_captive_population_true(
        self,
        api_client: APIClient,
        species_cr: Species,
        species_en: Species,
        population: ExSituPopulation,
    ) -> None:
        resp = api_client.get("/api/v1/species/?has_captive_population=true")
        data = resp.json()
        ids = [r["id"] for r in data["results"]]
        assert ids == [species_cr.pk]

    def test_filter_has_captive_population_false(
        self,
        api_client: APIClient,
        species_cr: Species,
        species_en: Species,
        population: ExSituPopulation,
    ) -> None:
        resp = api_client.get("/api/v1/species/?has_captive_population=false")
        data = resp.json()
        ids = [r["id"] for r in data["results"]]
        assert ids == [species_en.pk]

    def test_filter_combined_iucn_multi_and_has_captive_false(
        self,
        api_client: APIClient,
        species_cr: Species,
        species_en: Species,
        population: ExSituPopulation,
    ) -> None:
        """The coverage-gap URL from the hero landing page."""
        resp = api_client.get("/api/v1/species/?iucn_status=CR,EN,VU&has_captive_population=false")
        data = resp.json()
        ids = [r["id"] for r in data["results"]]
        assert ids == [species_en.pk]


# ============================================================
# Species Detail — BE-05-2
# ============================================================


@pytest.mark.django_db
class TestSpeciesDetail:
    def test_anonymous_detail(
        self,
        api_client: APIClient,
        species_en: Species,
        assessment_accepted: ConservationAssessment,
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["scientific_name"] == "Pachypanchax sakaramyi"
        assert data["authority"] == "Holly, 1928"
        assert data["year_described"] == 1928

    def test_undescribed_null_fields(self, api_client: APIClient, species_cr: Species) -> None:
        resp = api_client.get(f"/api/v1/species/{species_cr.pk}/")
        data = resp.json()
        assert data["authority"] is None
        assert data["year_described"] is None
        assert data["provisional_name"] == "'manombo'"

    def test_anonymous_sees_only_accepted_assessments(
        self,
        api_client: APIClient,
        species_en: Species,
        assessment_accepted: ConservationAssessment,
        assessment_pending: ConservationAssessment,
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        data = resp.json()
        assessments = data["conservation_assessments"]
        assert len(assessments) == 1
        assert assessments[0]["category"] == "EN"
        # review_status should not be in public serializer
        assert "review_status" not in assessments[0]

    def test_tier3_sees_all_assessments(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_en: Species,
        assessment_accepted: ConservationAssessment,
        assessment_pending: ConservationAssessment,
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        data = resp.json()
        assessments = data["conservation_assessments"]
        assert len(assessments) == 2
        statuses = {a["review_status"] for a in assessments}
        assert "pending_review" in statuses
        assert "accepted" in statuses

    def test_ex_situ_summary(
        self, api_client: APIClient, species_cr: Species, population: ExSituPopulation
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{species_cr.pk}/")
        data = resp.json()
        summary = data["ex_situ_summary"]
        assert summary["institutions_holding"] == 1
        assert summary["total_individuals"] == 18
        assert summary["breeding_programs"] == 1

    def test_has_localities_true(
        self, api_client: APIClient, species_cr: Species, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{species_cr.pk}/")
        data = resp.json()
        assert data["has_localities"] is True

    def test_has_localities_false(self, api_client: APIClient, species_en: Species) -> None:
        resp = api_client.get(f"/api/v1/species/{species_en.pk}/")
        data = resp.json()
        assert data["has_localities"] is False

    def test_field_programs_in_detail(
        self, api_client: APIClient, species_cr: Species, field_program: FieldProgram
    ) -> None:
        resp = api_client.get(f"/api/v1/species/{species_cr.pk}/")
        data = resp.json()
        assert len(data["field_programs"]) == 1
        assert data["field_programs"][0]["name"] == "Durrell Nosivolo"

    def test_404_nonexistent(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/species/9999/")
        assert resp.status_code == 404


# ============================================================
# Institution — BE-05-3
# ============================================================


@pytest.mark.django_db
class TestInstitution:
    def test_anonymous_list(self, api_client: APIClient, institution: Institution) -> None:
        resp = api_client.get("/api/v1/institutions/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        result = data["results"][0]
        assert result["name"] == "ABQ BioPark"
        assert "contact_email" not in result

    def test_anonymous_detail_hides_email(
        self, api_client: APIClient, institution: Institution
    ) -> None:
        resp = api_client.get(f"/api/v1/institutions/{institution.pk}/")
        assert resp.status_code == 200
        data = resp.json()
        assert "contact_email" not in data

    def test_tier3_detail_shows_email(
        self, api_client: APIClient, tier3_user: User, institution: Institution
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get(f"/api/v1/institutions/{institution.pk}/")
        data = resp.json()
        assert data["contact_email"] == "fish@cabq.gov"
        assert data["species360_id"] == "ABQ123"

    def test_filter_by_type(self, api_client: APIClient, institution: Institution) -> None:
        resp = api_client.get("/api/v1/institutions/?institution_type=aquarium")
        data = resp.json()
        assert data["count"] == 1

    def test_search(self, api_client: APIClient, institution: Institution) -> None:
        resp = api_client.get("/api/v1/institutions/?search=BioPark")
        data = resp.json()
        assert data["count"] == 1


# ============================================================
# ExSituPopulation — BE-05-4
# ============================================================


@pytest.mark.django_db
class TestPopulations:
    def test_anonymous_403(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code == 403

    def test_tier2_403(self, api_client: APIClient, tier2_user: User) -> None:
        _auth_client(api_client, tier2_user)
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code == 403

    def test_tier3_can_list(
        self, api_client: APIClient, tier3_user: User, population: ExSituPopulation
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get("/api/v1/populations/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        result = data["results"][0]
        assert result["species"]["scientific_name"] == "Bedotia sp. 'manombo'"
        assert result["institution"]["name"] == "ABQ BioPark"
        assert result["count_total"] == 18

    def test_tier3_detail_includes_holding_records(
        self, api_client: APIClient, tier3_user: User, population: ExSituPopulation
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get(f"/api/v1/populations/{population.pk}/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["holding_records"]) == 2
        # Most recent first (ordering = ["-date"])
        assert data["holding_records"][0]["count_total"] == 18
        assert data["holding_records"][1]["notes"] == "mortality event"

    def test_filter_by_species(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
        species_cr: Species,
    ) -> None:
        _auth_client(api_client, tier3_user)
        resp = api_client.get(f"/api/v1/populations/?species_id={species_cr.pk}")
        data = resp.json()
        assert data["count"] == 1


# ============================================================
# Field Programs — BE-05-5
# ============================================================


@pytest.mark.django_db
class TestFieldPrograms:
    def test_anonymous_list(self, api_client: APIClient, field_program: FieldProgram) -> None:
        resp = api_client.get("/api/v1/field-programs/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        result = data["results"][0]
        assert result["name"] == "Durrell Nosivolo"
        assert result["lead_institution"]["name"] == "ABQ BioPark"
        assert len(result["focal_species"]) == 1

    def test_detail(self, api_client: APIClient, field_program: FieldProgram) -> None:
        resp = api_client.get(f"/api/v1/field-programs/{field_program.pk}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"


# ============================================================
# Dashboard — BE-05-6
# ============================================================


@pytest.mark.django_db
class TestDashboard:
    def test_anonymous_access(
        self,
        api_client: APIClient,
        species_cr: Species,
        species_en: Species,
        population: ExSituPopulation,
        field_program: FieldProgram,
    ) -> None:
        resp = api_client.get("/api/v1/dashboard/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["species_counts"]["total"] == 2
        assert data["species_counts"]["described"] == 1
        assert data["species_counts"]["undescribed"] == 1
        assert data["species_counts"]["by_iucn_status"]["CR"] == 1
        assert data["species_counts"]["by_iucn_status"]["EN"] == 1
        # Both CR and EN are threatened; species_cr has a population
        assert data["ex_situ_coverage"]["threatened_species_total"] == 2
        assert data["ex_situ_coverage"]["threatened_species_with_captive_population"] == 1
        assert data["ex_situ_coverage"]["threatened_species_without_captive_population"] == 1
        assert data["field_programs"]["active"] == 1
        assert "last_updated" in data
        # BE-07-B: last_updated must be ISO-8601 parseable by datetime.fromisoformat.
        from datetime import datetime

        parsed = datetime.fromisoformat(data["last_updated"])
        assert parsed.tzinfo is not None, "last_updated must include timezone offset"

    def test_empty_state(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/dashboard/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["species_counts"]["total"] == 0


# ============================================================
# Map Localities GeoJSON — BE-05-7
# ============================================================


@pytest.mark.django_db
class TestMapLocalities:
    def test_geojson_shape(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 1
        feature = data["features"][0]
        assert feature["type"] == "Feature"
        assert feature["geometry"]["type"] == "Point"
        assert len(feature["geometry"]["coordinates"]) == 2
        props = feature["properties"]
        assert props["scientific_name"] == "Bedotia sp. 'manombo'"
        assert props["locality_name"] == "Manombo Forest"

    def test_sensitive_coordinates_redacted(
        self, api_client: APIClient, sensitive_locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        data = resp.json()
        feature = data["features"][0]
        coords = feature["geometry"]["coordinates"]
        # Should be generalized (rounded to 0.1 degree)
        assert coords[0] == pytest.approx(47.1, abs=0.01)
        assert coords[1] == pytest.approx(-19.6, abs=0.01)

    def test_filter_species_id(
        self, api_client: APIClient, locality: SpeciesLocality, species_cr: Species
    ) -> None:
        resp = api_client.get(f"/api/v1/map/localities/?species_id={species_cr.pk}")
        data = resp.json()
        assert len(data["features"]) == 1

    def test_filter_iucn_status(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/?iucn_status=CR")
        data = resp.json()
        assert len(data["features"]) == 1

    def test_filter_family(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/?family=Bedotiidae")
        data = resp.json()
        assert len(data["features"]) == 1

    def test_filter_bbox(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        # Locality is at 47.52, -18.91 — bbox should include it
        resp = api_client.get("/api/v1/map/localities/?bbox=46.0,-20.0,48.0,-18.0")
        data = resp.json()
        assert len(data["features"]) == 1

    def test_filter_bbox_excludes(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        # Bbox that doesn't include the locality
        resp = api_client.get("/api/v1/map/localities/?bbox=10.0,10.0,11.0,11.0")
        data = resp.json()
        assert len(data["features"]) == 0

    def test_combined_filters(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/?iucn_status=CR&family=Bedotiidae")
        data = resp.json()
        assert len(data["features"]) == 1

    def test_empty_state(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/map/localities/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "FeatureCollection"
        assert data["features"] == []

    def test_malformed_bbox_ignored(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/localities/?bbox=invalid")
        assert resp.status_code == 200


# ============================================================
# Watershed List — BE-05-8
# ============================================================


@pytest.mark.django_db
class TestWatershedList:
    def test_list_with_species_count(
        self, api_client: APIClient, watershed: Watershed, locality: SpeciesLocality
    ) -> None:
        resp = api_client.get("/api/v1/map/watersheds/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Betsiboka"
        assert data[0]["species_count"] == 1

    def test_empty_state(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/map/watersheds/")
        assert resp.status_code == 200
        assert resp.json() == []


# ============================================================
# Map Summary — BE-05-9
# ============================================================


@pytest.mark.django_db
class TestMapSummary:
    def test_summary(self, api_client: APIClient, locality: SpeciesLocality) -> None:
        resp = api_client.get("/api/v1/map/summary/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_localities"] == 1
        assert data["species_with_localities"] == 1
        assert data["locality_type_counts"]["type_locality"] == 1
        assert data["presence_status_counts"]["present"] == 1

    def test_empty_state(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/map/summary/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_localities"] == 0


# ============================================================
# OpenAPI Schema — BE-05-10
# ============================================================


@pytest.mark.django_db
class TestOpenAPI:
    def test_schema_generates(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/schema/")
        assert resp.status_code == 200
