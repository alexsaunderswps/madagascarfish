from __future__ import annotations

from django.core.cache import cache
from django.db.models import Count
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from fieldwork.models import FieldProgram
from populations.models import ExSituPopulation, Institution
from species.models import Species

DASHBOARD_CACHE_KEY = "api:dashboard:v1"
DASHBOARD_CACHE_TTL = 300  # 5 minutes

_THREATENED_STATUSES = [
    Species.IUCNStatus.CR,
    Species.IUCNStatus.EN,
    Species.IUCNStatus.VU,
]


class DashboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        data = cache.get(DASHBOARD_CACHE_KEY)
        if data is not None:
            return Response(data)

        data = self._build_dashboard()
        cache.set(DASHBOARD_CACHE_KEY, data, DASHBOARD_CACHE_TTL)
        return Response(data)

    def _build_dashboard(self) -> dict:
        # Species counts — single aggregation instead of per-status loop
        total_species = Species.objects.count()
        described = Species.objects.filter(
            taxonomic_status=Species.TaxonomicStatus.DESCRIBED
        ).count()

        iucn_counts = {choice: 0 for choice, _ in Species.IUCNStatus.choices}
        rows = Species.objects.values("iucn_status").annotate(c=Count("id"))
        for row in rows:
            key = row["iucn_status"] or Species.IUCNStatus.NE
            iucn_counts[key] = iucn_counts.get(key, 0) + row["c"]

        # Ex-situ coverage
        threatened_total = Species.objects.filter(
            iucn_status__in=_THREATENED_STATUSES
        ).count()
        threatened_with_captive = (
            Species.objects.filter(iucn_status__in=_THREATENED_STATUSES)
            .filter(ex_situ_populations__isnull=False)
            .distinct()
            .count()
        )

        # Field programs — single aggregation
        fp_counts = dict(
            FieldProgram.objects.values_list("status")
            .annotate(c=Count("id"))
            .values_list("status", "c")
        )

        return {
            "species_counts": {
                "total": total_species,
                "described": described,
                "undescribed": total_species - described,
                "by_iucn_status": iucn_counts,
            },
            "ex_situ_coverage": {
                "threatened_species_total": threatened_total,
                "threatened_species_with_captive_population": threatened_with_captive,
                "threatened_species_without_captive_population": threatened_total - threatened_with_captive,
                "institutions_active": Institution.objects.filter(
                    ex_situ_populations__isnull=False
                )
                .distinct()
                .count(),
                "total_populations_tracked": ExSituPopulation.objects.count(),
            },
            "field_programs": {
                "active": fp_counts.get(FieldProgram.Status.ACTIVE, 0),
                "planned": fp_counts.get(FieldProgram.Status.PLANNED, 0),
                "completed": fp_counts.get(FieldProgram.Status.COMPLETED, 0),
            },
            "last_updated": timezone.now().isoformat(),
        }
