"""Gate 06b adversarial coverage.

Tests written from the BA + PM spec (not from implementation). Covers:
- Append-only bypass attempts on AuditEntry
- Permission enforcement on AuditEntry and ConservationStatusConflict admin URLs
- Conflict resolution outcome table (all four resolutions)
- Idempotency of conflict acknowledgement across syncs
- Strict-context foot-gun and its off-switch
- No regression on the unconflicted iucn_sync path
"""

from __future__ import annotations

import datetime as dt
from unittest.mock import patch

import pytest
from django.test import Client, override_settings

from accounts.models import User
from audit.context import audit_actor
from audit.models import AuditEntry
from species.admin import _apply_conflict_resolution
from species.models import ConservationAssessment, ConservationStatusConflict, Species
from tests.test_iucn_sync import _make_mock_client, make_detail, make_summary


def _user(email: str, tier: int, **extra: object) -> User:
    return User.objects.create_user(
        email=email,
        password="securepass12345",
        name=f"Tier{tier}",
        is_active=True,
        is_staff=True,
        access_tier=tier,
        **extra,
    )


@pytest.fixture
def species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Pachypanchax sakaramyi",
        family="Aplocheilidae",
        genus="Pachypanchax",
        iucn_status="CR",
        iucn_taxon_id=166478,
    )


@pytest.fixture
def manual_cr(species: Species, db: None) -> ConservationAssessment:
    return ConservationAssessment.objects.create(
        species=species,
        category="CR",
        source=ConservationAssessment.Source.MANUAL_EXPERT,
        review_status=ConservationAssessment.ReviewStatus.ACCEPTED,
        assessor="Dr. Loiselle",
        assessment_date=dt.date(2026, 3, 1),
        notes="Field survey",
    )


# ---------------------------------------------------------------------------
# 1) AuditEntry append-only enforcement (application layer)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAuditAppendOnly:
    def test_save_on_existing_row_raises(self) -> None:
        with audit_actor(system="iucn_sync"):
            e = AuditEntry.objects.create(
                target_type="Species",
                target_id=1,
                action=AuditEntry.Action.MIRROR_WRITE,
                before={},
                after={},
                actor_type=AuditEntry.ActorType.SYSTEM,
                actor_system="iucn_sync",
            )
        e.reason = "tampered"
        with pytest.raises(PermissionError):
            e.save()

    def test_delete_raises(self) -> None:
        e = AuditEntry.objects.create(
            target_type="Species",
            target_id=1,
            action=AuditEntry.Action.UPDATE,
            before={},
            after={},
            actor_type=AuditEntry.ActorType.SYSTEM,
            actor_system="unknown",
        )
        with pytest.raises(PermissionError):
            e.delete()


# ---------------------------------------------------------------------------
# 2) Admin-URL permission enforcement
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAdminPermissions:
    def test_audit_entry_list_denied_for_tier4(self, client: Client) -> None:
        _user("t4@example.com", tier=4)
        client.login(email="t4@example.com", password="securepass12345")
        resp = client.get("/admin/audit/auditentry/")
        assert resp.status_code in (302, 403)

    def test_audit_entry_list_allowed_for_tier5(self, client: Client) -> None:
        _user("t5@example.com", tier=5)
        client.login(email="t5@example.com", password="securepass12345")
        resp = client.get("/admin/audit/auditentry/")
        assert resp.status_code == 200

    def test_audit_entry_add_forbidden_even_for_superuser(self) -> None:
        admin = User.objects.create_superuser(
            email="su@example.com", password="securepass12345", name="Su"
        )
        c = Client()
        c.login(email="su@example.com", password="securepass12345")
        resp = c.get("/admin/audit/auditentry/add/")
        assert resp.status_code in (302, 403)
        _ = admin

    def test_conflict_list_denied_for_tier2(self, client: Client) -> None:
        _user("t2@example.com", tier=2)
        client.login(email="t2@example.com", password="securepass12345")
        resp = client.get("/admin/species/conservationstatusconflict/")
        assert resp.status_code in (302, 403)

    def test_conflict_list_allowed_for_tier3(self, client: Client) -> None:
        from django.contrib.auth.models import Permission

        user = _user("t3@example.com", tier=3)
        perm = Permission.objects.get(
            content_type__app_label="species", codename="view_conservationstatusconflict"
        )
        user.user_permissions.add(perm)
        client.login(email="t3@example.com", password="securepass12345")
        resp = client.get("/admin/species/conservationstatusconflict/")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 3) Conflict resolution outcome table
# ---------------------------------------------------------------------------


def _make_conflict(
    species: Species, manual: ConservationAssessment, user: User
) -> ConservationStatusConflict:
    iucn_row = ConservationAssessment.objects.create(
        species=species,
        category="EN",
        source=ConservationAssessment.Source.IUCN_OFFICIAL,
        review_status=ConservationAssessment.ReviewStatus.PENDING_REVIEW,
        iucn_assessment_id=9999,
        iucn_year_published=2024,
    )
    return ConservationStatusConflict.objects.create(
        species=species,
        manual_assessment=manual,
        iucn_assessment=iucn_row,
    )


@pytest.mark.django_db
class TestConflictResolutionOutcomes:
    def test_accepted_iucn(self, species: Species, manual_cr: ConservationAssessment) -> None:
        user = _user("res1@example.com", tier=5)
        conflict = _make_conflict(species, manual_cr, user)
        conflict.resolution = ConservationStatusConflict.Resolution.ACCEPTED_IUCN
        conflict.resolution_reason = "IUCN 2024 supersedes 2022 field data."
        with audit_actor(user=user, reason=conflict.resolution_reason):
            _apply_conflict_resolution(conflict, None, user)
        species.refresh_from_db()
        manual_cr.refresh_from_db()
        conflict.iucn_assessment.refresh_from_db()
        assert species.iucn_status == "EN"
        assert manual_cr.review_status == "superseded"
        assert conflict.iucn_assessment.review_status == "accepted"

    def test_retained_manual_appends_ack(
        self, species: Species, manual_cr: ConservationAssessment
    ) -> None:
        user = _user("res2@example.com", tier=5)
        conflict = _make_conflict(species, manual_cr, user)
        conflict.resolution = ConservationStatusConflict.Resolution.RETAINED_MANUAL
        conflict.resolution_reason = "Field data stronger than IUCN 2024."
        with audit_actor(user=user, reason=conflict.resolution_reason):
            _apply_conflict_resolution(conflict, None, user)
        species.refresh_from_db()
        manual_cr.refresh_from_db()
        assert species.iucn_status == "CR"
        assert 9999 in manual_cr.conflict_acknowledged_assessment_ids

    def test_reconciled_creates_new_manual(
        self, species: Species, manual_cr: ConservationAssessment
    ) -> None:
        user = _user("res3@example.com", tier=5)
        conflict = _make_conflict(species, manual_cr, user)
        conflict.resolution = ConservationStatusConflict.Resolution.RECONCILED
        conflict.resolution_reason = "Split the difference."
        with audit_actor(user=user, reason=conflict.resolution_reason):
            _apply_conflict_resolution(conflict, "VU", user)
        species.refresh_from_db()
        manual_cr.refresh_from_db()
        conflict.iucn_assessment.refresh_from_db()
        assert species.iucn_status == "VU"
        assert manual_cr.review_status == "superseded"
        assert conflict.iucn_assessment.review_status == "superseded"
        assert ConservationAssessment.objects.filter(
            species=species,
            source=ConservationAssessment.Source.MANUAL_EXPERT,
            review_status=ConservationAssessment.ReviewStatus.ACCEPTED,
            category="VU",
        ).exists()

    def test_dismissed_deletes_iucn_row(
        self, species: Species, manual_cr: ConservationAssessment
    ) -> None:
        user = _user("res4@example.com", tier=5)
        conflict = _make_conflict(species, manual_cr, user)
        iucn_pk = conflict.iucn_assessment.pk
        conflict.resolution = ConservationStatusConflict.Resolution.DISMISSED
        conflict.resolution_reason = "Duplicate; IUCN re-entry of same data."
        with audit_actor(user=user, reason=conflict.resolution_reason):
            _apply_conflict_resolution(conflict, None, user)
        species.refresh_from_db()
        assert species.iucn_status == "CR"
        assert not ConservationAssessment.objects.filter(pk=iucn_pk).exists()


# ---------------------------------------------------------------------------
# 4) Ack idempotency across sync runs
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAckIdempotency:
    def test_second_sync_with_same_id_is_noop(
        self, species: Species, manual_cr: ConservationAssessment
    ) -> None:
        from integration.tasks import iucn_sync

        manual_cr.conflict_acknowledged_assessment_ids = [9999]
        manual_cr.save()
        AuditEntry.objects.filter(target_type="Species", target_id=species.pk).delete()
        summary = make_summary(assessment_id=9999, code="EN")
        detail = make_detail(assessment_id=9999, category_code="EN")
        client = _make_mock_client(summary, detail)
        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()
        # Re-run: state must not change
        conflict_count_before = ConservationStatusConflict.objects.count()
        audit_count_before = AuditEntry.objects.filter(
            target_type="Species", target_id=species.pk
        ).count()
        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()
        assert ConservationStatusConflict.objects.count() == conflict_count_before
        assert (
            AuditEntry.objects.filter(target_type="Species", target_id=species.pk).count()
            == audit_count_before
        )


# ---------------------------------------------------------------------------
# 5) Strict-context guard
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestStrictContextOffSwitch:
    @override_settings(AUDIT_STRICT_CONTEXT=False)
    def test_off_mode_writes_unknown_actor(self, species: Species) -> None:
        AuditEntry.objects.filter(target_type="Species", target_id=species.pk).delete()
        species.iucn_status = "EN"
        species.save()
        e = AuditEntry.objects.get(target_type="Species", target_id=species.pk)
        assert e.actor_system == "unknown"


# ---------------------------------------------------------------------------
# 6) Unconflicted-path regression (gate-06 happy path still works)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUnconflictedRegression:
    def test_happy_path_no_manual_row(self, species: Species) -> None:
        from integration.tasks import iucn_sync

        # No manual_expert row — behave exactly like gate 06
        summary = make_summary(assessment_id=5555, code="EN")
        detail = make_detail(assessment_id=5555, category_code="EN")
        client = _make_mock_client(summary, detail)
        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()
        species.refresh_from_db()
        assert species.iucn_status == "EN"  # mirror fired
        assert result["created"] == 1
        assert not ConservationStatusConflict.objects.filter(species=species).exists()
