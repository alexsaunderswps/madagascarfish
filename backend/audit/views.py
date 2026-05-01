"""Coordinator-only audit-trail CSV export.

Returns ``AuditEntry`` rows as a streaming CSV with one row per audit
entry. Filterable by ``institution_id`` (matches either the actor's
institution OR the actor + target combination — see below), start/end
dates, and target type. Tier 3+ only.

Why streaming: the export is per-coordinator and per-quarter, so
volumes stay modest. Streaming is still cheap and avoids RAM spikes
if a coordinator pulls a year's worth across all institutions.
"""

from __future__ import annotations

import csv
from datetime import datetime
from typing import Any

from django.db.models import Q
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.views import APIView

from accounts.permissions import TierPermission
from audit.models import AuditEntry
from fieldwork.models import FieldProgram
from populations.models import BreedingEvent, ExSituPopulation

CSV_COLUMNS = (
    "timestamp",
    "actor_email",
    "actor_kind",
    "actor_system",
    "actor_institution",
    "action",
    "target_type",
    "target_id",
    "target_label",
    "field",
    "before",
    "after",
    "reason",
)


class _Echo:
    """File-like object whose `write()` returns the line — required by
    `csv.writer` to write into a streaming response.
    """

    def write(self, value: str) -> str:
        return value


def _parse_date(raw: str | None, *, field_name: str) -> datetime | None:
    if not raw:
        return None
    try:
        # Accept either YYYY-MM-DD or full ISO 8601.
        return datetime.fromisoformat(raw)
    except ValueError as e:
        raise ValidationError({field_name: f"Expected ISO date (YYYY-MM-DD), got {raw!r}."}) from e


def _resolve_target_label(row: AuditEntry, label_caches: dict[str, dict[int, str]]) -> str:
    cache = label_caches.get(row.target_type)
    if cache is None:
        return ""
    return cache.get(row.target_id, "")


def _build_label_caches(rows: list[AuditEntry]) -> dict[str, dict[int, str]]:
    """Resolve target labels for every distinct (target_type, target_id)
    we'll write. Done in batches per target type so the row writer
    stays O(1).
    """
    caches: dict[str, dict[int, str]] = {}

    pop_ids = {r.target_id for r in rows if r.target_type == "populations.ExSituPopulation"}
    if pop_ids:
        cache: dict[int, str] = {}
        for pop in ExSituPopulation.objects.filter(id__in=pop_ids).select_related(
            "species", "institution"
        ):
            cache[pop.pk] = f"{pop.species.scientific_name} · {pop.institution.name}"
        caches["populations.ExSituPopulation"] = cache

    event_ids = {r.target_id for r in rows if r.target_type == "populations.BreedingEvent"}
    if event_ids:
        cache = {}
        for ev in BreedingEvent.objects.filter(id__in=event_ids).select_related(
            "population__species"
        ):
            cache[ev.pk] = (
                f"{ev.get_event_type_display()} · "
                f"{ev.population.species.scientific_name} ({ev.event_date.isoformat()})"
            )
        caches["populations.BreedingEvent"] = cache

    program_ids = {r.target_id for r in rows if r.target_type == "fieldwork.FieldProgram"}
    if program_ids:
        cache = {}
        for fp in FieldProgram.objects.filter(id__in=program_ids):
            cache[fp.pk] = fp.name
        caches["fieldwork.FieldProgram"] = cache

    return caches


def _row_iter(rows: list[AuditEntry], label_caches: dict[str, dict[int, str]]) -> Any:
    """Yield bytes for each line of the CSV, including the header."""
    writer = csv.writer(_Echo())
    yield writer.writerow(CSV_COLUMNS)
    for row in rows:
        actor_inst = row.actor_institution
        actor_inst_name = actor_inst.name if actor_inst is not None else ""
        actor_email = row.actor_user.email if row.actor_user else ""
        yield writer.writerow(
            [
                row.timestamp.isoformat(),
                actor_email,
                row.actor_type,
                row.actor_system,
                actor_inst_name,
                row.action,
                row.target_type,
                row.target_id,
                _resolve_target_label(row, label_caches),
                row.field,
                _to_csv_text(row.before),
                _to_csv_text(row.after),
                row.reason,
            ]
        )


def _to_csv_text(value: dict[str, Any]) -> str:
    """JSON-stringify the before/after blob into one CSV cell. Newlines
    inside the JSON are valid CSV (escaped via the writer's quoting),
    but we replace them defensively for spreadsheet-friendliness.
    """
    if not value:
        return ""
    import json

    s = json.dumps(value, ensure_ascii=False, default=str)
    return s.replace("\r", " ").replace("\n", " ")


class AuditCSVExportView(APIView):
    """GET /api/v1/audit/export.csv

    Tier 3+ only. Filterable via query params:

    - ``institution_id``: match audit rows where the actor was at this
      institution OR the target is owned by this institution
      (population/breeding-event/field-program ownership lookups).
    - ``start``: ISO date — earliest timestamp (inclusive).
    - ``end``: ISO date — latest timestamp (inclusive).
    - ``target_type``: optional filter ("populations.ExSituPopulation",
      "fieldwork.FieldProgram", etc.). Exact match.
    - ``limit``: cap (default 5000, max 50000).
    """

    permission_classes = [TierPermission(3)]

    def get(self, request: Request) -> StreamingHttpResponse:
        qs = AuditEntry.objects.select_related("actor_user", "actor_institution").order_by(
            "-timestamp"
        )

        institution_id_raw = request.query_params.get("institution_id")
        if institution_id_raw:
            try:
                institution_id = int(institution_id_raw)
            except ValueError as e:
                raise ValidationError({"institution_id": "Must be an integer."}) from e
            pop_ids = list(
                ExSituPopulation.objects.filter(institution_id=institution_id).values_list(
                    "id", flat=True
                )
            )
            event_ids = list(
                BreedingEvent.objects.filter(population__institution_id=institution_id).values_list(
                    "id", flat=True
                )
            )
            program_ids = list(
                FieldProgram.objects.filter(lead_institution_id=institution_id).values_list(
                    "id", flat=True
                )
            )
            qs = qs.filter(
                Q(actor_institution_id=institution_id)
                | Q(
                    target_type="populations.ExSituPopulation",
                    target_id__in=pop_ids,
                )
                | Q(
                    target_type="populations.BreedingEvent",
                    target_id__in=event_ids,
                )
                | Q(
                    target_type="fieldwork.FieldProgram",
                    target_id__in=program_ids,
                )
            )

        start = _parse_date(request.query_params.get("start"), field_name="start")
        end = _parse_date(request.query_params.get("end"), field_name="end")
        if start:
            qs = qs.filter(timestamp__gte=start)
        if end:
            # Make `end` inclusive — bump to end-of-day if the caller
            # supplied a date-only value.
            if end.hour == 0 and end.minute == 0 and end.second == 0:
                end = end.replace(hour=23, minute=59, second=59)
            qs = qs.filter(timestamp__lte=end)

        target_type = request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)

        try:
            limit = int(request.query_params.get("limit", 5000))
        except ValueError as e:
            raise ValidationError({"limit": "Must be an integer."}) from e
        limit = max(1, min(limit, 50_000))

        rows = list(qs[:limit])
        label_caches = _build_label_caches(rows)

        # Filename: stamp UTC time so the download lands with a unique name.
        stamp = timezone.now().strftime("%Y%m%dT%H%M%SZ")
        filename = f"audit-export-{stamp}.csv"

        response = StreamingHttpResponse(
            _row_iter(rows, label_caches),
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
