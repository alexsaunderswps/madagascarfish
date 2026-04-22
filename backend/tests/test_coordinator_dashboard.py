"""Tests for the Gate 3 Ex-situ Coordinator Dashboard endpoints.

Currently covers Panel 4 (stale census). Follow-on panels (coverage gap,
studbook status, sex-ratio) land in separate PRs.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from populations.models import ExSituPopulation, HoldingRecord, Institution
from species.models import Species

STALE_ENDPOINT = "/api/v1/coordinator-dashboard/stale-census/"
COVERAGE_GAP_ENDPOINT = "/api/v1/coordinator-dashboard/coverage-gap/"


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
    inst = Institution.objects.create(name="Inst A", institution_type="zoo", country="DE")
    return User.objects.create_user(
        email="coordinator@example.com",
        password="securepass12345",
        name="Coordinator",
        access_tier=3,
        is_active=True,
        institution=inst,
    )


@pytest.fixture
def species_one(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def species_two(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        taxonomic_status="described",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status="EN",
    )


@pytest.fixture
def institution_zoo(db: None) -> Institution:
    return Institution.objects.create(
        name="ABQ BioPark",
        institution_type="aquarium",
        country="United States",
    )


@pytest.mark.django_db
class TestStaleCensusAuth:
    def test_anonymous_403(self, api_client: APIClient) -> None:
        assert api_client.get(STALE_ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier2_403(self, api_client: APIClient, tier2_user: User) -> None:
        api_client.force_authenticate(user=tier2_user)
        assert api_client.get(STALE_ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier3_200(self, api_client: APIClient, tier3_user: User) -> None:
        api_client.force_authenticate(user=tier3_user)
        resp = api_client.get(STALE_ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["threshold_months"] == 12
        assert "reference_date" in body
        assert body["total_populations"] == 0
        assert body["total_stale"] == 0
        assert body["results"] == []


@pytest.mark.django_db
class TestStaleCensusLogic:
    def _pop(
        self,
        species: Species,
        institution: Institution,
        last_census: date | None,
    ) -> ExSituPopulation:
        return ExSituPopulation.objects.create(
            species=species,
            institution=institution,
            count_total=10,
            breeding_status="unknown",
            last_census_date=last_census,
        )

    def test_fresh_census_excluded(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_one: Species,
        institution_zoo: Institution,
    ) -> None:
        today = date.today()
        self._pop(species_one, institution_zoo, today - timedelta(days=30))
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(STALE_ENDPOINT).json()
        assert body["total_populations"] == 1
        assert body["total_stale"] == 0

    def test_stale_by_last_census_date(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_one: Species,
        institution_zoo: Institution,
    ) -> None:
        today = date.today()
        self._pop(species_one, institution_zoo, today - timedelta(days=400))
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(STALE_ENDPOINT).json()
        assert body["total_stale"] == 1
        row = body["results"][0]
        assert row["species"]["scientific_name"] == "Paretroplus menarambo"
        assert row["days_since_update"] == 400

    def test_never_censused_is_stale(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_one: Species,
        institution_zoo: Institution,
    ) -> None:
        self._pop(species_one, institution_zoo, None)
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(STALE_ENDPOINT).json()
        assert body["total_stale"] == 1
        row = body["results"][0]
        assert row["effective_last_update"] is None
        assert row["days_since_update"] is None

    def test_holding_record_rescues_stale_last_census_date(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_one: Species,
        institution_zoo: Institution,
    ) -> None:
        """Effective signal is the newest of (last_census_date, latest HoldingRecord.date).

        A population whose last_census_date is >12 months old but that has a
        recent HoldingRecord is NOT stale.
        """
        today = date.today()
        pop = self._pop(species_one, institution_zoo, today - timedelta(days=400))
        HoldingRecord.objects.create(population=pop, date=today - timedelta(days=10), count_total=8)
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(STALE_ENDPOINT).json()
        assert body["total_stale"] == 0

    def test_stale_holding_record_still_stale(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_one: Species,
        institution_zoo: Institution,
    ) -> None:
        today = date.today()
        pop = self._pop(species_one, institution_zoo, today - timedelta(days=500))
        HoldingRecord.objects.create(
            population=pop, date=today - timedelta(days=450), count_total=8
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(STALE_ENDPOINT).json()
        assert body["total_stale"] == 1
        row = body["results"][0]
        # effective_last_update = max(500d ago, 450d ago) = 450d ago
        assert row["days_since_update"] == 450

    def test_sort_never_censused_first_then_oldest(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_one: Species,
        species_two: Species,
        institution_zoo: Institution,
    ) -> None:
        today = date.today()
        self._pop(species_one, institution_zoo, today - timedelta(days=400))
        inst_b = Institution.objects.create(name="Inst B", institution_type="zoo", country="DE")
        self._pop(species_two, inst_b, None)  # never censused
        inst_c = Institution.objects.create(name="Inst C", institution_type="zoo", country="DE")
        self._pop(species_one, inst_c, today - timedelta(days=600))

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(STALE_ENDPOINT).json()
        assert body["total_stale"] == 3
        results = body["results"]
        # Never-censused first (days_since None sorts before anything)
        assert results[0]["days_since_update"] is None
        # Then 600-day, then 400-day
        assert results[1]["days_since_update"] == 600
        assert results[2]["days_since_update"] == 400


# ---------- Panel 1: Coverage Gap ----------


def _mkspecies(
    name: str,
    iucn: str | None,
    *,
    endemic: str = "endemic",
    family: str = "Cichlidae",
    genus: str = "Paretroplus",
) -> Species:
    return Species.objects.create(
        scientific_name=name,
        taxonomic_status="described",
        family=family,
        genus=genus,
        endemic_status=endemic,
        iucn_status=iucn,
    )


@pytest.mark.django_db
class TestCoverageGapAuth:
    def test_anonymous_403(self, api_client: APIClient) -> None:
        assert api_client.get(COVERAGE_GAP_ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier2_403(self, api_client: APIClient, tier2_user: User) -> None:
        api_client.force_authenticate(user=tier2_user)
        assert api_client.get(COVERAGE_GAP_ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier3_200(self, api_client: APIClient, tier3_user: User) -> None:
        api_client.force_authenticate(user=tier3_user)
        resp = api_client.get(COVERAGE_GAP_ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["endemic_only"] is True
        assert body["total"] == 0
        assert body["results"] == []
        assert body["data_deficient"] == {"total": 0, "endemic_count": 0}


@pytest.mark.django_db
class TestCoverageGapFilter:
    def test_only_cr_en_vu_without_populations(
        self,
        api_client: APIClient,
        tier3_user: User,
        institution_zoo: Institution,
    ) -> None:
        # Included: CR/EN/VU endemic with zero populations
        sp_cr = _mkspecies("Paretroplus menarambo", "CR")
        sp_en = _mkspecies("Pachypanchax sakaramyi", "EN", genus="Pachypanchax")
        sp_vu = _mkspecies("Bedotia geayi", "VU", genus="Bedotia", family="Bedotiidae")
        # Excluded: CR with a population
        sp_covered = _mkspecies("Paretroplus dambabe", "CR")
        ExSituPopulation.objects.create(
            species=sp_covered,
            institution=institution_zoo,
            count_total=10,
            breeding_status="unknown",
        )
        # Excluded: NT, LC, DD, null
        _mkspecies("Species nt", "NT")
        _mkspecies("Species lc", "LC")
        _mkspecies("Species dd", "DD")
        _mkspecies("Species null", None)

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(COVERAGE_GAP_ENDPOINT).json()
        assert body["total"] == 3
        names = [r["scientific_name"] for r in body["results"]]
        assert set(names) == {sp_cr.scientific_name, sp_en.scientific_name, sp_vu.scientific_name}

    def test_severity_sort_cr_en_vu_then_name(
        self,
        api_client: APIClient,
        tier3_user: User,
    ) -> None:
        _mkspecies("Zeta zeta", "VU")
        _mkspecies("Alpha alpha", "CR")
        _mkspecies("Mid mid", "EN")
        _mkspecies("Beta beta", "CR")

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(COVERAGE_GAP_ENDPOINT).json()
        names = [r["scientific_name"] for r in body["results"]]
        assert names == ["Alpha alpha", "Beta beta", "Mid mid", "Zeta zeta"]

    def test_endemic_only_default_excludes_non_endemic(
        self,
        api_client: APIClient,
        tier3_user: User,
    ) -> None:
        _mkspecies("Endemic A", "CR", endemic="endemic")
        _mkspecies("Introduced B", "CR", endemic="introduced")
        _mkspecies("Native C", "CR", endemic="native")

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(COVERAGE_GAP_ENDPOINT).json()
        assert body["endemic_only"] is True
        assert [r["scientific_name"] for r in body["results"]] == ["Endemic A"]

    def test_endemic_only_false_returns_all(
        self,
        api_client: APIClient,
        tier3_user: User,
    ) -> None:
        _mkspecies("Endemic A", "CR", endemic="endemic")
        _mkspecies("Introduced B", "CR", endemic="introduced")
        _mkspecies("Native C", "CR", endemic="native")

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(f"{COVERAGE_GAP_ENDPOINT}?endemic_only=false").json()
        assert body["endemic_only"] is False
        assert body["total"] == 3

    def test_data_deficient_companion_card(
        self,
        api_client: APIClient,
        tier3_user: User,
    ) -> None:
        _mkspecies("DD endemic 1", "DD", endemic="endemic")
        _mkspecies("DD endemic 2", "DD", endemic="endemic")
        _mkspecies("DD introduced", "DD", endemic="introduced")
        _mkspecies("CR endemic", "CR", endemic="endemic")  # not DD — shouldn't count

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(COVERAGE_GAP_ENDPOINT).json()
        assert body["data_deficient"]["total"] == 3
        assert body["data_deficient"]["endemic_count"] == 2

    def test_row_shape_has_expected_fields(
        self,
        api_client: APIClient,
        tier3_user: User,
    ) -> None:
        _mkspecies("Paretroplus menarambo", "CR")

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(COVERAGE_GAP_ENDPOINT).json()
        row = body["results"][0]
        assert set(row.keys()) == {
            "species_id",
            "scientific_name",
            "genus",
            "family",
            "iucn_status",
            "endemic_status",
            "population_trend",
            "cares_status",
            "shoal_priority",
        }
