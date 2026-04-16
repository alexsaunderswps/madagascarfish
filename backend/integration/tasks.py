from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils.timezone import now

from integration.clients.iucn import IUCNAPIError, IUCNClient
from integration.models import SyncJob
from species.models import ConservationAssessment, Species

logger = logging.getLogger(__name__)

VALID_IUCN_CATEGORIES = {choice[0] for choice in Species.IUCNStatus.choices}


@shared_task(bind=True, max_retries=3)
def iucn_sync(self) -> dict[str, int]:
    """Pull current IUCN assessments for every Species with iucn_taxon_id set.

    Per gate 06 spec: creates/updates ConservationAssessment with
    source='iucn_official'. Preserves any existing record in 'pending_review'
    by skipping the update for that species. Per-species errors are recorded
    in SyncJob.error_log and do not abort the whole run.
    """
    client = IUCNClient()
    job = SyncJob.objects.create(
        job_type=SyncJob.JobType.IUCN_SYNC,
        status=SyncJob.Status.RUNNING,
        started_at=now(),
    )

    species_qs = Species.objects.exclude(iucn_taxon_id__isnull=True).order_by("id")

    try:
        for species in species_qs.iterator():
            job.records_processed += 1
            try:
                result = _sync_one_species(client, species, job)
                if result == "created":
                    job.records_created += 1
                elif result == "updated":
                    job.records_updated += 1
                elif result == "skipped":
                    job.records_skipped += 1
            except IUCNAPIError as exc:
                job.error_log.append(
                    {
                        "species_id": species.id,
                        "scientific_name": species.scientific_name,
                        "error": str(exc),
                    }
                )
                logger.warning("IUCN sync error for species %s: %s", species.id, exc)

        # Job fails only if every processed species errored. All-skipped (e.g.,
        # no species had iucn_taxon_id, or every API lookup 404'd) is a valid
        # completed run with zero work to do.
        all_errored = job.records_processed > 0 and len(job.error_log) == job.records_processed
        job.status = SyncJob.Status.FAILED if all_errored else SyncJob.Status.COMPLETED
    except Exception as exc:
        job.status = SyncJob.Status.FAILED
        job.error_log.append({"fatal": str(exc)})
        logger.exception("iucn_sync fatal failure")
        raise
    finally:
        job.completed_at = now()
        job.save()

    return {
        "job_id": job.id,
        "processed": job.records_processed,
        "created": job.records_created,
        "updated": job.records_updated,
        "skipped": job.records_skipped,
    }


def _sync_one_species(client: IUCNClient, species: Species, job: SyncJob) -> str:
    """Returns 'created', 'updated', or 'skipped'."""
    summary, cache_hit = client.get_species_assessment(species.iucn_taxon_id)
    if not cache_hit:
        client.wait_between_requests()

    if summary is None:
        return "skipped"

    latest = _pick_latest_assessment(summary)
    if latest is None:
        return "skipped"

    assessment_id = latest.get("assessment_id")
    if assessment_id is None:
        return "skipped"

    detail, cache_hit = client.get_assessment(int(assessment_id))
    if not cache_hit:
        client.wait_between_requests()

    payload = detail or latest
    category = _normalize_category(payload.get("code") or payload.get("red_list_category"))
    if category is None:
        # IUCN occasionally returns assessments without a category code (historic
        # records, in-progress reviews). Skip rather than treat as an error.
        return "skipped"
    if category not in VALID_IUCN_CATEGORIES:
        raise IUCNAPIError(f"invalid IUCN category {category!r} for species {species.id}")

    parsed = {
        "category": category,
        "criteria": str(payload.get("criteria") or "")[:100],
        "assessor": _format_assessor(payload),
        "assessment_date": _parse_assessment_date(payload),
    }

    with transaction.atomic():
        existing = (
            ConservationAssessment.objects.select_for_update()
            .filter(species=species, source=ConservationAssessment.Source.IUCN_OFFICIAL)
            .first()
        )

        if (
            existing
            and existing.review_status == ConservationAssessment.ReviewStatus.PENDING_REVIEW
        ):
            return "skipped"

        if existing is None:
            ConservationAssessment.objects.create(
                species=species,
                source=ConservationAssessment.Source.IUCN_OFFICIAL,
                review_status=ConservationAssessment.ReviewStatus.ACCEPTED,
                last_sync_job=job,
                **parsed,
            )
            outcome = "created"
        else:
            for field, value in parsed.items():
                setattr(existing, field, value)
            existing.review_status = ConservationAssessment.ReviewStatus.ACCEPTED
            existing.last_sync_job = job
            existing.save()
            outcome = "updated"

        # Mirror the accepted IUCN category onto Species.iucn_status so the
        # public badge and DwC export stay aligned with the authoritative source.
        # See CLAUDE.md "Conservation status sourcing".
        if (
            getattr(settings, "ALLOW_IUCN_STATUS_OVERWRITE", True)
            and species.iucn_status != category
        ):
            species.iucn_status = category
            species.save(update_fields=["iucn_status", "updated_at"])

        return outcome


def _pick_latest_assessment(summary: dict[str, Any]) -> dict[str, Any] | None:
    assessments = summary.get("assessments") or []
    if not assessments:
        return None
    flagged = [a for a in assessments if a.get("latest")]
    if flagged:
        return flagged[0]
    return max(assessments, key=lambda a: a.get("year_published") or 0)


def _normalize_category(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, dict):
        code = value.get("CODE") or value.get("code")
        if not code:
            return None
        value = code
    return str(value).strip().upper()


def _format_assessor(payload: dict[str, Any]) -> str:
    assessors = payload.get("assessors")
    if isinstance(assessors, list):
        names = [
            a.get("name") or a.get("full_name") or "" for a in assessors if isinstance(a, dict)
        ]
        joined = ", ".join(n for n in names if n)
        if joined:
            return joined[:200]
    single = payload.get("assessor")
    if isinstance(single, str):
        return single[:200]
    return ""


def _parse_assessment_date(payload: dict[str, Any]) -> date | None:
    raw = payload.get("assessment_date") or payload.get("date_assessed")
    if isinstance(raw, str) and raw:
        for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(raw[:10], fmt).date()
            except ValueError:
                continue
    year = payload.get("year_published")
    if isinstance(year, int) and year > 0:
        return date(year, 1, 1)
    if isinstance(year, str) and year.isdigit():
        return date(int(year), 1, 1)
    return None
