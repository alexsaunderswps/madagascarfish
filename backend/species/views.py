from __future__ import annotations

from django.db.models import Exists, OuterRef, QuerySet
from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from config.pagination import SpeciesListPagination
from populations.models import ExSituPopulation
from species.models import Species
from species.serializers import SpeciesDetailSerializer, SpeciesListSerializer


class SpeciesFilter(filters.FilterSet):
    taxonomic_status = filters.CharFilter(field_name="taxonomic_status")
    iucn_status = filters.BaseInFilter(field_name="iucn_status", lookup_expr="in")
    family = filters.CharFilter(field_name="family")
    cares_status = filters.CharFilter(field_name="cares_status")
    endemic_status = filters.CharFilter(field_name="endemic_status")
    has_captive_population = filters.BooleanFilter(
        method="filter_has_captive_population"
    )

    class Meta:
        model = Species
        fields = [
            "taxonomic_status",
            "iucn_status",
            "family",
            "cares_status",
            "endemic_status",
            "has_captive_population",
        ]

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


class SpeciesViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    pagination_class = SpeciesListPagination
    filterset_class = SpeciesFilter
    search_fields = ["scientific_name", "provisional_name", "common_names__name"]
    ordering_fields = ["scientific_name", "iucn_status", "family"]
    ordering = ["scientific_name"]

    def get_queryset(self):
        qs = Species.objects.order_by("scientific_name")
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
