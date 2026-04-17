"""
Gate 06 — IUCN Sync & Seed Data
Tests written from acceptance criteria in docs/planning/specs/gate-06-iucn-sync-seed-data.md

Covers:
- BE-06-1 scenario 1: Species with iucn_taxon_id → ConservationAssessment created with
  source='iucn_official', review_status='accepted', category from API
- BE-06-1 scenario 2: Species with iucn_taxon_id=null → no API call, records_skipped
  increments, no error logged
- BE-06-1 scenario 3: IUCN API returns 500/connection error for one species → error logged
  in SyncJob.error_log, task continues, status='completed' if at least one species succeeded
- BE-06-1 scenario 4: Existing ConservationAssessment with review_status='pending_review'
  → NOT overwritten; species skipped; coordinator's flag preserved
- BE-06-1 scenario 5 (idempotency): running sync twice creates no duplicate
  ConservationAssessment records
- SyncJob lifecycle: created at start with status='running', updated to 'completed'/'failed',
  completed_at set
- Cache-hit path: client.last_request_was_cache_hit suppresses the rate-limit sleep
- Adversarial: API returns unknown/invalid category → error raised and logged, not silently stored
- Adversarial: API returns 500 for ALL species → status='failed'
- Adversarial: existing 'accepted' assessment IS overwritten on re-sync (correct upsert)
- Adversarial: detail endpoint returns category as dict shape {'CODE': ..., 'DESCRIPTION': ...}
- Adversarial: summary response with no assessments → species skipped gracefully
- Adversarial: multiple assessments in summary, latest=True flag picks correctly
- Adversarial: multiple assessments with no latest flag → highest year_published picked
- Adversarial: connection error (not HTTP) raises IUCNAPIError and is recorded in error_log
- IUCNClient: 404 response returns None (not exception)
- IUCNClient: non-404 error raises IUCNAPIError
- IUCNClient: cache hit sets last_request_was_cache_hit=True and returns cached data
- IUCNClient: cache miss sets last_request_was_cache_hit=False and populates cache
- IUCNClient: 404 cached as sentinel so second call also returns None without hitting network
- IUCNClient: missing token raises IUCNAPIError
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.core.cache import cache

from integration.clients.iucn import IUCNAPIError, IUCNClient
from integration.models import SyncJob
from integration.tasks import _normalize_category, _pick_latest_assessment, iucn_sync
from species.models import ConservationAssessment, Species

# ---------------------------------------------------------------------------
# Shared payload factories — use actual v4 API payload shapes from spec
# ---------------------------------------------------------------------------


def make_summary(
    assessment_id: int = 10001,
    code: str = "EN",
    latest: bool = True,
    year: int = 2022,
) -> dict:
    """Mimics the /taxa/sis/{id} response shape: {assessments: [{...}]}."""
    return {
        "assessments": [
            {
                "assessment_id": assessment_id,
                "latest": latest,
                "year_published": year,
                "code": code,
            }
        ]
    }


def make_detail(
    assessment_id: int = 10001,
    category_code: str = "EN",
    criteria: str = "A2ace",
    year: int = 2022,
) -> dict:
    """
    Mimics the /assessment/{id} response shape.
    The spec says red_list_category is a dict: {'CODE': 'EN', 'DESCRIPTION': {'EN': 'ENDANGERED'}}.
    """
    return {
        "assessment_id": assessment_id,
        "red_list_category": {
            "CODE": category_code,
            "DESCRIPTION": {"EN": category_code},
        },
        "criteria": criteria,
        "year_published": year,
        "assessors": [{"name": "IUCN SSC Freshwater Fishes Specialist Group"}],
        "assessment_date": f"{year}-01-01",
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def clear_cache() -> None:
    """
    Clear the locmem cache before every test.
    The IUCNClient caches responses by taxon ID, and the locmem backend persists
    across tests in the same process. Without this, a cache hit from a previous
    test can bypass _request() and prevent IUCNAPIError from being raised.
    """
    cache.clear()


@pytest.fixture
def species_with_iucn_id(db: None) -> Species:
    """Species that has an iucn_taxon_id — the sync should process this."""
    return Species.objects.create(
        scientific_name="Pachypanchax sakaramyi",
        family="Aplocheilidae",
        genus="Pachypanchax",
        iucn_taxon_id=166478,
    )


@pytest.fixture
def species_without_iucn_id(db: None) -> Species:
    """Undescribed morphospecies with iucn_taxon_id=null — sync must skip."""
    return Species.objects.create(
        scientific_name="Bedotia sp. 'manombo'",
        taxonomic_status="undescribed_morphospecies",
        provisional_name="'manombo'",
        family="Bedotiidae",
        genus="Bedotia",
        iucn_taxon_id=None,
    )


@pytest.fixture
def second_species_with_iucn_id(db: None) -> Species:
    """Second described species used in multi-species tests."""
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        family="Bedotiidae",
        genus="Bedotia",
        iucn_taxon_id=99999,
    )


def _make_mock_client(
    summary_return: dict | None,
    detail_return: dict | None,
    cache_hit: bool = False,
) -> MagicMock:
    """Build a mock IUCNClient that returns controlled data without I/O."""
    client = MagicMock(spec=IUCNClient)
    client.get_species_assessment.return_value = (summary_return, cache_hit)
    client.get_assessment.return_value = (detail_return, cache_hit)
    client.wait_between_requests = MagicMock()
    return client


# ---------------------------------------------------------------------------
# SyncJob lifecycle tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSyncJobLifecycle:
    """Verify the SyncJob record is managed correctly across the task lifecycle."""

    def test_syncjob_completed_status_after_successful_run(
        self, species_with_iucn_id: Species
    ) -> None:
        # Spec: SyncJob status must be 'completed' when the run finishes successfully.
        summary = make_summary()
        detail = make_detail()
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.status == SyncJob.Status.COMPLETED

    def test_syncjob_completed_at_is_set_on_success(self, species_with_iucn_id: Species) -> None:
        # Spec: completed_at is set in the finally block regardless of outcome.
        summary = make_summary()
        detail = make_detail()
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.completed_at is not None

    def test_syncjob_started_at_is_set(self, species_with_iucn_id: Species) -> None:
        # Spec: job is created with started_at=now() at task start.
        summary = make_summary()
        detail = make_detail()
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.started_at is not None

    def test_syncjob_status_failed_when_all_species_error(
        self, species_with_iucn_id: Species
    ) -> None:
        # Spec: status='failed' only when no species succeeded (all errored).
        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.side_effect = IUCNAPIError("IUCN 500")
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.status == SyncJob.Status.FAILED

    def test_syncjob_completed_at_set_even_on_per_species_error(
        self, species_with_iucn_id: Species
    ) -> None:
        # completed_at must be set in the finally block even when some species fail.
        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.side_effect = IUCNAPIError("500 error")
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.completed_at is not None

    def test_syncjob_job_type_is_iucn_sync(self, species_with_iucn_id: Species) -> None:
        summary = make_summary()
        detail = make_detail()
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.job_type == SyncJob.JobType.IUCN_SYNC


# ---------------------------------------------------------------------------
# BE-06-1 Scenario 1: Species with iucn_taxon_id → assessment created
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAssessmentCreation:
    """Happy-path: species with iucn_taxon_id gets a ConservationAssessment."""

    def test_assessment_created_with_iucn_official_source(
        self, species_with_iucn_id: Species
    ) -> None:
        # Spec: source must be 'iucn_official'.
        summary = make_summary(code="CR")
        detail = make_detail(category_code="CR")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        ca = ConservationAssessment.objects.get(
            species=species_with_iucn_id, source="iucn_official"
        )
        assert ca.source == ConservationAssessment.Source.IUCN_OFFICIAL

    def test_assessment_created_with_accepted_review_status(
        self, species_with_iucn_id: Species
    ) -> None:
        # Spec: review_status must be 'accepted' for a fresh sync.
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        ca = ConservationAssessment.objects.get(
            species=species_with_iucn_id, source="iucn_official"
        )
        assert ca.review_status == ConservationAssessment.ReviewStatus.ACCEPTED

    def test_assessment_category_matches_api_response(self, species_with_iucn_id: Species) -> None:
        # Spec: category must match the value returned by the IUCN API.
        summary = make_summary(code="VU")
        detail = make_detail(category_code="VU")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        ca = ConservationAssessment.objects.get(
            species=species_with_iucn_id, source="iucn_official"
        )
        assert ca.category == "VU"

    def test_assessment_category_from_dict_shape(self, species_with_iucn_id: Species) -> None:
        # Spec: the detail endpoint returns red_list_category as a dict:
        # {'CODE': 'EN', 'DESCRIPTION': {'EN': 'ENDANGERED'}}.
        # The task must parse this correctly.
        summary = make_summary(code="EN")
        detail = {
            "assessment_id": 10001,
            "red_list_category": {"CODE": "EN", "DESCRIPTION": {"EN": "ENDANGERED"}},
            "criteria": "A2ace",
            "year_published": 2022,
            "assessment_date": "2022-03-15",
            "assessors": [{"name": "IUCN Team"}],
        }
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        ca = ConservationAssessment.objects.get(
            species=species_with_iucn_id, source="iucn_official"
        )
        assert ca.category == "EN"

    def test_records_created_increments(self, species_with_iucn_id: Species) -> None:
        # Validate the job counter tracks newly created assessments.
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        assert result["created"] == 1

    def test_species_api_called_with_correct_taxon_id(self, species_with_iucn_id: Species) -> None:
        # Verify the client is called with the species' actual iucn_taxon_id.
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        client.get_species_assessment.assert_called_once_with(166478)

    def test_assessment_linked_to_sync_job(self, species_with_iucn_id: Species) -> None:
        # ConservationAssessment.last_sync_job FK must point to the SyncJob for this run.
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        ca = ConservationAssessment.objects.get(
            species=species_with_iucn_id, source="iucn_official"
        )
        assert ca.last_sync_job_id == result["job_id"]


# ---------------------------------------------------------------------------
# BE-06-1 Scenario 2: Species with iucn_taxon_id=null → skipped
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestNullIucnTaxonIdSkipped:
    """Species without an IUCN taxon ID must be silently skipped."""

    def test_no_api_call_for_null_taxon_id(self, species_without_iucn_id: Species) -> None:
        # Spec: no IUCN API call is made for species with iucn_taxon_id=null.
        client = _make_mock_client(None, None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        client.get_species_assessment.assert_not_called()

    def test_no_assessment_created_for_null_taxon_id(
        self, species_without_iucn_id: Species
    ) -> None:
        # No ConservationAssessment should exist after sync for this species.
        client = _make_mock_client(None, None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        count = ConservationAssessment.objects.filter(species=species_without_iucn_id).count()
        assert count == 0

    def test_no_error_logged_for_null_taxon_id(self, species_without_iucn_id: Species) -> None:
        # Spec: no error is logged when iucn_taxon_id=null — it is not an error condition.
        client = _make_mock_client(None, None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert len(job.error_log) == 0

    def test_null_taxon_id_species_not_counted_as_processed(
        self, species_without_iucn_id: Species
    ) -> None:
        # Species excluded from the queryset entirely — records_processed should be 0.
        client = _make_mock_client(None, None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        assert result["processed"] == 0

    def test_syncjob_status_completed_with_no_processable_species(
        self, species_without_iucn_id: Species
    ) -> None:
        # A sync run with zero processable species should still complete (not fail).
        client = _make_mock_client(None, None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.status == SyncJob.Status.COMPLETED


# ---------------------------------------------------------------------------
# BE-06-1 Scenario 3: Per-species API error → logged, task continues
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPerSpeciesApiError:
    """IUCN API errors for one species must not abort the whole sync run."""

    def test_error_logged_in_syncjob_error_log(self, species_with_iucn_id: Species) -> None:
        # Spec: error must appear in SyncJob.error_log with the species ID.
        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.side_effect = IUCNAPIError("Internal Server Error 500")
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert len(job.error_log) == 1
        error_entry = job.error_log[0]
        assert "species_id" in error_entry or "error" in error_entry

    def test_species_id_present_in_error_log_entry(self, species_with_iucn_id: Species) -> None:
        # Spec: the error entry must identify which species failed.
        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.side_effect = IUCNAPIError("500")
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        error_entry = job.error_log[0]
        assert error_entry.get("species_id") == species_with_iucn_id.id

    def test_task_continues_after_per_species_error(
        self,
        species_with_iucn_id: Species,
        second_species_with_iucn_id: Species,
    ) -> None:
        # Spec: after one species errors, processing continues for the next species.
        call_count = 0
        summary_ok = make_summary(code="LC")
        detail_ok = make_detail(category_code="LC")

        def side_effect(taxon_id: int):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise IUCNAPIError("500 on first species")
            return summary_ok, False

        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.side_effect = side_effect
        client.get_assessment.return_value = (detail_ok, False)
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        # Both species were attempted
        assert result["processed"] == 2

    def test_status_completed_when_at_least_one_species_succeeded(
        self,
        species_with_iucn_id: Species,
        second_species_with_iucn_id: Species,
    ) -> None:
        # Spec: job.status='completed' if at least one species succeeded — not 'failed'.
        summary_ok = make_summary(code="EN")
        detail_ok = make_detail(category_code="EN")
        call_count = 0

        def side_effect(taxon_id: int):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise IUCNAPIError("500")
            return summary_ok, False

        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.side_effect = side_effect
        client.get_assessment.return_value = (detail_ok, False)
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.status == SyncJob.Status.COMPLETED

    def test_status_failed_when_all_species_errored(
        self,
        species_with_iucn_id: Species,
        second_species_with_iucn_id: Species,
    ) -> None:
        # Adversarial: if EVERY species errors, status must be 'failed', not 'completed'.
        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.side_effect = IUCNAPIError("500 for all")
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert job.status == SyncJob.Status.FAILED

    def test_connection_error_raises_iucn_api_error(self) -> None:
        # Adversarial: network-level connection error (not HTTP) must be caught and
        # re-raised as IUCNAPIError, not as requests.ConnectionError.
        client = IUCNClient(
            token="testtoken", base_url="https://api.iucnredlist.org/api/v4", timeout=1
        )
        with patch("integration.clients.iucn.requests.get") as mock_get:
            mock_get.side_effect = requests.ConnectionError("connection refused")
            with pytest.raises(IUCNAPIError, match="IUCN API request failed"):
                client.get_species_assessment(12345)


# ---------------------------------------------------------------------------
# BE-06-1 Scenario 4: pending_review assessment must not be overwritten
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPendingReviewPreserved:
    """A coordinator's pending_review flag must survive a sync run."""

    def test_pending_review_category_not_overwritten(self, species_with_iucn_id: Species) -> None:
        # Spec: an existing assessment with review_status='pending_review' is not
        # overwritten; the coordinator's flag is preserved.
        existing = ConservationAssessment.objects.create(
            species=species_with_iucn_id,
            category="CR",
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
            review_status=ConservationAssessment.ReviewStatus.PENDING_REVIEW,
        )

        # API now says EN — must not clobber the existing CR/pending_review record
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        existing.refresh_from_db()
        assert existing.category == "CR"

    def test_pending_review_status_preserved_after_sync(
        self, species_with_iucn_id: Species
    ) -> None:
        # review_status must remain 'pending_review' after the sync runs.
        ConservationAssessment.objects.create(
            species=species_with_iucn_id,
            category="CR",
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
            review_status=ConservationAssessment.ReviewStatus.PENDING_REVIEW,
        )

        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        ca = ConservationAssessment.objects.get(
            species=species_with_iucn_id, source="iucn_official"
        )
        assert ca.review_status == ConservationAssessment.ReviewStatus.PENDING_REVIEW

    def test_pending_review_no_duplicate_record_created(
        self, species_with_iucn_id: Species
    ) -> None:
        # The implementation skips (returns 'skipped') for pending_review species —
        # exactly 1 record remains, not 2.
        ConservationAssessment.objects.create(
            species=species_with_iucn_id,
            category="CR",
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
            review_status=ConservationAssessment.ReviewStatus.PENDING_REVIEW,
        )

        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        count = ConservationAssessment.objects.filter(
            species=species_with_iucn_id, source="iucn_official"
        ).count()
        assert count == 1

    def test_accepted_assessment_is_updated_not_duplicated(
        self, species_with_iucn_id: Species
    ) -> None:
        # Adversarial: an existing 'accepted' assessment SHOULD be updated in-place,
        # not joined by a second row.
        ConservationAssessment.objects.create(
            species=species_with_iucn_id,
            category="CR",
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
            review_status=ConservationAssessment.ReviewStatus.ACCEPTED,
        )

        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        count = ConservationAssessment.objects.filter(
            species=species_with_iucn_id, source="iucn_official"
        ).count()
        assert count == 1

    def test_accepted_assessment_category_updated_in_place(
        self, species_with_iucn_id: Species
    ) -> None:
        # Adversarial: an existing 'accepted' assessment's category must be updated
        # to reflect the new IUCN data.
        existing = ConservationAssessment.objects.create(
            species=species_with_iucn_id,
            category="CR",
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
            review_status=ConservationAssessment.ReviewStatus.ACCEPTED,
        )

        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        existing.refresh_from_db()
        assert existing.category == "EN"


# ---------------------------------------------------------------------------
# BE-06-1 Scenario 5: Idempotency — no duplicate records on repeated sync
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestIdempotency:
    """Running the sync twice without data changes must not create duplicate records."""

    def test_no_duplicate_assessments_on_second_run(self, species_with_iucn_id: Species) -> None:
        # Spec: second run with unchanged data → no duplicate ConservationAssessment.
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()
            iucn_sync()

        count = ConservationAssessment.objects.filter(
            species=species_with_iucn_id, source="iucn_official"
        ).count()
        assert count == 1

    def test_second_run_increments_records_updated(self, species_with_iucn_id: Species) -> None:
        # After the first run creates the record, the second run should update it.
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()
            result2 = iucn_sync()

        assert result2["updated"] == 1
        assert result2["created"] == 0


# ---------------------------------------------------------------------------
# Cache-hit path: rate-limit sleep suppressed for cached responses
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCacheHitSuppressesRateLimitSleep:
    """client.last_request_was_cache_hit=True must prevent wait_between_requests calls."""

    def test_wait_not_called_on_cache_hit(self, species_with_iucn_id: Species) -> None:
        # Spec: do not use per-request sleep for cached hits.
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")

        # Both calls are cache hits
        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.return_value = (summary, True)
        client.get_assessment.return_value = (detail, True)
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        client.wait_between_requests.assert_not_called()

    def test_wait_called_on_cache_miss(self, species_with_iucn_id: Species) -> None:
        # Spec: sleep only after a live API call, not after a cache hit.
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")

        client = MagicMock(spec=IUCNClient)
        client.get_species_assessment.return_value = (summary, False)
        client.get_assessment.return_value = (detail, False)
        client.wait_between_requests = MagicMock()

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        assert client.wait_between_requests.call_count >= 1


# ---------------------------------------------------------------------------
# IUCNClient unit tests — behavior from spec, not implementation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestIUCNClientCacheBehavior:
    """Verify caching behavior described in the spec."""

    def test_cache_miss_makes_http_request(self) -> None:
        # On a cache miss the client must hit the network.
        client = IUCNClient(
            token="testtoken", base_url="https://api.iucnredlist.org/api/v4", timeout=5
        )
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = make_summary()

        with patch("integration.clients.iucn.requests.get", return_value=mock_response) as mock_get:
            result, cache_hit = client.get_species_assessment(20001)

        assert mock_get.called
        assert result is not None
        assert cache_hit is False

    def test_cache_hit_does_not_make_http_request(self) -> None:
        # Spec: cache key iucn:taxa:sis:{id} with 7-day TTL. After a cache population,
        # the next call must not hit the network.
        client = IUCNClient(
            token="testtoken", base_url="https://api.iucnredlist.org/api/v4", timeout=5
        )
        cached_data = make_summary()
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = cached_data

        with patch("integration.clients.iucn.requests.get", return_value=mock_response) as mock_get:
            client.get_species_assessment(20002)  # populates cache
            mock_get.reset_mock()
            result, cache_hit = client.get_species_assessment(20002)  # should be cache hit

        assert not mock_get.called
        assert cache_hit is True
        assert result == cached_data

    def test_404_returns_none(self) -> None:
        # Spec: returns None on 404.
        client = IUCNClient(
            token="testtoken", base_url="https://api.iucnredlist.org/api/v4", timeout=5
        )
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.ok = False

        with patch("integration.clients.iucn.requests.get", return_value=mock_response):
            result, _ = client.get_species_assessment(20003)

        assert result is None

    def test_non_404_error_raises_iucn_api_error(self) -> None:
        # Spec: raises IUCNAPIError on non-404 HTTP errors.
        # Uses a unique taxon ID to guarantee a cache miss for this test.
        client = IUCNClient(
            token="testtoken", base_url="https://api.iucnredlist.org/api/v4", timeout=5
        )
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.ok = False
        mock_response.text = "Internal Server Error"

        with patch("integration.clients.iucn.requests.get", return_value=mock_response):
            with pytest.raises(IUCNAPIError):
                client.get_species_assessment(20004)

    def test_404_cached_as_sentinel_second_call_returns_none(self) -> None:
        # Adversarial: a 404 must be cached so the second call also returns None
        # without hitting the network a second time.
        client = IUCNClient(
            token="testtoken", base_url="https://api.iucnredlist.org/api/v4", timeout=5
        )
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.ok = False

        with patch("integration.clients.iucn.requests.get", return_value=mock_response) as mock_get:
            result1, _ = client.get_species_assessment(20005)
            mock_get.reset_mock()
            result2, cache_hit2 = client.get_species_assessment(20005)

        assert result1 is None
        assert result2 is None
        assert cache_hit2 is True
        # Second call should be served from cache, not network
        assert not mock_get.called

    def test_missing_token_raises_iucn_api_error(self) -> None:
        # Security: client must refuse to make requests without a configured token.
        # Uses a unique taxon ID to guarantee a fresh cache miss.
        client = IUCNClient(token="", base_url="https://api.iucnredlist.org/api/v4", timeout=5)
        with pytest.raises(IUCNAPIError, match="IUCN_API_TOKEN"):
            client.get_species_assessment(20006)

    def test_non_json_response_raises_iucn_api_error(self) -> None:
        # Adversarial: malformed (non-JSON) API response must raise IUCNAPIError,
        # not ValueError or JSONDecodeError.
        # Uses a unique taxon ID to guarantee a fresh cache miss.
        client = IUCNClient(
            token="testtoken", base_url="https://api.iucnredlist.org/api/v4", timeout=5
        )
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.side_effect = ValueError("No JSON object could be decoded")

        with patch("integration.clients.iucn.requests.get", return_value=mock_response):
            with pytest.raises(IUCNAPIError, match="non-JSON"):
                client.get_species_assessment(20007)


# ---------------------------------------------------------------------------
# Helper function unit tests — _pick_latest_assessment, _normalize_category
# ---------------------------------------------------------------------------


class TestPickLatestAssessment:
    """Verify selection logic for the latest assessment from the summary payload."""

    def test_picks_assessment_with_latest_true(self) -> None:
        # Spec: the summary endpoint returns assessments list; latest=True flag marks
        # the current assessment.
        assessments = [
            {"assessment_id": 1, "latest": False, "year_published": 2018, "code": "VU"},
            {"assessment_id": 2, "latest": True, "year_published": 2022, "code": "EN"},
        ]
        result = _pick_latest_assessment({"assessments": assessments})
        assert result is not None
        assert result["assessment_id"] == 2

    def test_falls_back_to_highest_year_when_no_latest_flag(self) -> None:
        # Adversarial: if no assessment has latest=True, pick the highest year_published.
        assessments = [
            {"assessment_id": 1, "latest": False, "year_published": 2014, "code": "CR"},
            {"assessment_id": 2, "latest": False, "year_published": 2019, "code": "EN"},
        ]
        result = _pick_latest_assessment({"assessments": assessments})
        assert result is not None
        assert result["assessment_id"] == 2

    def test_returns_none_for_empty_assessments_list(self) -> None:
        # Adversarial: summary with empty assessments must not crash — returns None.
        result = _pick_latest_assessment({"assessments": []})
        assert result is None

    def test_returns_none_for_missing_assessments_key(self) -> None:
        # Adversarial: malformed summary without the 'assessments' key.
        result = _pick_latest_assessment({})
        assert result is None

    def test_picks_first_when_multiple_latest_true(self) -> None:
        # Edge case: multiple assessments flagged latest=True (shouldn't happen in
        # real data, but must not raise).
        assessments = [
            {"assessment_id": 10, "latest": True, "year_published": 2020, "code": "EN"},
            {"assessment_id": 11, "latest": True, "year_published": 2022, "code": "VU"},
        ]
        result = _pick_latest_assessment({"assessments": assessments})
        assert result is not None
        assert result["assessment_id"] == 10  # first flagged wins


class TestNormalizeCategory:
    """Verify category normalization handles both string and dict shapes."""

    def test_string_code_normalized_to_uppercase(self) -> None:
        assert _normalize_category("en") == "EN"

    def test_dict_with_code_key_extracts_correctly(self) -> None:
        # Spec: detail endpoint returns red_list_category as dict with 'CODE' key.
        assert _normalize_category({"CODE": "EN", "DESCRIPTION": {"EN": "ENDANGERED"}}) == "EN"

    def test_dict_with_lowercase_code_key(self) -> None:
        # Robustness: some responses may use lowercase 'code'.
        assert _normalize_category({"code": "VU"}) == "VU"

    def test_none_returns_none(self) -> None:
        assert _normalize_category(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert _normalize_category("") is None

    def test_dict_with_no_code_returns_none(self) -> None:
        # Edge case: dict shape but no CODE key should return None safely.
        assert _normalize_category({"DESCRIPTION": {"EN": "ENDANGERED"}}) is None

    def test_strips_whitespace(self) -> None:
        assert _normalize_category("  CR  ") == "CR"


# ---------------------------------------------------------------------------
# Adversarial: invalid category from API must not be silently stored
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestInvalidCategoryHandling:
    """An unrecognized IUCN category must be rejected and logged as an error."""

    def test_invalid_category_logged_as_error(self, species_with_iucn_id: Species) -> None:
        # Adversarial: if the API returns an unknown category code, the task must
        # log an error rather than silently storing bad data in the database.
        summary = make_summary(code="INVALID_CODE")
        detail = {
            "assessment_id": 10001,
            "red_list_category": {"CODE": "INVALID_CODE"},
            "year_published": 2022,
        }
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert len(job.error_log) >= 1

    def test_invalid_category_does_not_create_assessment(
        self, species_with_iucn_id: Species
    ) -> None:
        # Adversarial: no ConservationAssessment should be created when the
        # category from the API is not in the valid set.
        summary = make_summary(code="BOGUS")
        detail = {
            "assessment_id": 10001,
            "red_list_category": {"CODE": "BOGUS"},
            "year_published": 2022,
        }
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        count = ConservationAssessment.objects.filter(
            species=species_with_iucn_id, source="iucn_official"
        ).count()
        assert count == 0


# ---------------------------------------------------------------------------
# Adversarial: API returns None (404/empty) for species summary
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestApiReturnsNoneForSummary:
    """If the IUCN API returns 404 (None) for a species summary, skip gracefully."""

    def test_no_assessment_created_when_summary_is_none(
        self, species_with_iucn_id: Species
    ) -> None:
        # 404 from the IUCN API → client returns None → species skipped with no error.
        client = _make_mock_client(summary_return=None, detail_return=None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        count = ConservationAssessment.objects.filter(
            species=species_with_iucn_id, source="iucn_official"
        ).count()
        assert count == 0

    def test_records_skipped_incremented_when_summary_is_none(
        self, species_with_iucn_id: Species
    ) -> None:
        # records_skipped tracks species where API returned no data.
        client = _make_mock_client(summary_return=None, detail_return=None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        assert result["skipped"] >= 1

    def test_no_error_logged_when_summary_is_none(self, species_with_iucn_id: Species) -> None:
        # A 404 (not found in IUCN) is not an error — it should not populate error_log.
        client = _make_mock_client(summary_return=None, detail_return=None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            result = iucn_sync()

        job = SyncJob.objects.get(pk=result["job_id"])
        assert len(job.error_log) == 0


# ---------------------------------------------------------------------------
# Mirror policy: Species.iucn_status tracks accepted iucn_official assessment
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestIUCNStatusMirror:
    """After a successful sync, Species.iucn_status must mirror the accepted category.

    Per CLAUDE.md "Conservation status sourcing": the public badge field is a
    denormalized mirror of the authoritative assessment, not independently
    editable. The ALLOW_IUCN_STATUS_OVERWRITE setting gates this behavior so
    operators can freeze statuses during review windows.
    """

    def test_mirror_sets_iucn_status_on_create(self, species_with_iucn_id: Species) -> None:
        species_with_iucn_id.iucn_status = None
        species_with_iucn_id.save(update_fields=["iucn_status"])
        summary = make_summary(code="CR")
        detail = make_detail(category_code="CR")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        species_with_iucn_id.refresh_from_db()
        assert species_with_iucn_id.iucn_status == "CR"

    def test_mirror_overwrites_stale_status(self, species_with_iucn_id: Species) -> None:
        # Pre-existing manual status "VU" must be overwritten to match IUCN "EN".
        # Use QuerySet.update() to bypass the audit signals for test setup.
        Species.objects.filter(pk=species_with_iucn_id.pk).update(iucn_status="VU")
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        species_with_iucn_id.refresh_from_db()
        assert species_with_iucn_id.iucn_status == "EN"

    def test_mirror_respects_allow_iucn_status_overwrite_false(
        self, species_with_iucn_id: Species, settings: Any
    ) -> None:
        # With the toggle off, sync creates the assessment but leaves iucn_status alone.
        settings.ALLOW_IUCN_STATUS_OVERWRITE = False
        Species.objects.filter(pk=species_with_iucn_id.pk).update(iucn_status="VU")
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        species_with_iucn_id.refresh_from_db()
        assert species_with_iucn_id.iucn_status == "VU"
        # The assessment itself should still be recorded.
        assert ConservationAssessment.objects.filter(
            species=species_with_iucn_id, source="iucn_official"
        ).exists()

    def test_mirror_skipped_species_not_touched(self, species_without_iucn_id: Species) -> None:
        # Species with null iucn_taxon_id is never processed — iucn_status stays NULL.
        species_without_iucn_id.iucn_status = None
        species_without_iucn_id.save(update_fields=["iucn_status"])
        client = _make_mock_client(summary_return=None, detail_return=None)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        species_without_iucn_id.refresh_from_db()
        assert species_without_iucn_id.iucn_status is None

    def test_mirror_does_not_fire_for_pending_review(self, species_with_iucn_id: Species) -> None:
        # Existing pending_review assessment means sync returns "skipped" for this
        # species — iucn_status must NOT be rewritten.
        ConservationAssessment.objects.create(
            species=species_with_iucn_id,
            category="VU",
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
            review_status=ConservationAssessment.ReviewStatus.PENDING_REVIEW,
        )
        Species.objects.filter(pk=species_with_iucn_id.pk).update(iucn_status="VU")
        summary = make_summary(code="EN")
        detail = make_detail(category_code="EN")
        client = _make_mock_client(summary, detail)

        with patch("integration.tasks.IUCNClient", return_value=client):
            iucn_sync()

        species_with_iucn_id.refresh_from_db()
        assert species_with_iucn_id.iucn_status == "VU"
