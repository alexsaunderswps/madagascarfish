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

STALE_CENSUS_THRESHOLD_MONTHS = 12
STALE_CENSUS_THRESHOLD_DAYS = 365


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
            effective = _effective_last_update(pop.last_census_date, pop.latest_holding)
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
                        pop.latest_holding.isoformat() if pop.latest_holding else None
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
