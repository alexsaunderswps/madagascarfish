from __future__ import annotations

from rest_framework import serializers

from accounts.serializer_mixins import TierAwareSerializerMixin
from populations.models import ExSituPopulation, HoldingRecord, Institution


class InstitutionListSerializer(serializers.ModelSerializer):
    """Public fields only — contact_email hidden for Tier 1-2."""

    class Meta:
        model = Institution
        fields = [
            "id",
            "name",
            "institution_type",
            "country",
            "city",
            "website",
        ]


class InstitutionDetailSerializer(TierAwareSerializerMixin, serializers.ModelSerializer):
    """Tier-aware: includes contact_email and species360_id for Tier 3+."""

    class Meta:
        model = Institution
        fields = [
            "id",
            "name",
            "institution_type",
            "country",
            "city",
            "website",
            "zims_member",
            "eaza_member",
            "aza_member",
            "contact_email",
            "species360_id",
        ]

    def to_representation(self, instance: Institution) -> dict:
        data = super().to_representation(instance)
        tier = self._get_tier()
        if tier < 3:
            data.pop("contact_email", None)
            data.pop("species360_id", None)
        return data


class _SpeciesBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    scientific_name = serializers.CharField()


class _InstitutionBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    country = serializers.CharField()


class HoldingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = HoldingRecord
        fields = ["date", "count_total", "count_male", "count_female", "count_unsexed", "notes"]


class ExSituPopulationListSerializer(serializers.ModelSerializer):
    species = _SpeciesBriefSerializer(read_only=True)
    institution = _InstitutionBriefSerializer(read_only=True)

    class Meta:
        model = ExSituPopulation
        fields = [
            "id",
            "species",
            "institution",
            "count_total",
            "count_male",
            "count_female",
            "count_unsexed",
            "breeding_status",
            "studbook_managed",
            "last_census_date",
        ]


class ExSituPopulationDetailSerializer(ExSituPopulationListSerializer):
    holding_records = HoldingRecordSerializer(many=True, read_only=True)

    class Meta(ExSituPopulationListSerializer.Meta):
        fields = [*ExSituPopulationListSerializer.Meta.fields, "holding_records"]
