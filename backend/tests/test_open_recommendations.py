"""Tests for the coordinator dashboard open-recommendations endpoint
(Gate 4 Phase 2)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from populations.models import (
    BreedingRecommendation,
    CoordinatedProgram,
    Institution,
)
from species.models import Species

ENDPOINT = "/api/v1/coordinator-dashboard/open-recommendations/"


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
def inst_a(db: None) -> Institution:
    return Institution.objects.create(
        name="Bristol Zoo Project",
        institution_type="zoo",
        country="United Kingdom",
    )


def _mk_rec(
    species: Species,
    *,
    priority: str = BreedingRecommendation.Priority.MEDIUM,
    status_value: str = BreedingRecommendation.Status.OPEN,
    rtype: str = BreedingRecommendation.RecommendationType.BREED,
    issued: date | None = None,
    due: date | None = None,
    target: Institution | None = None,
) -> BreedingRecommendation:
    return BreedingRecommendation.objects.create(
        species=species,
        recommendation_type=rtype,
        priority=priority,
        status=status_value,
        issued_date=issued or date(2026, 4, 1),
        due_date=due,
        target_institution=target,
    )


@pytest.mark.django_db
class TestOpenRecommendationsAuth:
    def test_anonymous_403(self, api_client: APIClient) -> None:
        assert api_client.get(ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier2_403(self, api_client: APIClient, tier2_user: User) -> None:
        api_client.force_authenticate(user=tier2_user)
        assert api_client.get(ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier3_200(self, api_client: APIClient, tier3_user: User) -> None:
        api_client.force_authenticate(user=tier3_user)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["total_open"] == 0
        assert body["overdue_count"] == 0
        assert body["results"] == []

    def test_service_token_grants_access(self, api_client: APIClient, settings: object) -> None:
        settings.COORDINATOR_API_TOKEN = "test-service-token"  # type: ignore[attr-defined]
        resp = api_client.get(ENDPOINT, HTTP_AUTHORIZATION="Bearer test-service-token")
        assert resp.status_code == status.HTTP_200_OK

    def test_wrong_token_rejected(self, api_client: APIClient, settings: object) -> None:
        settings.COORDINATOR_API_TOKEN = "test-service-token"  # type: ignore[attr-defined]
        resp = api_client.get(ENDPOINT, HTTP_AUTHORIZATION="Bearer wrong")
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestOpenRecommendationsLogic:
    def test_open_and_in_progress_included(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
    ) -> None:
        _mk_rec(species_cr, status_value=BreedingRecommendation.Status.OPEN)
        _mk_rec(species_cr, status_value=BreedingRecommendation.Status.IN_PROGRESS)
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        assert body["total_open"] == 2

    def test_terminal_statuses_excluded(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
    ) -> None:
        # Only open + in_progress should appear; the three terminal states
        # are archived.
        _mk_rec(species_cr, status_value=BreedingRecommendation.Status.OPEN)
        _mk_rec(species_cr, status_value=BreedingRecommendation.Status.COMPLETED)
        _mk_rec(species_cr, status_value=BreedingRecommendation.Status.SUPERSEDED)
        _mk_rec(species_cr, status_value=BreedingRecommendation.Status.CANCELLED)
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        assert body["total_open"] == 1

    def test_priority_sort_critical_first(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
    ) -> None:
        _mk_rec(species_cr, priority=BreedingRecommendation.Priority.LOW)
        _mk_rec(species_cr, priority=BreedingRecommendation.Priority.CRITICAL)
        _mk_rec(species_cr, priority=BreedingRecommendation.Priority.MEDIUM)
        _mk_rec(species_cr, priority=BreedingRecommendation.Priority.HIGH)
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        priorities = [r["priority"] for r in body["results"]]
        assert priorities == ["critical", "high", "medium", "low"]

    def test_within_priority_newer_first(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
    ) -> None:
        _mk_rec(
            species_cr,
            priority=BreedingRecommendation.Priority.HIGH,
            issued=date(2026, 1, 15),
        )
        _mk_rec(
            species_cr,
            priority=BreedingRecommendation.Priority.HIGH,
            issued=date(2026, 4, 15),
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        dates = [r["issued_date"] for r in body["results"]]
        assert dates == ["2026-04-15", "2026-01-15"]

    def test_overdue_count_reflects_past_due_dates(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
    ) -> None:
        today = date.today()
        _mk_rec(species_cr, due=today - timedelta(days=10))  # overdue
        _mk_rec(species_cr, due=today - timedelta(days=1))  # overdue
        _mk_rec(species_cr, due=today + timedelta(days=30))  # not overdue
        _mk_rec(species_cr, due=None)  # no due date — not counted
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        assert body["total_open"] == 4
        assert body["overdue_count"] == 2

    def test_row_shape_populates_optional_fields(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
        inst_a: Institution,
    ) -> None:
        program = CoordinatedProgram.objects.create(
            species=species_cr,
            program_type=CoordinatedProgram.ProgramType.EEP,
            name="EAZA EEP: Madagascar rainbowfishes",
        )
        r = BreedingRecommendation.objects.create(
            species=species_cr,
            coordinated_program=program,
            recommendation_type=BreedingRecommendation.RecommendationType.TRANSFER,
            priority=BreedingRecommendation.Priority.HIGH,
            issued_date=date(2026, 4, 1),
            target_institution=inst_a,
            rationale="Expand geographic holdings.",
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        row = body["results"][0]
        assert row["recommendation_id"] == r.id
        assert row["species"]["scientific_name"] == "Paretroplus menarambo"
        assert row["recommendation_type"] == "transfer"
        assert row["priority"] == "high"
        assert row["coordinated_program_id"] == program.id
        assert row["target_institution"] == {
            "id": inst_a.id,
            "name": "Bristol Zoo Project",
        }
        assert row["rationale"] == "Expand geographic holdings."

    def test_target_institution_null_when_unset(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
    ) -> None:
        _mk_rec(species_cr)
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        assert body["results"][0]["target_institution"] is None
