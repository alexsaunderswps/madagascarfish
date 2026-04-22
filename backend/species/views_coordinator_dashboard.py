"""Gate 3 Ex-situ Coordinator Dashboard endpoints.

Tier 3+ only. Unlike the public DashboardView in views_dashboard.py, these
panels surface population-level detail (identifiable species at identifiable
institutions), so they gate on the standard TierPermission(3) pattern.

Panel numbering follows the user's ordering from the Gate 3 scope call
(not the BA review's numbering):

    Panel 1 — Coverage gap (CR/EN/VU without ex-situ populations)
    Panel 2 — Studbook-managed populations
    Panel 3 — Sex-ratio / demographic risk
    Panel 4 — Stale census (this file — first panel landed)
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import TypedDict

from django.db.models import Max
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import TierPermission
from populations.models import ExSituPopulation
from species.models import Species

STALE_CENSUS_THRESHOLD_MONTHS = 12
STALE_CENSUS_THRESHOLD_DAYS = 365

# Severity ordering, highest first. Drives Panel 1 sort and is narrower than
# the full IUCNStatus enum because Panel 1 is a fragility triage for
# confirmed-threatened species, not a status audit.
COVERAGE_GAP_THREATENED = [
    Species.IUCNStatus.CR,
    Species.IUCNStatus.EN,
    Species.IUCNStatus.VU,
]
_SEVERITY_RANK: dict[str, int] = {str(s): i for i, s in enumerate(COVERAGE_GAP_THREATENED)}


class StalePopulationRow(TypedDict):
    population_id: int
    species: dict[str, object]
    institution: dict[str, object]
    last_census_date: str | None
    most_recent_holding_record_date: str | None
    effective_last_update: str | None
    days_since_update: int | None


def _effective_last_update(
    last_census_date: date | None, last_holding_date: date | None
) -> date | None:
    """Newest of the two census signals. None if both are absent."""
    if last_census_date and last_holding_date:
        return max(last_census_date, last_holding_date)
    return last_census_date or last_holding_date


class StaleCensusView(APIView):
    """Populations whose most recent census signal is >12 months old (or missing).

    Signal = max(ExSituPopulation.last_census_date, most recent HoldingRecord.date).
    Populations with neither signal are considered stale — they've never been
    censused, which is itself a coordinator-relevant gap.
    """

    permission_classes = [TierPermission(3)]

    def get(self, request: Request) -> Response:
        today = timezone.now().date()
        threshold_date = today - timedelta(days=STALE_CENSUS_THRESHOLD_DAYS)

        populations = (
            ExSituPopulation.objects.select_related("species", "institution")
            .annotate(latest_holding=Max("holding_records__date"))
            .all()
        )

        stale_rows: list[StalePopulationRow] = []
        total = 0
        for pop in populations:
            total += 1
            latest_holding: date | None = pop.latest_holding  # type: ignore[attr-defined]
            effective = _effective_last_update(pop.last_census_date, latest_holding)
            if effective is not None and effective >= threshold_date:
                continue
            days_since = (today - effective).days if effective else None
            stale_rows.append(
                {
                    "population_id": pop.id,
                    "species": {
                        "id": pop.species_id,
                        "scientific_name": pop.species.scientific_name,
                    },
                    "institution": {
                        "id": pop.institution_id,
                        "name": pop.institution.name,
                    },
                    "last_census_date": (
                        pop.last_census_date.isoformat() if pop.last_census_date else None
                    ),
                    "most_recent_holding_record_date": (
                        latest_holding.isoformat() if latest_holding else None
                    ),
                    "effective_last_update": effective.isoformat() if effective else None,
                    "days_since_update": days_since,
                }
            )

        stale_rows.sort(
            key=lambda r: (
                0 if r["days_since_update"] is None else 1,
                -(r["days_since_update"] or 0),
                r["species"]["scientific_name"],
            )
        )

        return Response(
            {
                "threshold_months": STALE_CENSUS_THRESHOLD_MONTHS,
                "reference_date": today.isoformat(),
                "total_populations": total,
                "total_stale": len(stale_rows),
                "results": stale_rows,
            }
        )


def _serialize_species_row(sp: Species) -> dict[str, object]:
    return {
        "species_id": sp.id,
        "scientific_name": sp.scientific_name,
        "genus": sp.genus,
        "family": sp.family,
        "iucn_status": sp.iucn_status,
        "endemic_status": sp.endemic_status,
        "population_trend": sp.population_trend,
        "cares_status": sp.cares_status,
        "shoal_priority": sp.shoal_priority,
    }


class CoverageGapView(APIView):
    """Threatened species with zero ex-situ populations (Gate 3 Panel 1).

    Default surface is endemic-only because the ABQ coordinator audience
    triages endemic, threatened, no-program species first — that cut is
    the single highest-signal view of the registry for this workshop.
    A ``?endemic_only=false`` toggle is surfaced obviously in the frontend.

    A companion Data Deficient card rides the same response so the
    frontend doesn't pay a second round trip for the "needs assessment"
    sibling: ``data_deficient.total`` / ``data_deficient.endemic_count``.
    """

    permission_classes = [TierPermission(3)]

    def get(self, request: Request) -> Response:
        endemic_only = self._parse_bool(request.query_params.get("endemic_only"), default=True)

        gap_qs = Species.objects.filter(
            iucn_status__in=COVERAGE_GAP_THREATENED,
            ex_situ_populations__isnull=True,
        )
        if endemic_only:
            gap_qs = gap_qs.filter(endemic_status=Species.EndemicStatus.ENDEMIC)
        gap_qs = gap_qs.only(
            "id",
            "scientific_name",
            "genus",
            "family",
            "iucn_status",
            "endemic_status",
            "population_trend",
            "cares_status",
            "shoal_priority",
        )

        def _sort_key(row: dict[str, object]) -> tuple[int, str]:
            status = str(row["iucn_status"] or "")
            name = str(row["scientific_name"] or "")
            return (_SEVERITY_RANK.get(status, 99), name)

        rows = sorted((_serialize_species_row(sp) for sp in gap_qs), key=_sort_key)

        dd_qs = Species.objects.filter(iucn_status=Species.IUCNStatus.DD)
        dd_total = dd_qs.count()
        dd_endemic = dd_qs.filter(endemic_status=Species.EndemicStatus.ENDEMIC).count()

        return Response(
            {
                "endemic_only": endemic_only,
                "total": len(rows),
                "results": rows,
                "data_deficient": {
                    "total": dd_total,
                    "endemic_count": dd_endemic,
                },
            }
        )

    @staticmethod
    def _parse_bool(raw: str | None, *, default: bool) -> bool:
        if raw is None:
            return default
        return raw.strip().lower() in ("1", "true", "yes", "on")
