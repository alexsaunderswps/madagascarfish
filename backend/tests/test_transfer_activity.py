"""Tests for the coordinator dashboard transfer-activity endpoint (Gate 4 Phase 1)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from populations.models import CoordinatedProgram, Institution, Transfer
from species.models import Species

ENDPOINT = "/api/v1/coordinator-dashboard/transfer-activity/"


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
        name="ABQ BioPark",
        institution_type="aquarium",
        country="United States",
    )


@pytest.fixture
def inst_b(db: None) -> Institution:
    return Institution.objects.create(
        name="Cologne Zoo",
        institution_type="zoo",
        country="Germany",
    )


def _mk_transfer(
    species: Species,
    src: Institution,
    dst: Institution,
    *,
    status_value: str = Transfer.Status.PROPOSED,
    proposed_date: date | None = None,
    actual_date: date | None = None,
    cites: str = "",
) -> Transfer:
    return Transfer.objects.create(
        species=species,
        source_institution=src,
        destination_institution=dst,
        status=status_value,
        proposed_date=proposed_date or date(2026, 3, 1),
        actual_date=actual_date,
        cites_reference=cites,
    )


@pytest.mark.django_db
class TestTransferActivityAuth:
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
        assert body["window_days"] == 90
        assert body["in_flight_count"] == 0
        assert body["recent_completed_count"] == 0
        assert body["in_flight"] == []
        assert body["recent_completed"] == []

    def test_service_token_grants_access(self, api_client: APIClient, settings: object) -> None:
        settings.COORDINATOR_API_TOKEN = "test-service-token"  # type: ignore[attr-defined]
        resp = api_client.get(ENDPOINT, HTTP_AUTHORIZATION="Bearer test-service-token")
        assert resp.status_code == status.HTTP_200_OK

    def test_wrong_token_rejected(self, api_client: APIClient, settings: object) -> None:
        settings.COORDINATOR_API_TOKEN = "test-service-token"  # type: ignore[attr-defined]
        resp = api_client.get(ENDPOINT, HTTP_AUTHORIZATION="Bearer wrong")
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestTransferActivityLogic:
    def test_in_flight_includes_proposed_approved_in_transit(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        _mk_transfer(species_cr, inst_a, inst_b, status_value=Transfer.Status.PROPOSED)
        _mk_transfer(species_cr, inst_b, inst_a, status_value=Transfer.Status.APPROVED)
        _mk_transfer(species_cr, inst_a, inst_b, status_value=Transfer.Status.IN_TRANSIT)
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        assert body["in_flight_count"] == 3
        statuses = {row["status"] for row in body["in_flight"]}
        assert statuses == {"proposed", "approved", "in_transit"}

    def test_completed_in_window_counted_as_recent(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        today = date.today()
        _mk_transfer(
            species_cr,
            inst_a,
            inst_b,
            status_value=Transfer.Status.COMPLETED,
            actual_date=today - timedelta(days=30),
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        assert body["recent_completed_count"] == 1
        assert body["in_flight_count"] == 0

    def test_completed_outside_window_excluded(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        today = date.today()
        _mk_transfer(
            species_cr,
            inst_a,
            inst_b,
            status_value=Transfer.Status.COMPLETED,
            actual_date=today - timedelta(days=120),
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        assert body["recent_completed_count"] == 0

    def test_cancelled_excluded_from_both_lists(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        _mk_transfer(species_cr, inst_a, inst_b, status_value=Transfer.Status.CANCELLED)
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()
        assert body["in_flight_count"] == 0
        assert body["recent_completed_count"] == 0

    def test_in_flight_sorted_by_proposed_date_ascending(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        # Oldest-proposed should come first — surfaces stuck ones at the top.
        _mk_transfer(
            species_cr,
            inst_a,
            inst_b,
            status_value=Transfer.Status.PROPOSED,
            proposed_date=date(2026, 2, 1),
        )
        _mk_transfer(
            species_cr,
            inst_b,
            inst_a,
            status_value=Transfer.Status.PROPOSED,
            proposed_date=date(2025, 11, 1),
        )
        api_client.force_authenticate(user=tier3_user)
        rows = api_client.get(ENDPOINT).json()["in_flight"]
        assert [r["proposed_date"] for r in rows] == ["2025-11-01", "2026-02-01"]

    def test_row_shape(
        self,
        api_client: APIClient,
        tier3_user: User,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        program = CoordinatedProgram.objects.create(
            species=species_cr,
            program_type=CoordinatedProgram.ProgramType.SSP,
            name="SSP",
        )
        t = Transfer.objects.create(
            species=species_cr,
            source_institution=inst_a,
            destination_institution=inst_b,
            proposed_date=date(2026, 3, 1),
            cites_reference="CITES-2026-001",
            coordinated_program=program,
        )
        api_client.force_authenticate(user=tier3_user)
        row = api_client.get(ENDPOINT).json()["in_flight"][0]
        assert row["transfer_id"] == t.id
        assert row["species"]["scientific_name"] == "Paretroplus menarambo"
        assert row["source_institution"]["name"] == "ABQ BioPark"
        assert row["destination_institution"]["name"] == "Cologne Zoo"
        assert row["cites_reference"] == "CITES-2026-001"
        assert row["coordinated_program_id"] == program.id
