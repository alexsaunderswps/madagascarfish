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

from dataclasses import dataclass
from datetime import date, timedelta
from typing import TypedDict

from django.db.models import Max
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import TierOrServiceTokenPermission
from populations.models import ExSituPopulation, Transfer
from species.models import Species

# Census threshold. Days is the source of truth (used for the cutoff); months
# is a derived informational value emitted in the API response so frontend
# captions can say "past 12 months" without risking drift from the cutoff.
STALE_CENSUS_THRESHOLD_DAYS = 365
STALE_CENSUS_THRESHOLD_MONTHS = STALE_CENSUS_THRESHOLD_DAYS // 30

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

    permission_classes = [TierOrServiceTokenPermission(3, "COORDINATOR_API_TOKEN")]

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

    permission_classes = [TierOrServiceTokenPermission(3, "COORDINATOR_API_TOKEN")]

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


# ---------- Panel 2 — Studbook status ----------

# Four coordinator-relevant buckets, per the BA review decision on Q3. The
# "breeding, not studbook" bucket is load-bearing — it's the ad-hoc-hobbyist
# row the spec's "Why" blurb calls out, and collapsing it into "holdings"
# loses the signal the panel exists for.
STUDBOOK_MANAGED = "studbook_managed"
BREEDING_NOT_STUDBOOK = "breeding_not_studbook"
HOLDINGS_ONLY = "holdings_only"
NO_CAPTIVE = "no_captive_population"


@dataclass
class _SpeciesAggregate:
    species_id: int
    scientific_name: str
    population_count: int = 0
    has_studbook: bool = False
    has_breeding: bool = False


class StudbookStatusView(APIView):
    """Per-species classification across the four studbook/breeding buckets."""

    permission_classes = [TierOrServiceTokenPermission(3, "COORDINATOR_API_TOKEN")]

    def get(self, request: Request) -> Response:
        # Pull populations once, group in Python. This is small enough (dozens
        # of populations at MVP scale) that hitting the DB once beats three
        # filtered queries.
        populations = ExSituPopulation.objects.select_related("species").only(
            "id",
            "species_id",
            "breeding_status",
            "studbook_managed",
            "species__scientific_name",
        )

        by_species: dict[int, _SpeciesAggregate] = {}
        for pop in populations:
            entry = by_species.get(pop.species_id)
            if entry is None:
                entry = _SpeciesAggregate(
                    species_id=pop.species_id,
                    scientific_name=pop.species.scientific_name,
                )
                by_species[pop.species_id] = entry
            entry.population_count += 1
            if pop.studbook_managed:
                entry.has_studbook = True
            if pop.breeding_status == ExSituPopulation.BreedingStatus.BREEDING:
                entry.has_breeding = True

        buckets: dict[str, list[dict[str, object]]] = {
            STUDBOOK_MANAGED: [],
            BREEDING_NOT_STUDBOOK: [],
            HOLDINGS_ONLY: [],
        }
        for entry in by_species.values():
            row: dict[str, object] = {
                "species_id": entry.species_id,
                "scientific_name": entry.scientific_name,
                "population_count": entry.population_count,
            }
            if entry.has_studbook:
                buckets[STUDBOOK_MANAGED].append(row)
            elif entry.has_breeding:
                buckets[BREEDING_NOT_STUDBOOK].append(row)
            else:
                buckets[HOLDINGS_ONLY].append(row)

        for key in buckets:
            buckets[key].sort(key=lambda r: str(r["scientific_name"]))

        species_with_captive = set(by_species.keys())
        no_captive_count = Species.objects.exclude(id__in=species_with_captive).count()

        return Response(
            {
                "buckets": {
                    STUDBOOK_MANAGED: {
                        "count": len(buckets[STUDBOOK_MANAGED]),
                        "species": buckets[STUDBOOK_MANAGED],
                    },
                    BREEDING_NOT_STUDBOOK: {
                        "count": len(buckets[BREEDING_NOT_STUDBOOK]),
                        "species": buckets[BREEDING_NOT_STUDBOOK],
                    },
                    HOLDINGS_ONLY: {
                        "count": len(buckets[HOLDINGS_ONLY]),
                        "species": buckets[HOLDINGS_ONLY],
                    },
                    NO_CAPTIVE: {
                        "count": no_captive_count,
                        # species list omitted — Panel 1 covers the
                        # threatened subset; full list is a species-directory
                        # deep link, not a bucket payload.
                    },
                },
            }
        )


# ---------- Panel 3 — Sex-ratio / demographic risk ----------

# BA review missing-panel #2. Flag a population as at-risk if:
#   - skew worse than 1:4 in either direction (after ignoring unsexed), OR
#   - unsexed fraction exceeds 50% of a known total
# Both thresholds are coordinator-intuition defaults; tunable if ABQ feedback
# says they're noisy. #.#.# display convention is males.females.unsexed.
SEX_RATIO_MAX_SKEW = 4.0
UNSEXED_FRACTION_THRESHOLD = 0.5


def _mfu_string(m: int | None, f: int | None, u: int | None) -> str:
    return f"{m or 0}.{f or 0}.{u or 0}"


def _demographic_risk_reasons(m: int | None, f: int | None, u: int | None) -> list[str]:
    reasons: list[str] = []
    males = m or 0
    females = f or 0
    unsexed = u or 0
    total = males + females + unsexed
    if total == 0:
        return reasons

    if males == 0 and females > 0:
        reasons.append("no_males")
    elif females == 0 and males > 0:
        reasons.append("no_females")
    elif males > 0 and females > 0:
        ratio = max(males, females) / min(males, females)
        if ratio > SEX_RATIO_MAX_SKEW:
            reasons.append("skewed_ratio")

    if unsexed / total > UNSEXED_FRACTION_THRESHOLD:
        reasons.append("mostly_unsexed")

    return reasons


class SexRatioRiskView(APIView):
    """Populations where demographic composition is functionally at-risk."""

    permission_classes = [TierOrServiceTokenPermission(3, "COORDINATOR_API_TOKEN")]

    def get(self, request: Request) -> Response:
        populations = ExSituPopulation.objects.select_related("species", "institution").only(
            "id",
            "species_id",
            "institution_id",
            "count_male",
            "count_female",
            "count_unsexed",
            "count_total",
            "species__scientific_name",
            "institution__name",
        )

        results: list[dict[str, object]] = []
        total_populations = 0
        for pop in populations:
            total_populations += 1
            reasons = _demographic_risk_reasons(pop.count_male, pop.count_female, pop.count_unsexed)
            if not reasons:
                continue
            results.append(
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
                    "mfu": _mfu_string(pop.count_male, pop.count_female, pop.count_unsexed),
                    "count_total": pop.count_total,
                    "risk_reasons": reasons,
                }
            )

        results.sort(
            key=lambda r: (
                -len(r["risk_reasons"]),  # type: ignore[arg-type]
                str(r["species"]["scientific_name"]),  # type: ignore[index]
            )
        )

        return Response(
            {
                "total_populations": total_populations,
                "total_at_risk": len(results),
                "thresholds": {
                    "max_skew_ratio": SEX_RATIO_MAX_SKEW,
                    "unsexed_fraction_threshold": UNSEXED_FRACTION_THRESHOLD,
                },
                "results": results,
            }
        )


# ---------- Panel 5 — Transfer activity ----------

# Window for "recent" transfers surfaced on the dashboard. Coordinator-scale
# cadence: quarterly working groups, so 90 days gives plenty of room to
# catch movement between meetings without flooding the panel.
TRANSFER_ACTIVITY_WINDOW_DAYS = 90

# Statuses that count as "in motion right now" — always shown regardless of
# date, so stuck permits and overdue handovers stay visible past the window.
_TRANSFER_IN_FLIGHT = [
    Transfer.Status.PROPOSED,
    Transfer.Status.APPROVED,
    Transfer.Status.IN_TRANSIT,
]


def _serialize_transfer(t: Transfer) -> dict[str, object]:
    return {
        "transfer_id": t.id,
        "species": {
            "id": t.species_id,
            "scientific_name": t.species.scientific_name,
        },
        "source_institution": {
            "id": t.source_institution_id,
            "name": t.source_institution.name,
        },
        "destination_institution": {
            "id": t.destination_institution_id,
            "name": t.destination_institution.name,
        },
        "status": t.status,
        "proposed_date": t.proposed_date.isoformat() if t.proposed_date else None,
        "planned_date": t.planned_date.isoformat() if t.planned_date else None,
        "actual_date": t.actual_date.isoformat() if t.actual_date else None,
        "count_male": t.count_male,
        "count_female": t.count_female,
        "count_unsexed": t.count_unsexed,
        "cites_reference": t.cites_reference or None,
        "coordinated_program_id": t.coordinated_program_id,
    }


class TransferActivityView(APIView):
    """Transfer lifecycle panel for the coordinator dashboard.

    Returns two lists:
    - ``in_flight``: every transfer currently in proposed / approved /
      in_transit, regardless of date. Stuck permits or overdue handovers
      stay visible here until someone resolves them.
    - ``recent_completed``: transfers with status=completed whose
      ``actual_date`` falls within the last 90 days. Bounded so the
      panel doesn't turn into a full history log.
    """

    permission_classes = [TierOrServiceTokenPermission(3, "COORDINATOR_API_TOKEN")]

    def get(self, request: Request) -> Response:
        today = timezone.now().date()
        window_start = today - timedelta(days=TRANSFER_ACTIVITY_WINDOW_DAYS)

        base = Transfer.objects.select_related(
            "species",
            "source_institution",
            "destination_institution",
        ).only(
            "id",
            "species_id",
            "source_institution_id",
            "destination_institution_id",
            "status",
            "proposed_date",
            "planned_date",
            "actual_date",
            "count_male",
            "count_female",
            "count_unsexed",
            "cites_reference",
            "coordinated_program_id",
            "species__scientific_name",
            "source_institution__name",
            "destination_institution__name",
        )

        in_flight_qs = base.filter(status__in=_TRANSFER_IN_FLIGHT).order_by("proposed_date")
        recent_qs = base.filter(
            status=Transfer.Status.COMPLETED, actual_date__gte=window_start
        ).order_by("-actual_date")

        return Response(
            {
                "window_days": TRANSFER_ACTIVITY_WINDOW_DAYS,
                "reference_date": today.isoformat(),
                "in_flight_count": in_flight_qs.count(),
                "recent_completed_count": recent_qs.count(),
                "in_flight": [_serialize_transfer(t) for t in in_flight_qs],
                "recent_completed": [_serialize_transfer(t) for t in recent_qs],
            }
        )
