"""Gate 06b — Req 4 conflict detection in _sync_one_species."""

from __future__ import annotations

import datetime as dt
from unittest.mock import patch

import pytest

from audit.models import AuditEntry
from integration.tasks import iucn_sync
from species.models import ConservationAssessment, ConservationStatusConflict, Species
from tests.test_iucn_sync import _make_mock_client, make_detail, make_summary


@pytest.fixture
def species_with_manual_cr(db: None) -> Species:
    sp = Species.objects.create(
        scientific_name="Pachypanchax sakaramyi",
        family="Aplocheilidae",
        genus="Pachypanchax",
        iucn_status="CR",
        iucn_taxon_id=166478,
    )
    ConservationAssessment.objects.create(
        species=sp,
        category="CR",
        source=ConservationAssessment.Source.MANUAL_EXPERT,
        review_status=ConservationAssessment.ReviewStatus.ACCEPTED,
        assessor="Dr. Loiselle",
        assessment_date=dt.date(2026, 3, 1),
        notes="Field survey 2026",
    )
    return sp


@pytest.mark.django_db
class TestConflictDetection:
    def test_conflict_raised_when_iucn_disagrees_with_manual(
        self, species_with_manual_cr: Species
    ) -> None:
        AuditEntry.objects.all().delete()
        summary = make_summary(assessment_id=9999, code="EN")
        detail = make_detail(assessment_id=9999, category_code="EN")
        client = _make_mock_client(summary, detail)
        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        species_with_manual_cr.refresh_from_db()
        # Mirror not overwritten.
        assert species_with_manual_cr.iucn_status == "CR"
        # IUCN row created as pending_review.
        iucn_row = ConservationAssessment.objects.get(
            species=species_with_manual_cr,
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
        )
        assert iucn_row.review_status == ConservationAssessment.ReviewStatus.PENDING_REVIEW
        # Conflict raised.
        assert (
            ConservationStatusConflict.objects.filter(
                species=species_with_manual_cr, status="open"
            ).count()
            == 1
        )
        # Audit: conflict_detected, no mirror_write.
        detected = AuditEntry.objects.filter(
            target_type="Species",
            target_id=species_with_manual_cr.pk,
            action=AuditEntry.Action.CONFLICT_DETECTED,
        )
        assert detected.count() == 1
        assert not AuditEntry.objects.filter(
            action=AuditEntry.Action.MIRROR_WRITE,
            target_id=species_with_manual_cr.pk,
        ).exists()

    def test_no_conflict_when_incoming_id_acknowledged(
        self, species_with_manual_cr: Species
    ) -> None:
        manual = ConservationAssessment.objects.get(
            species=species_with_manual_cr,
            source=ConservationAssessment.Source.MANUAL_EXPERT,
        )
        manual.conflict_acknowledged_assessment_ids = [9999]
        manual.save()
        AuditEntry.objects.all().delete()
        ConservationStatusConflict.objects.all().delete()
        summary = make_summary(assessment_id=9999, code="EN")
        detail = make_detail(assessment_id=9999, category_code="EN")
        client = _make_mock_client(summary, detail)
        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()
        assert not ConservationStatusConflict.objects.filter(
            species=species_with_manual_cr
        ).exists()

    def test_no_conflict_when_manual_agrees(self, species_with_manual_cr: Species) -> None:
        AuditEntry.objects.all().delete()
        summary = make_summary(assessment_id=1111, code="CR")  # matches manual
        detail = make_detail(assessment_id=1111, category_code="CR")
        client = _make_mock_client(summary, detail)
        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()
        assert not ConservationStatusConflict.objects.filter(
            species=species_with_manual_cr
        ).exists()

    def test_new_assessment_id_reraises_conflict_after_ack(
        self, species_with_manual_cr: Species
    ) -> None:
        manual = ConservationAssessment.objects.get(
            species=species_with_manual_cr,
            source=ConservationAssessment.Source.MANUAL_EXPERT,
        )
        manual.conflict_acknowledged_assessment_ids = [9999]
        manual.save()
        # New assessment_id with same disagreement → new conflict.
        summary = make_summary(assessment_id=10000, code="EN")
        detail = make_detail(assessment_id=10000, category_code="EN")
        client = _make_mock_client(summary, detail)
        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()
        assert ConservationStatusConflict.objects.filter(
            species=species_with_manual_cr, status="open"
        ).exists()
