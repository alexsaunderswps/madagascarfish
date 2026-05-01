"""Aggregate panel for the institution dashboard.

One endpoint — ``/api/v1/institution-summary/`` — returns the panel data
for the requesting user's institution: top-line counts, per-species
share of the global captive population, recent breeding-event activity,
and census-freshness rollup.

Permission shape: Tier 2+ users see their own institution's summary;
Tier 3+ coordinators view their own institution's summary by default
and can pass ``?institution_id=N`` to inspect any institution's panel.
Anonymous and Tier 1 users are rejected.

The motivating use case is the "feel part of something bigger" loop —
keepers see immediately what their institution contributes to global
captive holdings of each species they manage. Per Gate 13 BA Open
Question 2 and architecture §12.1.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TypedDict

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from populations.models import BreedingEvent, ExSituPopulation, Institution

# Census-freshness threshold matches the coordinator dashboard's
# stale-census panel for consistency.
FRESH_CENSUS_THRESHOLD_DAYS = 365
RECENT_EVENTS_THRESHOLD_DAYS = 365


class InstitutionBrief(TypedDict):
    id: int
    name: str


class TotalsBlock(TypedDict):
    populations: int
    species: int
    breeding_events_last_12_months: int
    fresh_census_count: int
    stale_census_count: int


class SpeciesBriefAgg(TypedDict):
    id: int
    scientific_name: str
    iucn_status: str | None


class SpeciesBreakdownRow(TypedDict):
    species: SpeciesBriefAgg
    this_institution_count: int
    global_count: int
    share_pct: float
    institutions_holding: int
    recent_breeding_events: int


class InstitutionSummary(TypedDict):
    institution: InstitutionBrief
    totals: TotalsBlock
    species_breakdown: list[SpeciesBreakdownRow]


def _resolve_institution(request: Request) -> Institution:
    """Resolve which institution the caller wants summary for.

    Tier 2: locked to the user's institution. ``?institution_id=N``
    that doesn't match returns 403.
    Tier 3+: free-form via ``?institution_id=N``; defaults to the
    coordinator's own institution if not provided. If neither the
    coordinator nor the query carry an institution, 404.
    """
    user = request.user
    tier = int(getattr(user, "access_tier", 0))
    user_institution_id = getattr(user, "institution_id", None)
    requested_id_raw = request.query_params.get("institution_id")
    requested_id: int | None = None
    if requested_id_raw is not None:
        try:
            requested_id = int(requested_id_raw)
        except ValueError:
            raise NotFound("Invalid institution_id.") from None

    if tier >= 3:
        target_id = requested_id if requested_id is not None else user_institution_id
        if target_id is None:
            raise NotFound("No institution to summarize. Pass ?institution_id=N.")
        try:
            return Institution.objects.get(pk=target_id)
        except Institution.DoesNotExist as e:
            raise NotFound("Institution not found.") from e

    # Tier 2: must have an approved institution; ?institution_id, if
    # present, must match.
    if user_institution_id is None:
        raise PermissionDenied("An approved institution membership is required to view this panel.")
    if requested_id is not None and requested_id != user_institution_id:
        raise PermissionDenied("Tier 2 users can only view their own institution's summary.")
    try:
        return Institution.objects.get(pk=user_institution_id)
    except Institution.DoesNotExist as e:
        raise NotFound("Institution not found.") from e


def _build_summary(institution: Institution) -> InstitutionSummary:
    """Compute the panel's aggregates in a small fixed number of queries."""
    today = timezone.now().date()
    fresh_threshold = today - timedelta(days=FRESH_CENSUS_THRESHOLD_DAYS)
    events_window_start = timezone.now() - timedelta(days=RECENT_EVENTS_THRESHOLD_DAYS)

    own_populations = (
        ExSituPopulation.objects.filter(institution=institution)
        .select_related("species")
        .annotate(
            recent_event_count=Count(
                "breeding_events",
                filter=Q(breeding_events__event_date__gte=events_window_start.date()),
            )
        )
    )

    own_species_ids = list(own_populations.values_list("species_id", flat=True).distinct())

    # Census-freshness rollup. NULL last_census_date counts as stale.
    fresh_count = own_populations.filter(last_census_date__gte=fresh_threshold).count()
    populations_count = own_populations.count()
    stale_count = populations_count - fresh_count

    # Recent breeding events at this institution.
    recent_events_at_institution = BreedingEvent.objects.filter(
        population__institution=institution,
        event_date__gte=events_window_start.date(),
    ).count()

    # Global aggregates per species (across ALL institutions, not just this one).
    global_aggs = (
        ExSituPopulation.objects.filter(species_id__in=own_species_ids)
        .values("species_id")
        .annotate(
            global_count=Sum("count_total"),
            institutions_holding=Count("institution_id", distinct=True),
        )
    )
    global_by_species: dict[int, dict[str, int | None]] = {
        row["species_id"]: {
            "global_count": int(row["global_count"] or 0),
            "institutions_holding": int(row["institutions_holding"] or 0),
        }
        for row in global_aggs
    }

    # Recent breeding events per species globally (filter by the species
    # set this institution holds).
    species_recent_events = (
        BreedingEvent.objects.filter(
            population__species_id__in=own_species_ids,
            event_date__gte=events_window_start.date(),
        )
        .values("population__species_id")
        .annotate(recent_count=Count("id"))
    )
    recent_by_species: dict[int, int] = {
        row["population__species_id"]: int(row["recent_count"]) for row in species_recent_events
    }

    # Per-species breakdown rows. Sort by share descending so the
    # institution's biggest contributions surface first.
    breakdown: list[SpeciesBreakdownRow] = []
    for pop in own_populations:
        species = pop.species
        own_count = int(pop.count_total or 0)
        agg = global_by_species.get(species.id, {})
        global_count = int(agg.get("global_count") or 0)
        institutions_holding = int(agg.get("institutions_holding") or 0)
        share_pct = (own_count / global_count * 100) if global_count else 0.0
        breakdown.append(
            {
                "species": {
                    "id": species.id,
                    "scientific_name": species.scientific_name,
                    "iucn_status": species.iucn_status,
                },
                "this_institution_count": own_count,
                "global_count": global_count,
                "share_pct": round(share_pct, 1),
                "institutions_holding": institutions_holding,
                "recent_breeding_events": recent_by_species.get(species.id, 0),
            }
        )
    breakdown.sort(key=lambda r: r["share_pct"], reverse=True)

    return {
        "institution": {"id": institution.pk, "name": institution.name},
        "totals": {
            "populations": populations_count,
            "species": len(own_species_ids),
            "breeding_events_last_12_months": recent_events_at_institution,
            "fresh_census_count": fresh_count,
            "stale_census_count": stale_count,
        },
        "species_breakdown": breakdown,
    }


class InstitutionSummaryView(APIView):
    """Aggregate panel for the institution dashboard.

    GET /api/v1/institution-summary/[?institution_id=N]

    Tier 2+: required. Tier 2 users see their own institution; the
    optional ``institution_id`` query param must match. Tier 3+ users
    can pass any ``institution_id``; defaults to the coordinator's own
    institution if not provided.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        institution = _resolve_institution(request)
        return Response(_build_summary(institution))
