"""Tests for Gate 13 — Institution-Scoped Editing.

Covers:

- The 14 permission-class cases (PM spec §Tests, sketch §test cases 1–11
  + architecture appendix A 12–14).
- The audit hook contract (single multi-field row per PATCH; no audit row
  on a no-op PATCH; coordinator override carries coordinator's
  institution snapshot).
- The denormalized last-edit columns (atomic write with audit row).
- The PendingInstitutionClaim queue (registration creates PENDING,
  approval/rejection state transitions, /me/ resolution).

All tests use `force_authenticate` so we don't depend on the live login
path. The permission class is the unit under test, not the auth flow.
"""

from __future__ import annotations

from datetime import date

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import PendingInstitutionClaim, User
from accounts.services import approve_claim, reject_claim
from audit.models import AuditEntry
from populations.models import ExSituPopulation, Institution
from species.models import Species


# ----------------------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------------------


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
def population_at_b(institution_b: Institution, species_two: Species) -> ExSituPopulation:
    return ExSituPopulation.objects.create(
        species=species_two,
        institution=institution_b,
        count_total=20,
        count_male=10,
        count_female=10,
        breeding_status="breeding",
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


# ----------------------------------------------------------------------------
# Permission class — the 14 cases
# ----------------------------------------------------------------------------


@pytest.mark.django_db
class TestInstitutionScopedPermission:
    """Cases 1–14 from PM spec §Tests / permission-class table."""

    def test_case_1_tier2_own_institution_get_200(
        self, api_client: APIClient, institution_a: Institution, population_at_a: ExSituPopulation
    ) -> None:
        user = _user(email="t2a@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.get(f"/api/v1/populations/{population_at_a.pk}/")
        assert resp.status_code == status.HTTP_200_OK

    def test_case_2_tier2_own_institution_patch_200(
        self, api_client: APIClient, institution_a: Institution, population_at_a: ExSituPopulation
    ) -> None:
        user = _user(email="t2a2@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 12}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK
        population_at_a.refresh_from_db()
        assert population_at_a.count_total == 12

    def test_case_3_tier2_other_institution_get_404(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_b: ExSituPopulation,
    ) -> None:
        user = _user(email="t2a3@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.get(f"/api/v1/populations/{population_at_b.pk}/")
        # Queryset-scoped: leak nothing — 404 not 403.
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_case_4_tier2_other_institution_patch_404(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_b: ExSituPopulation,
    ) -> None:
        user = _user(email="t2a4@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_b.pk}/", {"count_total": 99}, format="json"
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        population_at_b.refresh_from_db()
        assert population_at_b.count_total == 20  # unchanged

    def test_case_5_tier2_no_institution_list_empty(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        user = _user(email="t2null@example.com", tier=2, institution=None)
        api_client.force_authenticate(user=user)
        resp = api_client.get("/api/v1/populations/")
        # Tier 2 with no institution: has_permission returns False → 403.
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_case_6_tier2_no_institution_patch_403(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        user = _user(email="t2null2@example.com", tier=2, institution=None)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 99}, format="json"
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_case_7_tier3_other_institution_patch_200(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        population_at_b: ExSituPopulation,
    ) -> None:
        coord = _user(email="coord@example.com", tier=3, institution=institution_a)
        api_client.force_authenticate(user=coord)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_b.pk}/", {"count_total": 25}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK
        population_at_b.refresh_from_db()
        assert population_at_b.count_total == 25

    def test_case_8_tier3_no_institution_patch_200(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        coord = _user(email="coord2@example.com", tier=3, institution=None)
        api_client.force_authenticate(user=coord)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 11}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_case_9_anonymous_get_401(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        # has_permission returns False for anonymous; DRF returns 401 (auth
        # not provided) or 403 depending on auth-class config. Accept either.
        resp = api_client.get(f"/api/v1/populations/{population_at_a.pk}/")
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_case_10_tier2_deactivated_403(
        self, api_client: APIClient, institution_a: Institution, population_at_a: ExSituPopulation
    ) -> None:
        user = _user(
            email="t2deact@example.com", tier=2, institution=institution_a, is_active=False
        )
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 99}, format="json"
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_case_11_tier1_patch_403(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        user = _user(email="t1@example.com", tier=1, institution=None)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 99}, format="json"
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_case_12_tier2_pending_claim_only_patch_403(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        # User has a PENDING claim on institution_a but User.institution is
        # NULL (never approved). The perm class checks user.institution_id,
        # not the claim — should reject.
        user = _user(email="pending@example.com", tier=2, institution=None)
        PendingInstitutionClaim.objects.create(
            user=user,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.PENDING,
        )
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 99}, format="json"
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_case_13_tier2_freshly_approved_patch_200(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        # Just-approved user. The perm class reads request.user.institution_id
        # from the DB on every request, so there's no JWT-staleness issue
        # at the perm-class layer.
        user = _user(email="fresh@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 11}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_case_14_tier2_revoked_patch_403(
        self, api_client: APIClient, population_at_a: ExSituPopulation
    ) -> None:
        # User had institution_a, was revoked (set to NULL). Now must be
        # rejected even though they could edit yesterday.
        user = _user(email="revoked@example.com", tier=2, institution=None)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 99}, format="json"
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ----------------------------------------------------------------------------
# Audit hook
# ----------------------------------------------------------------------------


@pytest.mark.django_db
class TestAuditHook:
    """The audit hook contract per AC-13.4 / AC-13.6."""

    def test_one_audit_row_per_multi_field_patch(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        user = _user(email="audit1@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/",
            {"count_total": 12, "count_male": 5, "breeding_status": "breeding"},
            format="json",
        )
        rows = AuditEntry.objects.filter(
            target_type="populations.ExSituPopulation", target_id=population_at_a.pk
        )
        assert rows.count() == 1
        row = rows.first()
        assert row.before == {"count_total": 10, "count_male": 4, "breeding_status": "non-breeding"}
        assert row.after == {"count_total": 12, "count_male": 5, "breeding_status": "breeding"}
        assert row.field == ""  # multi-field convention

    def test_actor_institution_snapshot(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        user = _user(email="audit2@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 12}, format="json"
        )
        row = AuditEntry.objects.get(
            target_type="populations.ExSituPopulation", target_id=population_at_a.pk
        )
        assert row.actor_user == user
        assert row.actor_institution_id == institution_a.pk

    def test_no_audit_row_on_noop_patch(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        user = _user(email="audit3@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        # Same value as current.
        api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/",
            {"count_total": 10},
            format="json",
        )
        assert (
            AuditEntry.objects.filter(
                target_type="populations.ExSituPopulation", target_id=population_at_a.pk
            ).count()
            == 0
        )
        # Last-edited columns also stay NULL.
        population_at_a.refresh_from_db()
        assert population_at_a.last_edited_at is None
        assert population_at_a.last_edited_by_user_id is None

    def test_only_changed_fields_in_audit(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        user = _user(email="audit4@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        # count_total changes; count_male stays the same.
        api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/",
            {"count_total": 12, "count_male": 4},
            format="json",
        )
        row = AuditEntry.objects.get(
            target_type="populations.ExSituPopulation", target_id=population_at_a.pk
        )
        assert "count_total" in row.before
        assert "count_male" not in row.before  # didn't change

    def test_coordinator_override_carries_coordinator_institution(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        population_at_b: ExSituPopulation,
    ) -> None:
        # Tier 3 coordinator at institution_a edits a population at institution_b.
        # The audit row's actor_institution should be the coordinator's
        # institution (snapshot of user state), NOT the population's.
        coord = _user(email="coord-snapshot@example.com", tier=3, institution=institution_a)
        api_client.force_authenticate(user=coord)
        api_client.patch(
            f"/api/v1/populations/{population_at_b.pk}/", {"count_total": 25}, format="json"
        )
        row = AuditEntry.objects.get(
            target_type="populations.ExSituPopulation", target_id=population_at_b.pk
        )
        assert row.actor_institution_id == institution_a.pk

    def test_last_edited_columns_updated_atomically(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        user = _user(email="lastedit@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/", {"count_total": 11}, format="json"
        )
        population_at_a.refresh_from_db()
        assert population_at_a.last_edited_at is not None
        assert population_at_a.last_edited_by_user_id == user.pk
        assert population_at_a.last_edited_by_institution_id == institution_a.pk

    def test_date_field_is_json_serializable(
        self,
        api_client: APIClient,
        institution_a: Institution,
        population_at_a: ExSituPopulation,
    ) -> None:
        user = _user(email="datefield@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=user)
        # Set last_census_date — DateField, must be ISO-stringified into JSON.
        new_date = date(2026, 5, 1)
        resp = api_client.patch(
            f"/api/v1/populations/{population_at_a.pk}/",
            {"last_census_date": new_date.isoformat()},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        row = AuditEntry.objects.get(
            target_type="populations.ExSituPopulation", target_id=population_at_a.pk
        )
        # Both before (None) and after (isoformat string) are JSON-safe.
        assert row.after["last_census_date"] == "2026-05-01"


# ----------------------------------------------------------------------------
# Claim queue + service functions
# ----------------------------------------------------------------------------


@pytest.mark.django_db
class TestClaimQueue:
    """PendingInstitutionClaim lifecycle per AC-13.2 / spec §Tests Claim queue."""

    def test_register_with_institution_creates_pending_claim(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        resp = api_client.post(
            "/api/v1/auth/register/",
            {
                "email": "claim@example.com",
                "name": "Claim User",
                "password": "securepass12345",
                "institution_id": institution_a.pk,
            },
        )
        assert resp.status_code == 201
        user = User.objects.get(email="claim@example.com")
        assert user.institution_id is None
        claim = PendingInstitutionClaim.objects.get(user=user, institution=institution_a)
        assert claim.status == PendingInstitutionClaim.Status.PENDING

    def test_register_without_institution_creates_no_claim(self, api_client: APIClient) -> None:
        api_client.post(
            "/api/v1/auth/register/",
            {
                "email": "noinst@example.com",
                "name": "No Institution",
                "password": "securepass12345",
            },
        )
        user = User.objects.get(email="noinst@example.com")
        assert PendingInstitutionClaim.objects.filter(user=user).count() == 0

    def test_approve_flow(self, institution_a: Institution) -> None:
        applicant = _user(email="applicant@example.com", tier=2, institution=None)
        coord = _user(email="reviewer@example.com", tier=3)
        claim = PendingInstitutionClaim.objects.create(
            user=applicant,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.PENDING,
        )
        approve_claim(claim=claim, reviewer=coord, review_notes="welcome")
        applicant.refresh_from_db()
        claim.refresh_from_db()
        assert applicant.institution_id == institution_a.pk
        assert claim.status == PendingInstitutionClaim.Status.APPROVED
        assert claim.reviewed_by == coord
        assert claim.reviewed_at is not None

    def test_reject_flow(self, institution_a: Institution) -> None:
        applicant = _user(email="rejected@example.com", tier=2, institution=None)
        coord = _user(email="reviewer2@example.com", tier=3)
        claim = PendingInstitutionClaim.objects.create(
            user=applicant,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.PENDING,
        )
        reject_claim(claim=claim, reviewer=coord, review_notes="not affiliated")
        applicant.refresh_from_db()
        claim.refresh_from_db()
        assert applicant.institution_id is None
        assert claim.status == PendingInstitutionClaim.Status.REJECTED
        assert claim.review_notes == "not affiliated"

    def test_self_approval_blocked(self, institution_a: Institution) -> None:
        """Privilege-escalation guard: a coordinator cannot approve a claim
        they themselves filed. Superuser is allowed (break-glass)."""
        coord = _user(email="self-approve@example.com", tier=3)
        claim = PendingInstitutionClaim.objects.create(
            user=coord,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.PENDING,
        )
        with pytest.raises(ValueError, match="cannot approve their own"):
            approve_claim(claim=claim, reviewer=coord)
        # Superuser exemption.
        coord.is_superuser = True
        coord.save(update_fields=["is_superuser"])
        approved = approve_claim(claim=claim, reviewer=coord)
        assert approved.status == PendingInstitutionClaim.Status.APPROVED

    def test_self_rejection_blocked(self, institution_a: Institution) -> None:
        coord = _user(email="self-reject@example.com", tier=3)
        claim = PendingInstitutionClaim.objects.create(
            user=coord,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.PENDING,
        )
        with pytest.raises(ValueError, match="cannot reject their own"):
            reject_claim(claim=claim, reviewer=coord)

    def test_approve_non_pending_raises(self, institution_a: Institution) -> None:
        applicant = _user(email="dbl@example.com", tier=2)
        coord = _user(email="rev3@example.com", tier=3)
        claim = PendingInstitutionClaim.objects.create(
            user=applicant,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.APPROVED,
        )
        with pytest.raises(ValueError):
            approve_claim(claim=claim, reviewer=coord)

    def test_one_pending_claim_constraint(self, institution_a: Institution) -> None:
        from django.db import IntegrityError, transaction

        applicant = _user(email="dup@example.com", tier=2)
        PendingInstitutionClaim.objects.create(
            user=applicant,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.PENDING,
        )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                PendingInstitutionClaim.objects.create(
                    user=applicant,
                    institution=institution_a,
                    status=PendingInstitutionClaim.Status.PENDING,
                )

    def test_rejected_claim_does_not_block_new_pending(self, institution_a: Institution) -> None:
        applicant = _user(email="reclaim@example.com", tier=2)
        PendingInstitutionClaim.objects.create(
            user=applicant,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.REJECTED,
        )
        # New PENDING claim is allowed because the partial unique index only
        # covers status=pending.
        new_claim = PendingInstitutionClaim.objects.create(
            user=applicant,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.PENDING,
        )
        assert new_claim.pk is not None


# ----------------------------------------------------------------------------
# /me/ institution_membership block
# ----------------------------------------------------------------------------


def _me(api_client: APIClient, user: User) -> dict:
    api_client.force_authenticate(user=user)
    resp = api_client.get("/api/v1/auth/me/")
    assert resp.status_code == 200
    return resp.json()


@pytest.mark.django_db
class TestMeMembership:
    """The /me/ institution_membership response per architecture §6.1."""

    def test_none_status_for_user_with_no_claims(self, api_client: APIClient) -> None:
        user = _user(email="none@example.com", tier=2, institution=None)
        body = _me(api_client, user)
        assert body["institution_membership"]["claim_status"] == "none"
        assert body["institution_membership"]["institution_id"] is None
        assert body["institution_membership"]["institution_name"] is None

    def test_pending_status_returns_institution_name_but_not_id(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        user = _user(email="p@example.com", tier=2, institution=None)
        PendingInstitutionClaim.objects.create(
            user=user, institution=institution_a, status=PendingInstitutionClaim.Status.PENDING
        )
        body = _me(api_client, user)
        block = body["institution_membership"]
        assert block["claim_status"] == "pending"
        assert block["institution_id"] is None  # gated on approval
        assert block["institution_name"] == institution_a.name

    def test_approved_status_returns_institution_id(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        user = _user(email="a@example.com", tier=2, institution=institution_a)
        PendingInstitutionClaim.objects.create(
            user=user,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.APPROVED,
        )
        body = _me(api_client, user)
        block = body["institution_membership"]
        assert block["claim_status"] == "approved"
        assert block["institution_id"] == institution_a.pk
        assert block["institution_name"] == institution_a.name

    def test_rejected_status_returns_rejection_reason(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        user = _user(email="r@example.com", tier=2, institution=None)
        PendingInstitutionClaim.objects.create(
            user=user,
            institution=institution_a,
            status=PendingInstitutionClaim.Status.REJECTED,
            review_notes="not affiliated",
        )
        body = _me(api_client, user)
        block = body["institution_membership"]
        assert block["claim_status"] == "rejected"
        assert block["institution_id"] is None
        assert block["rejection_reason"] == "not affiliated"

    def test_legacy_user_with_institution_no_claim_row(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        # User with institution set directly, no claim row. This is the
        # "edge case" path in get_institution_membership; the migration
        # backfill normally creates a synthetic claim, but the resolver
        # also defends against the gap.
        user = _user(email="legacy@example.com", tier=2, institution=institution_a)
        # No claim row created here.
        body = _me(api_client, user)
        block = body["institution_membership"]
        assert block["claim_status"] == "approved"
        assert block["institution_id"] == institution_a.pk
        assert block["institution_name"] == institution_a.name
