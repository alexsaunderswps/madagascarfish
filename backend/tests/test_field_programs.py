"""Tests for institution-scoped field-program edits.

Same shape as Gate 13/14: Tier 2 staff at the program's
`lead_institution` can edit; Tier 3+ can edit anything; reads stay
public; M2M relations and structural FKs (`lead_institution`,
`focal_species`, `partner_institutions`) are NOT editable through this
surface.
"""

from __future__ import annotations

from datetime import date

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from audit.models import AuditEntry
from fieldwork.models import FieldProgram
from populations.models import Institution
from species.models import Species

ENDPOINT = "/api/v1/field-programs/"


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def institution_a(db: None) -> Institution:
    return Institution.objects.create(
        name="Durrell Madagascar", institution_type="ngo", country="MG"
    )


@pytest.fixture
def institution_b(db: None) -> Institution:
    return Institution.objects.create(
        name="MWC Andriantantely", institution_type="research_org", country="MG"
    )


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
def program_a(institution_a: Institution, species: Species) -> FieldProgram:
    fp = FieldProgram.objects.create(
        name="Manombo monitoring",
        description="Monthly visual surveys of Manombo Special Reserve.",
        lead_institution=institution_a,
        region="Eastern Madagascar",
        status="active",
        start_date=date(2024, 1, 1),
    )
    fp.focal_species.add(species)
    return fp


@pytest.fixture
def program_b(institution_b: Institution) -> FieldProgram:
    return FieldProgram.objects.create(
        name="Andriantantely habitat assessment",
        description="Initial habitat survey.",
        lead_institution=institution_b,
        region="Eastern Madagascar",
        status="planned",
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
class TestPublicReads:
    """Reads are unauthenticated (existing behaviour, preserved)."""

    def test_anonymous_can_list(self, api_client: APIClient, program_a: FieldProgram) -> None:
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["count"] >= 1

    def test_anonymous_can_retrieve(self, api_client: APIClient, program_a: FieldProgram) -> None:
        resp = api_client.get(f"{ENDPOINT}{program_a.pk}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["name"] == "Manombo monitoring"


@pytest.mark.django_db
class TestPatch:
    def test_tier2_at_lead_can_patch(
        self,
        api_client: APIClient,
        institution_a: Institution,
        program_a: FieldProgram,
    ) -> None:
        user = _user(email="t2lead@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"{ENDPOINT}{program_a.pk}/",
            {"status": "completed", "end_date": "2026-04-01"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        program_a.refresh_from_db()
        assert program_a.status == "completed"
        assert program_a.end_date == date(2026, 4, 1)

    def test_tier2_at_other_institution_cannot_patch(
        self,
        api_client: APIClient,
        institution_a: Institution,
        program_b: FieldProgram,
    ) -> None:
        # institution_a user attempts to PATCH a program led by institution_b
        user = _user(email="t2cross@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"{ENDPOINT}{program_b.pk}/", {"status": "completed"}, format="json"
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        program_b.refresh_from_db()
        assert program_b.status == "planned"  # unchanged

    def test_tier2_no_institution_cannot_patch(
        self, api_client: APIClient, program_a: FieldProgram
    ) -> None:
        user = _user(email="t2null@example.com", tier=2, institution=None)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"{ENDPOINT}{program_a.pk}/", {"status": "completed"}, format="json"
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_cannot_patch(self, api_client: APIClient, program_a: FieldProgram) -> None:
        resp = api_client.patch(
            f"{ENDPOINT}{program_a.pk}/", {"status": "completed"}, format="json"
        )
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_tier3_can_patch_other_institutions(
        self,
        api_client: APIClient,
        institution_a: Institution,
        program_b: FieldProgram,
    ) -> None:
        coord = _user(email="coord@example.com", tier=3, institution=institution_a)
        api_client.force_authenticate(user=coord)
        resp = api_client.patch(f"{ENDPOINT}{program_b.pk}/", {"status": "active"}, format="json")
        assert resp.status_code == status.HTTP_200_OK

    def test_lead_institution_field_silently_ignored(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        program_a: FieldProgram,
    ) -> None:
        # A Tier 2 staffer at institution_a tries to re-attribute the program
        # to institution_b. The serializer doesn't expose lead_institution
        # so it's silently dropped — program stays at institution_a.
        user = _user(email="t2reattribute@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"{ENDPOINT}{program_a.pk}/",
            {"lead_institution": institution_b.pk, "status": "completed"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        program_a.refresh_from_db()
        assert program_a.lead_institution_id == institution_a.pk

    def test_patch_writes_audit_row(
        self,
        api_client: APIClient,
        institution_a: Institution,
        program_a: FieldProgram,
    ) -> None:
        user = _user(email="t2audit@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        api_client.patch(f"{ENDPOINT}{program_a.pk}/", {"status": "completed"}, format="json")
        row = AuditEntry.objects.get(target_type="fieldwork.FieldProgram", target_id=program_a.pk)
        assert row.action == AuditEntry.Action.UPDATE
        assert row.actor_user == user
        assert row.actor_institution_id == institution_a.pk
        assert row.before["status"] == "active"
        assert row.after["status"] == "completed"


@pytest.mark.django_db
class TestCreate:
    def test_tier2_creates_program_at_own_institution(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        user = _user(email="t2create@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.post(
            ENDPOINT,
            {
                "name": "New initiative",
                "description": "Something fresh.",
                "region": "Western Madagascar",
                "status": "planned",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        fp = FieldProgram.objects.get(name="New initiative")
        # Lead institution set server-side from user.institution.
        assert fp.lead_institution_id == institution_a.pk

    def test_tier2_no_institution_cannot_create(self, api_client: APIClient) -> None:
        user = _user(email="t2null2@example.com", tier=2, institution=None)
        api_client.force_authenticate(user=user)
        resp = api_client.post(
            ENDPOINT,
            {"name": "X", "description": "Y", "status": "planned"},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_create_writes_audit_row(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        user = _user(email="t2audit-create@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.post(
            ENDPOINT,
            {"name": "Audited program", "description": "x", "status": "planned"},
            format="json",
        )
        assert resp.status_code == 201
        fp = FieldProgram.objects.get(name="Audited program")
        row = AuditEntry.objects.get(target_type="fieldwork.FieldProgram", target_id=fp.pk)
        assert row.action == AuditEntry.Action.CREATE
        assert row.actor_institution_id == institution_a.pk


@pytest.mark.django_db
class TestVerbs:
    def test_delete_returns_405(
        self,
        api_client: APIClient,
        institution_a: Institution,
        program_a: FieldProgram,
    ) -> None:
        user = _user(email="t2del@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.delete(f"{ENDPOINT}{program_a.pk}/")
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_put_returns_405(
        self,
        api_client: APIClient,
        institution_a: Institution,
        program_a: FieldProgram,
    ) -> None:
        # PUT not in http_method_names — only PATCH is the supported full
        # update verb (avoids forcing all-fields semantics on partial edits).
        user = _user(email="t2put@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.put(
            f"{ENDPOINT}{program_a.pk}/", {"name": "x", "status": "active"}, format="json"
        )
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
