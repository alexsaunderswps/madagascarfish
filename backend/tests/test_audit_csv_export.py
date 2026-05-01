"""Tests for the audit-trail CSV export endpoint.

`GET /api/v1/audit/export.csv` — Tier 3+ only. Streams audit rows as
CSV with optional institution / date / target_type filters.
"""

from __future__ import annotations

import csv
import io
from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from audit.models import AuditEntry
from fieldwork.models import FieldProgram
from populations.models import BreedingEvent, ExSituPopulation, Institution
from species.models import Species

ENDPOINT = "/api/v1/audit/export.csv"


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def institution_a(db: None) -> Institution:
    return Institution.objects.create(name="Aquarium A", institution_type="aquarium", country="US")


@pytest.fixture
def institution_b(db: None) -> Institution:
    return Institution.objects.create(name="Aquarium B", institution_type="aquarium", country="DE")


@pytest.fixture
def species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


def _user(*, email: str, tier: int, institution: Institution | None = None) -> User:
    return User.objects.create_user(
        email=email,
        password="securepass12345",
        name=email.split("@")[0],
        access_tier=tier,
        is_active=True,
        institution=institution,
    )


def _parse_csv(body: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(body)))


@pytest.mark.django_db
class TestAuth:
    def test_anonymous_unauthorized(self, api_client: APIClient) -> None:
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_tier1_forbidden(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="t1@example.com", tier=1))
        assert api_client.get(ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier2_forbidden(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="t2@example.com", tier=2))
        assert api_client.get(ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier3_allowed(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="coord@example.com", tier=3))
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        assert resp["Content-Type"].startswith("text/csv")
        assert resp["Content-Disposition"].startswith("attachment;")


@pytest.mark.django_db
class TestCSVOutput:
    def test_header_present(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="hdr@example.com", tier=3))
        resp = api_client.get(ENDPOINT)
        body = b"".join(resp.streaming_content).decode()
        rows = _parse_csv(body)
        # No data rows on an empty DB but the header should be parseable.
        # csv.DictReader returns [] when there are no data rows; manually
        # check the first line.
        first_line = body.splitlines()[0]
        assert "timestamp" in first_line
        assert "actor_email" in first_line
        assert "target_label" in first_line
        assert rows == []

    def test_includes_one_row_per_audit_entry(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species: Species,
    ) -> None:
        pop = ExSituPopulation.objects.create(
            species=species, institution=institution_a, count_total=10
        )
        actor = _user(email="actor@example.com", tier=2, institution=institution_a)
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_user=actor,
            actor_institution_id=institution_a.pk,
            action=AuditEntry.Action.UPDATE,
            before={"count_total": 10},
            after={"count_total": 12},
            reason="weekly census",
        )
        api_client.force_authenticate(user=_user(email="coord1@example.com", tier=3))
        # Filter to the population target so the species-creation audit
        # row from gate-06b governance signals doesn't show up.
        resp = api_client.get(f"{ENDPOINT}?target_type=populations.ExSituPopulation")
        rows = _parse_csv(b"".join(resp.streaming_content).decode())
        assert len(rows) == 1
        row = rows[0]
        assert row["actor_email"] == "actor@example.com"
        assert row["actor_institution"] == "Aquarium A"
        assert row["action"] == "update"
        assert row["target_type"] == "populations.ExSituPopulation"
        assert "Paretroplus menarambo" in row["target_label"]
        assert "Aquarium A" in row["target_label"]
        assert '"count_total": 12' in row["after"]
        assert row["reason"] == "weekly census"


@pytest.mark.django_db
class TestFilters:
    def test_institution_id_filter(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        species: Species,
    ) -> None:
        # One row at A, one row at B. Filter by institution A → only A.
        pop_a = ExSituPopulation.objects.create(
            species=species, institution=institution_a, count_total=10
        )
        pop_b = ExSituPopulation.objects.create(
            species=species, institution=institution_b, count_total=20
        )
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop_a.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_institution_id=institution_a.pk,
            action=AuditEntry.Action.UPDATE,
            before={"count_total": 10},
            after={"count_total": 12},
        )
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop_b.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_institution_id=institution_b.pk,
            action=AuditEntry.Action.UPDATE,
            before={"count_total": 20},
            after={"count_total": 22},
        )
        api_client.force_authenticate(user=_user(email="coord2@example.com", tier=3))
        resp = api_client.get(f"{ENDPOINT}?institution_id={institution_a.pk}")
        rows = _parse_csv(b"".join(resp.streaming_content).decode())
        assert len(rows) == 1
        assert rows[0]["actor_institution"] == "Aquarium A"

    def test_date_range_filter(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species: Species,
    ) -> None:
        pop = ExSituPopulation.objects.create(
            species=species, institution=institution_a, count_total=10
        )
        # Old row outside the window.
        old = AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_institution_id=institution_a.pk,
            action=AuditEntry.Action.UPDATE,
            before={"count_total": 5},
            after={"count_total": 6},
        )
        # Force the older row's timestamp to a known value.
        AuditEntry.objects.filter(pk=old.pk).update(timestamp=timezone.now() - timedelta(days=400))
        # Recent row inside the window.
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_institution_id=institution_a.pk,
            action=AuditEntry.Action.UPDATE,
            before={"count_total": 10},
            after={"count_total": 12},
        )
        start = (timezone.now().date() - timedelta(days=30)).isoformat()
        api_client.force_authenticate(user=_user(email="coord3@example.com", tier=3))
        resp = api_client.get(f"{ENDPOINT}?start={start}&target_type=populations.ExSituPopulation")
        rows = _parse_csv(b"".join(resp.streaming_content).decode())
        assert len(rows) == 1

    def test_invalid_date_returns_400(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="coord4@example.com", tier=3))
        resp = api_client.get(f"{ENDPOINT}?start=not-a-date")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_target_type_filter(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species: Species,
    ) -> None:
        pop = ExSituPopulation.objects.create(
            species=species, institution=institution_a, count_total=10
        )
        ev = BreedingEvent.objects.create(
            population=pop, event_type="hatching", event_date=date(2026, 4, 1)
        )
        # Two rows, different target types.
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_institution_id=institution_a.pk,
            action=AuditEntry.Action.UPDATE,
            before={},
            after={"count_total": 10},
        )
        AuditEntry.objects.create(
            target_type="populations.BreedingEvent",
            target_id=ev.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_institution_id=institution_a.pk,
            action=AuditEntry.Action.CREATE,
            before={},
            after={"event_type": "hatching"},
        )
        api_client.force_authenticate(user=_user(email="coord5@example.com", tier=3))
        resp = api_client.get(f"{ENDPOINT}?target_type=populations.BreedingEvent")
        rows = _parse_csv(b"".join(resp.streaming_content).decode())
        assert len(rows) == 1
        assert rows[0]["target_type"] == "populations.BreedingEvent"

    def test_field_program_target_resolves(
        self,
        api_client: APIClient,
        institution_a: Institution,
    ) -> None:
        fp = FieldProgram.objects.create(
            name="Manombo monitoring",
            description="x",
            lead_institution=institution_a,
            status="active",
        )
        AuditEntry.objects.create(
            target_type="fieldwork.FieldProgram",
            target_id=fp.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_institution_id=institution_a.pk,
            action=AuditEntry.Action.UPDATE,
            before={"status": "planned"},
            after={"status": "active"},
        )
        api_client.force_authenticate(user=_user(email="coord6@example.com", tier=3))
        resp = api_client.get(ENDPOINT)
        rows = _parse_csv(b"".join(resp.streaming_content).decode())
        assert any(r["target_label"] == "Manombo monitoring" for r in rows)
