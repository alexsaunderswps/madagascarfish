"""Gate 06b — iucn_sync emits MIRROR_WRITE AuditEntry rows attributed to the sync job.

Covers BA Req 1 + Req 3a: every Species.iucn_status change driven by the scheduled
IUCN sync is traceable to the specific SyncJob and attributed to actor_system='iucn_sync'.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from audit.models import AuditEntry

from integration.models import SyncJob
from integration.tasks import iucn_sync
from species.models import Species
from tests.test_iucn_sync import _make_mock_client, make_detail, make_summary


@pytest.fixture
def species_en(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Pachypanchax sakaramyi",
        family="Aplocheilidae",
        genus="Pachypanchax",
        iucn_status="EN",
        iucn_taxon_id=166478,
    )


@pytest.mark.django_db
class TestIucnSyncAuditAttribution:
    def test_mirror_write_entry_created_when_status_changes(self, species_en: Species) -> None:
        AuditEntry.objects.all().delete()
        # API returns CR; species currently EN → mirror flips to CR and audit fires.
        summary = make_summary(code="CR")
        detail = make_detail(category_code="CR")
        client = _make_mock_client(summary, detail)
        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()
        job = SyncJob.objects.get(pk=result["job_id"])
        entries = AuditEntry.objects.filter(
            target_type="Species", target_id=species_en.pk, field="iucn_status"
        )
        assert entries.count() == 1
        e = entries.get()
        assert e.action == AuditEntry.Action.MIRROR_WRITE
        assert e.actor_type == AuditEntry.ActorType.SYSTEM
        assert e.actor_system == "iucn_sync"
        assert e.sync_job_id == job.pk
        assert e.before == {"iucn_status": "EN"}
        assert e.after == {"iucn_status": "CR"}

    def test_no_entry_when_category_unchanged(self, species_en: Species) -> None:
        AuditEntry.objects.all().delete()
        summary = make_summary()
        detail = make_detail(category_code="EN")  # matches existing
        client = _make_mock_client(summary, detail)
        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()
        assert not AuditEntry.objects.filter(
            target_type="Species", target_id=species_en.pk
        ).exists()
