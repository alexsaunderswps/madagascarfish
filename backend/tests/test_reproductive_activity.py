"""Tests for Panel 7 (recent reproductive activity) on the coordinator dashboard.

Covers: tier gate matches the rest of the panel suite, empty payloads
render cleanly (not 5xx), the 90-day window is enforced, the by-event-type
roll-up is structurally complete, and the result list is capped.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from populations.models import (
    BreedingEvent,
    ExSituPopulation,
    Institution,
)
from species.models import Species
from species.views_coordinator_dashboard import (
    REPRODUCTIVE_ACTIVITY_RESULT_LIMIT,
    REPRODUCTIVE_ACTIVITY_WINDOW_DAYS,
)

ENDPOINT = "/api/v1/coordinator-dashboard/reproductive-activity/"


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def tier2_user(db: None) -> User:
    return User.objects.create_user(
        email="r@example.com",
        password="securepass12345",
        name="Researcher",
        access_tier=2,
        is_active=True,
    )


@pytest.fixture
def tier3_user(db: None) -> User:
    inst = Institution.objects.create(name="Coord-Inst", institution_type="zoo", country="DE")
    return User.objects.create_user(
        email="c@example.com",
        password="securepass12345",
        name="Coordinator",
        access_tier=3,
        is_active=True,
        institution=inst,
    )


@pytest.fixture
def species_cr(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def species_en(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        taxonomic_status="described",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status="EN",
    )


@pytest.fixture
def population(species_cr: Species) -> ExSituPopulation:
    inst = Institution.objects.create(name="Bristol Zoo", institution_type="zoo", country="GB")
    return ExSituPopulation.objects.create(
        species=species_cr,
        institution=inst,
        count_total=12,
        breeding_status="breeding",
    )


@pytest.fixture
def population_two(species_en: Species) -> ExSituPopulation:
    inst = Institution.objects.create(name="Cologne Zoo", institution_type="zoo", country="DE")
    return ExSituPopulation.objects.create(
        species=species_en,
        institution=inst,
        count_total=8,
        breeding_status="breeding",
    )


# ---------------------------------------------------------------------------
# auth
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAuth:
    def test_anonymous_403(self, api_client: APIClient) -> None:
        assert api_client.get(ENDPOINT).status_code == status.HTTP_401_UNAUTHORIZED

    def test_tier2_403(self, api_client: APIClient, tier2_user: User) -> None:
        api_client.force_authenticate(user=tier2_user)
        assert api_client.get(ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier3_200(self, api_client: APIClient, tier3_user: User) -> None:
        api_client.force_authenticate(user=tier3_user)
        assert api_client.get(ENDPOINT).status_code == status.HTTP_200_OK

    def test_service_token_grants_access(self, api_client: APIClient, settings: object) -> None:
        settings.COORDINATOR_API_TOKEN = "test-service-token"  # type: ignore[attr-defined]
        resp = api_client.get(ENDPOINT, HTTP_AUTHORIZATION="Bearer test-service-token")
        assert resp.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# payload shape and behavior
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPayload:
    def _get(self, api_client: APIClient, tier3_user: User) -> dict:
        api_client.force_authenticate(user=tier3_user)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        return resp.json()

    def test_empty_payload_renders_cleanly(self, api_client: APIClient, tier3_user: User) -> None:
        """A platform with no BreedingEvent rows must return a valid 200,
        not a 5xx, with a fully-typed empty roll-up so the frontend can
        render a stable empty state."""
        body = self._get(api_client, tier3_user)
        assert body["total_events"] == 0
        assert body["window_days"] == REPRODUCTIVE_ACTIVITY_WINDOW_DAYS
        assert body["result_limit"] == REPRODUCTIVE_ACTIVITY_RESULT_LIMIT
        assert body["results"] == []
        # Every event-type bucket present, all zero — a stable contract for
        # the frontend so it can iterate without conditional keys.
        expected = {"spawning", "hatching", "mortality", "acquisition", "disposition", "other"}
        assert set(body["by_event_type"].keys()) == expected
        for bucket in body["by_event_type"].values():
            assert bucket["count"] == 0
            assert bucket["recent_species"] == []

    def test_window_excludes_old_events(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        today = date.today()
        # One event inside the window, one outside.
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=today - timedelta(days=10),
            count_delta_unsexed=20,
        )
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=today - timedelta(days=REPRODUCTIVE_ACTIVITY_WINDOW_DAYS + 5),
            count_delta_unsexed=15,
        )
        body = self._get(api_client, tier3_user)
        assert body["total_events"] == 1
        assert len(body["results"]) == 1
        assert body["by_event_type"]["hatching"]["count"] == 1

    def test_event_serialization_is_complete(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
        species_cr: Species,
    ) -> None:
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=date.today() - timedelta(days=15),
            count_delta_unsexed=42,
            notes="Spawn from main pair, tank 4.",
        )
        body = self._get(api_client, tier3_user)
        row = body["results"][0]
        assert row["event_type"] == "hatching"
        assert row["count_delta_unsexed"] == 42
        assert row["population"]["species"]["scientific_name"] == "Paretroplus menarambo"
        assert row["population"]["institution"]["name"] == "Bristol Zoo"
        assert row["notes"].startswith("Spawn from main pair")

    def test_recent_species_capped_per_bucket(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
        population_two: ExSituPopulation,
    ) -> None:
        """recent_species should de-duplicate by species and cap at 5."""
        today = date.today()
        # Same population, three hatching events — only one species name.
        for i in range(3):
            BreedingEvent.objects.create(
                population=population,
                event_type=BreedingEvent.EventType.HATCHING,
                event_date=today - timedelta(days=i + 1),
                count_delta_unsexed=10,
            )
        BreedingEvent.objects.create(
            population=population_two,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=today - timedelta(days=4),
            count_delta_unsexed=5,
        )
        body = self._get(api_client, tier3_user)
        bucket = body["by_event_type"]["hatching"]
        assert bucket["count"] == 4
        # Two distinct species, each appears once.
        assert sorted(bucket["recent_species"]) == sorted(
            ["Paretroplus menarambo", "Bedotia geayi"]
        )

    def test_results_list_capped_at_limit(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        today = date.today()
        # Create more events than the result limit.
        for i in range(REPRODUCTIVE_ACTIVITY_RESULT_LIMIT + 5):
            BreedingEvent.objects.create(
                population=population,
                event_type=BreedingEvent.EventType.MORTALITY,
                event_date=today - timedelta(days=i + 1),
                count_delta_unsexed=-1,
            )
        body = self._get(api_client, tier3_user)
        assert body["total_events"] == REPRODUCTIVE_ACTIVITY_RESULT_LIMIT + 5
        assert len(body["results"]) == REPRODUCTIVE_ACTIVITY_RESULT_LIMIT
        # Newest first.
        dates = [r["event_date"] for r in body["results"]]
        assert dates == sorted(dates, reverse=True)
