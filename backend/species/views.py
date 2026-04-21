from __future__ import annotations

from django.db.models import Case, Count, Exists, IntegerField, OuterRef, Q, QuerySet, Subquery, When
from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from config.pagination import SpeciesListPagination
from populations.models import ExSituPopulation
from species.models import Species, SpeciesLocality
from species.serializers import SpeciesDetailSerializer, SpeciesListSerializer


class SpeciesFilter(filters.FilterSet):
    taxonomic_status = filters.CharFilter(field_name="taxonomic_status")
    # "NE" in the filter value is treated as "not yet assessed" per the mirror
    # policy (CLAUDE.md) and matches both iucn_status='NE' and iucn_status IS
    # NULL. This mirrors the dashboard chart's coalesce in views_dashboard.py
    # so a click from the NE bar returns the same row set the bar counted.
    iucn_status = filters.BaseCSVFilter(method="filter_iucn_status")
    family = filters.CharFilter(field_name="family")
    cares_status = filters.CharFilter(field_name="cares_status")
    # S19: Directory filter rail uses a single CARES boolean — "has any CARES
    # listing" — rather than a four-tier chip set, so the rail stays short.
    # ?has_cares=true narrows to species with any non-empty cares_status.
    has_cares = filters.BooleanFilter(method="filter_has_cares")
    endemic_status = filters.CharFilter(field_name="endemic_status")
    # S19: Directory filter rail exposes a SHOAL priority toggle. Backend
    # boolean filter so ?shoal_priority=true narrows to the subset.
    shoal_priority = filters.BooleanFilter(field_name="shoal_priority")
    has_captive_population = filters.BooleanFilter(method="filter_has_captive_population")
    # Introduced (exotic) species are hidden from the default public directory
    # so the list reads as "Madagascar's native fish fauna" rather than mixing
    # invasives like Oreochromis spp. alongside endemics. Set
    # include_introduced=true to surface them, or filter endemic_status
    # explicitly — either path opts out of the default exclusion.
    include_introduced = filters.BooleanFilter(method="filter_include_introduced")
    # Genus filter keyed on the FK's canonical name. The legacy string column
    # is still respected when the FK lookup returns no match so API clients
    # that predate Gate 1 keep working through the release window.
    genus = filters.CharFilter(method="filter_genus")

    class Meta:
        model = Species
        fields = [
            "taxonomic_status",
            "iucn_status",
            "family",
            "cares_status",
            "has_cares",
            "endemic_status",
            "shoal_priority",
            "has_captive_population",
            "include_introduced",
            "genus",
        ]

    def filter_iucn_status(
        self,
        queryset: QuerySet[Species],
        name: str,
        value: list[str] | None,
    ) -> QuerySet[Species]:
        if not value:
            return queryset
        codes = [v for v in value if v]
        if not codes:
            return queryset
        q = Q(iucn_status__in=codes)
        if Species.IUCNStatus.NE in codes:
            q |= Q(iucn_status__isnull=True)
        return queryset.filter(q)

    def filter_has_cares(
        self,
        queryset: QuerySet[Species],
        name: str,
        value: bool | None,
    ) -> QuerySet[Species]:
        if value is None:
            return queryset
        if value:
            return queryset.exclude(cares_status="").exclude(cares_status__isnull=True)
        return queryset.filter(Q(cares_status="") | Q(cares_status__isnull=True))

    def filter_has_captive_population(
        self,
        queryset: QuerySet[Species],
        name: str,
        value: bool | None,
    ) -> QuerySet[Species]:
        if value is None:
            return queryset
        has_pop = Exists(ExSituPopulation.objects.filter(species=OuterRef("pk")))
        annotated = queryset.annotate(_has_captive_population=has_pop)
        return annotated.filter(_has_captive_population=value)

    def filter_genus(
        self,
        queryset: QuerySet[Species],
        name: str,
        value: str | None,
    ) -> QuerySet[Species]:
        if not value:
            return queryset
        return queryset.filter(Q(genus_fk__name=value) | Q(genus=value))

    def filter_include_introduced(
        self,
        queryset: QuerySet[Species],
        name: str,
        value: bool | None,
    ) -> QuerySet[Species]:
        # value=True: no-op, show everything (caller opted in).
        # value=False or missing: exclude introduced. The FilterSet's default
        # flow only calls this method when the param is present, so the
        # actual default-exclusion is applied in get_queryset via the same path.
        if value is True:
            return queryset
        return queryset.exclude(endemic_status=Species.EndemicStatus.INTRODUCED)


class SpeciesViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    pagination_class = SpeciesListPagination
    filterset_class = SpeciesFilter
    search_fields = ["scientific_name", "provisional_name", "common_names__name"]
    ordering_fields = ["scientific_name", "iucn_status", "family"]
    ordering = ["scientific_name"]

    def get_queryset(self):
        # primary_basin: drainage basin of the species' preferred locality —
        # type_locality wins when present, otherwise earliest by id. Rows
        # without any basin-bearing locality get NULL.
        primary_basin_sq = (
            SpeciesLocality.objects.filter(species=OuterRef("pk"))
            .exclude(drainage_basin_name="")
            .annotate(
                _type_rank=Case(
                    When(locality_type=SpeciesLocality.LocalityType.TYPE_LOCALITY, then=0),
                    default=1,
                    output_field=IntegerField(),
                )
            )
            .order_by("_type_rank", "id")
            .values("drainage_basin_name")[:1]
        )
        qs = (
            Species.objects.select_related("genus_fk")
            .annotate(
                locality_count=Count("localities", distinct=True),
                primary_basin=Subquery(primary_basin_sq),
            )
            .order_by("scientific_name")
        )
        # Default to hiding introduced species from list/retrieve unless the
        # caller passes include_introduced=true or explicitly filters
        # endemic_status. Retrieve-by-id is still allowed for any species —
        # skip the exclusion there so direct profile links keep working.
        if self.action == "list":
            request = getattr(self, "request", None)
            params = request.GET if request is not None else {}
            include_introduced = str(params.get("include_introduced", "")).lower() in (
                "true",
                "1",
                "yes",
            )
            endemic_status_filter = params.get("endemic_status")
            if not include_introduced and not endemic_status_filter:
                qs = qs.exclude(endemic_status=Species.EndemicStatus.INTRODUCED)
        if self.action == "retrieve":
            # Detail view uses conservation_assessments, field_programs via SerializerMethodField;
            # ex_situ_summary fires a separate aggregate query (unavoidable).
            return qs.prefetch_related(
                "common_names",
                "conservation_assessments",
                "field_programs",
            )
        return qs.prefetch_related("common_names")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SpeciesDetailSerializer
        return SpeciesListSerializer
