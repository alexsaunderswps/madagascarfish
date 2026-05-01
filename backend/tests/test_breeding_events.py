"""Tests for Gate 14 — BreedingEvent institution-scoped write surface.

Same shape as Gate 13's institution-scoped editing — Tier 2 staff can
log events for their institution's populations only; Tier 3+ can log
across all institutions; anonymous and Tier 1 are rejected. Audit hook
writes one ``AuditEntry`` per event with the actor's institution
snapshot.

PATCH and DELETE are NOT exposed at MVP — events are append-only by
convention (corrections happen via follow-up events with notes), so
those verbs return 405 from the viewset's `http_method_names`.
"""

from __future__ import annotations

from datetime import date

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from audit.models import AuditEntry
from populations.models import BreedingEvent, ExSituPopulation, Institution
from species.models import Species

ENDPOINT = "/api/v1/breeding-events/"


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def institution_a(db: None) -> Institution:
    return Institution.objects.create(name="Aquarium A", institution_type="aquarium", country="US")


@pytest.fixture
def institution_b(db: None) -> Institution:
    return Institution.objects.create(name="Aquarium B", institution_type="aquarium", country="US")


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


@pytest.fixture
def population_at_a(institution_a: Institution, species: Species) -> ExSituPopulation:
    return ExSituPopulation.objects.create(
        species=species,
        institution=institution_a,
        count_total=10,
        count_male=4,
        count_female=4,
        count_unsexed=2,
        breeding_status="non-breeding",
    )


@pytest.fixture
def population_at_b(institution_b: Institution, species: Species) -> ExSituPopulation:
    return ExSituPopulation.objects.create(
        species=species,
        institution=institution_b,
        count_total=20,
    )


def _user(
    *,
    email: str,
    tier: int,
    institution: Institution | None = None,
    is_active: bool = True,
) -> User:
    return User.objects.create_user(
        email=email,
        password="securepass12345",
        name=email.split("@")[0],
        access_tier=tier,
        is_active=is_active,
        institution=institution,
    )


@pytest.mark.django_db
class TestBreedingEventList:
    def test_anonymous_unauthorized(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        BreedingEvent.objects.create(
            population=population_at_a,
            event_type="hatching",
            event_date=date(2026, 4, 1),
            count_delta_unsexed=12,
        )
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_tier1_forbidden(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        user = _user(email="t1@example.com", tier=1)
        api_client.force_authenticate(user=user)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_tier2_no_institution_forbidden(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        user = _user(email="t2null@example.com", tier=2)
        api_client.force_authenticate(user=user)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_tier2_sees_only_own_institution_events(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
        population_at_b: ExSituPopulation,
    ) -> None:
        BreedingEvent.objects.create(
            population=population_at_a,
            event_type="hatching",
            event_date=date(2026, 4, 1),
            count_delta_unsexed=12,
            notes="ours",
        )
        BreedingEvent.objects.create(
            population=population_at_b,
            event_type="hatching",
            event_date=date(2026, 4, 2),
            count_delta_unsexed=8,
            notes="theirs",
        )
        user = _user(email="t2a@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json()["results"]
        assert len(results) == 1
        assert results[0]["notes"] == "ours"

    def test_tier3_sees_all_events(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
        population_at_b: ExSituPopulation,
    ) -> None:
        BreedingEvent.objects.create(
            population=population_at_a,
            event_type="hatching",
            event_date=date(2026, 4, 1),
        )
        BreedingEvent.objects.create(
            population=population_at_b,
            event_type="mortality",
            event_date=date(2026, 4, 2),
        )
        coord = _user(email="coord@example.com", tier=3, institution=institution_a)
        api_client.force_authenticate(user=coord)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["count"] == 2

    def test_tier2_cannot_retrieve_other_institution_event(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_b: ExSituPopulation,
    ) -> None:
        ev = BreedingEvent.objects.create(
            population=population_at_b,
            event_type="hatching",
            event_date=date(2026, 4, 2),
        )
        user = _user(email="t2-other@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.get(f"{ENDPOINT}{ev.pk}/")
        # Queryset-scoped: 404, leak nothing.
        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestBreedingEventCreate:
    def _payload(self, population_id: int) -> dict:
        return {
            "population": population_id,
            "event_type": "hatching",
            "event_date": "2026-05-01",
            "count_delta_unsexed": 14,
            "notes": "First successful spawn this season",
        }

    def test_tier2_creates_event_for_own_population(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        user = _user(email="t2create@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.post(ENDPOINT, self._payload(population_at_a.pk), format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        ev = BreedingEvent.objects.get(population=population_at_a)
        assert ev.event_type == "hatching"
        assert ev.count_delta_unsexed == 14
        assert ev.reporter_id == user.pk  # set server-side

    def test_tier2_cannot_create_for_other_institution(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_b: ExSituPopulation,
    ) -> None:
        user = _user(email="t2cross@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.post(ENDPOINT, self._payload(population_at_b.pk), format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        assert BreedingEvent.objects.filter(population=population_at_b).count() == 0

    def test_tier3_can_create_anywhere(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_b: ExSituPopulation,
    ) -> None:
        coord = _user(email="coord-create@example.com", tier=3, institution=institution_a)
        api_client.force_authenticate(user=coord)
        resp = api_client.post(ENDPOINT, self._payload(population_at_b.pk), format="json")
        assert resp.status_code == status.HTTP_201_CREATED

    def test_create_writes_audit_with_institution_snapshot(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        user = _user(email="audit-create@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        api_client.post(ENDPOINT, self._payload(population_at_a.pk), format="json")
        ev = BreedingEvent.objects.get(population=population_at_a)
        row = AuditEntry.objects.get(target_type="populations.BreedingEvent", target_id=ev.pk)
        assert row.action == AuditEntry.Action.CREATE
        assert row.actor_user == user
        assert row.actor_institution_id == institution_a.pk
        assert row.after["event_type"] == "hatching"
        assert row.after["population_id"] == population_at_a.pk

    def test_anonymous_create_unauthorized(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        resp = api_client.post(ENDPOINT, self._payload(population_at_a.pk), format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_reporter_field_cannot_be_spoofed(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        # Even if the client sends `reporter`, the server overrides with
        # request.user — `reporter` is not a writable field on the
        # WriteSerializer.
        user = _user(email="real@example.com", tier=2, institution=institution_a)
        other = _user(email="ghost@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        payload = self._payload(population_at_a.pk)
        payload["reporter"] = other.pk
        api_client.post(ENDPOINT, payload, format="json")
        ev = BreedingEvent.objects.get(population=population_at_a)
        assert ev.reporter_id == user.pk


@pytest.mark.django_db
class TestBreedingEventVerbs:
    """PATCH and DELETE are intentionally not exposed (events are append-only)."""

    def test_patch_returns_405(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        ev = BreedingEvent.objects.create(
            population=population_at_a,
            event_type="hatching",
            event_date=date(2026, 4, 1),
        )
        user = _user(email="t2patch@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(f"{ENDPOINT}{ev.pk}/", {"notes": "rewrite"}, format="json")
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_delete_returns_405(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        ev = BreedingEvent.objects.create(
            population=population_at_a,
            event_type="hatching",
            event_date=date(2026, 4, 1),
        )
        user = _user(email="t2del@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.delete(f"{ENDPOINT}{ev.pk}/")
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
