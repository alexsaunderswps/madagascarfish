from __future__ import annotations

from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from accounts.permissions import TierPermission
from populations.models import ExSituPopulation, Institution
from populations.serializers import (
    ExSituPopulationDetailSerializer,
    ExSituPopulationListSerializer,
    InstitutionDetailSerializer,
    InstitutionListSerializer,
)


class InstitutionFilter(filters.FilterSet):
    institution_type = filters.CharFilter(field_name="institution_type")
    country = filters.CharFilter(field_name="country")

    class Meta:
        model = Institution
        fields = ["institution_type", "country"]


class InstitutionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    queryset = Institution.objects.all()
    filterset_class = InstitutionFilter
    search_fields = ["name", "city"]
    ordering = ["name"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return InstitutionDetailSerializer
        return InstitutionListSerializer


class ExSituPopulationFilter(filters.FilterSet):
    species_id = filters.NumberFilter(field_name="species_id")
    institution_id = filters.NumberFilter(field_name="institution_id")
    breeding_status = filters.CharFilter(field_name="breeding_status")

    class Meta:
        model = ExSituPopulation
        fields = ["species_id", "institution_id", "breeding_status"]


class ExSituPopulationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [TierPermission(3)]
    filterset_class = ExSituPopulationFilter
    ordering = ["-last_census_date"]

    def get_queryset(self):
        tier = (
            getattr(self.request.user, "access_tier", 1)
            if self.request.user.is_authenticated
            else 1
        )
        return (
            ExSituPopulation.objects.for_tier(tier)
            .select_related("species", "institution")
            .prefetch_related("holding_records")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ExSituPopulationDetailSerializer
        return ExSituPopulationListSerializer
