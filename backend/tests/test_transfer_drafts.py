"""Tests for the Tier-3+ transfer-draft API.

`POST /api/v1/transfers/` and `PATCH /api/v1/transfers/<id>/` —
coordinator-only. Transfers move animals between institutions; the
coordinator dashboard's existing TransferActivityView serves the
read-side. This test file covers the write side.
"""

from __future__ import annotations

from datetime import date

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from audit.models import AuditEntry
from populations.models import Institution, Transfer
from species.models import Species

ENDPOINT = "/api/v1/transfers/"


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


def _user(*, email: str, tier: int) -> User:
    return User.objects.create_user(
        email=email,
        password="securepass12345",
        name=email.split("@")[0],
        access_tier=tier,
        is_active=True,
    )


@pytest.mark.django_db
class TestAuth:
    def test_anonymous_unauthorized(self, api_client: APIClient) -> None:
        assert api_client.get(ENDPOINT).status_code == status.HTTP_401_UNAUTHORIZED

    def test_tier1_forbidden(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="t1@example.com", tier=1))
        assert api_client.get(ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier2_forbidden(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="t2@example.com", tier=2))
        assert api_client.get(ENDPOINT).status_code == status.HTTP_403_FORBIDDEN

    def test_tier3_allowed(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="t3@example.com", tier=3))
        assert api_client.get(ENDPOINT).status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestCreate:
    def _payload(
        self,
        species: Species,
        source: Institution,
        dest: Institution,
    ) -> dict:
        return {
            "species": species.pk,
            "source_institution": source.pk,
            "destination_institution": dest.pk,
            "status": "proposed",
            "proposed_date": "2026-05-01",
            "planned_date": "2026-06-15",
            "count_male": 2,
            "count_female": 3,
            "count_unsexed": 0,
            "cites_reference": "",
            "notes": "Founder pair pending permit.",
        }

    def test_tier3_creates(
        self,
        api_client: APIClient,
        species: Species,
        institution_a: Institution,
        institution_b: Institution,
    ) -> None:
        coord = _user(email="coord@example.com", tier=3)
        api_client.force_authenticate(user=coord)
        resp = api_client.post(
            ENDPOINT, self._payload(species, institution_a, institution_b), format="json"
        )
        assert resp.status_code == status.HTTP_201_CREATED
        t = Transfer.objects.get(species=species)
        assert t.created_by == coord
        assert t.source_institution_id == institution_a.pk
        assert t.destination_institution_id == institution_b.pk
        assert t.status == "proposed"

    def test_create_writes_audit(
        self,
        api_client: APIClient,
        species: Species,
        institution_a: Institution,
        institution_b: Institution,
    ) -> None:
        coord = _user(email="audit-coord@example.com", tier=3)
        api_client.force_authenticate(user=coord)
        api_client.post(
            ENDPOINT, self._payload(species, institution_a, institution_b), format="json"
        )
        t = Transfer.objects.get(species=species)
        row = AuditEntry.objects.get(target_type="populations.Transfer", target_id=t.pk)
        assert row.action == AuditEntry.Action.CREATE
        assert row.actor_user == coord
        assert row.after["status"] == "proposed"

    def test_source_destination_must_differ(
        self,
        api_client: APIClient,
        species: Species,
        institution_a: Institution,
    ) -> None:
        coord = _user(email="same@example.com", tier=3)
        api_client.force_authenticate(user=coord)
        # CheckConstraint at the DB level — the create raises IntegrityError
        # which DRF surfaces as 500 unless we catch it. The serializer
        # *could* validate this earlier; for now we rely on the DB
        # constraint and accept a 500 — assert it just doesn't return 201.
        from django.db import IntegrityError

        try:
            resp = api_client.post(
                ENDPOINT,
                self._payload(species, institution_a, institution_a),
                format="json",
            )
            assert resp.status_code != 201
        except IntegrityError:
            # Acceptable — the DB constraint fires before DRF can wrap it.
            pass


@pytest.mark.django_db
class TestPatch:
    def test_status_progression(
        self,
        api_client: APIClient,
        species: Species,
        institution_a: Institution,
        institution_b: Institution,
    ) -> None:
        t = Transfer.objects.create(
            species=species,
            source_institution=institution_a,
            destination_institution=institution_b,
            status="proposed",
            proposed_date=date(2026, 5, 1),
        )
        coord = _user(email="progress@example.com", tier=3)
        api_client.force_authenticate(user=coord)
        # proposed → approved
        resp = api_client.patch(f"{ENDPOINT}{t.pk}/", {"status": "approved"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        t.refresh_from_db()
        assert t.status == "approved"

    def test_patch_writes_audit_with_diff(
        self,
        api_client: APIClient,
        species: Species,
        institution_a: Institution,
        institution_b: Institution,
    ) -> None:
        t = Transfer.objects.create(
            species=species,
            source_institution=institution_a,
            destination_institution=institution_b,
            status="proposed",
            proposed_date=date(2026, 5, 1),
        )
        coord = _user(email="diff@example.com", tier=3)
        api_client.force_authenticate(user=coord)
        api_client.patch(
            f"{ENDPOINT}{t.pk}/",
            {"status": "in_transit", "actual_date": "2026-06-01"},
            format="json",
        )
        rows = AuditEntry.objects.filter(target_type="populations.Transfer", target_id=t.pk)
        assert rows.count() == 1
        row = rows.first()
        assert row.before["status"] == "proposed"
        assert row.after["status"] == "in_transit"
        assert row.after["actual_date"] == "2026-06-01"

    def test_no_op_patch_writes_no_audit(
        self,
        api_client: APIClient,
        species: Species,
        institution_a: Institution,
        institution_b: Institution,
    ) -> None:
        t = Transfer.objects.create(
            species=species,
            source_institution=institution_a,
            destination_institution=institution_b,
            status="proposed",
            proposed_date=date(2026, 5, 1),
        )
        coord = _user(email="noop@example.com", tier=3)
        api_client.force_authenticate(user=coord)
        api_client.patch(f"{ENDPOINT}{t.pk}/", {"status": "proposed"}, format="json")
        assert (
            AuditEntry.objects.filter(target_type="populations.Transfer", target_id=t.pk).count()
            == 0
        )


@pytest.mark.django_db
class TestVerbs:
    def test_delete_returns_405(
        self,
        api_client: APIClient,
        species: Species,
        institution_a: Institution,
        institution_b: Institution,
    ) -> None:
        t = Transfer.objects.create(
            species=species,
            source_institution=institution_a,
            destination_institution=institution_b,
            status="proposed",
            proposed_date=date(2026, 5, 1),
        )
        coord = _user(email="del@example.com", tier=3)
        api_client.force_authenticate(user=coord)
        resp = api_client.delete(f"{ENDPOINT}{t.pk}/")
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
