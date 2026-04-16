from __future__ import annotations

from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from config.pagination import SpeciesListPagination
from species.models import Species
from species.serializers import SpeciesDetailSerializer, SpeciesListSerializer


class SpeciesFilter(filters.FilterSet):
    taxonomic_status = filters.CharFilter(field_name="taxonomic_status")
    iucn_status = filters.CharFilter(field_name="iucn_status")
    family = filters.CharFilter(field_name="family")
    cares_status = filters.CharFilter(field_name="cares_status")
    endemic_status = filters.CharFilter(field_name="endemic_status")

    class Meta:
        model = Species
        fields = ["taxonomic_status", "iucn_status", "family", "cares_status", "endemic_status"]


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
