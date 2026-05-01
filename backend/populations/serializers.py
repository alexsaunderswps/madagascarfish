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
        fields = [
            *ExSituPopulationListSerializer.Meta.fields,
            "holding_records",
            "notes",
            "last_edited_at",
            "updated_at",
        ]


class ExSituPopulationWriteSerializer(serializers.ModelSerializer):
    """Tier-2 institution-scoped edit surface.

    Restricted to the eight AUDITED_FIELDS per Gate 13 §Data Model. Other
    fields are read-only — `species`, `institution`, `date_established`,
    `founding_source`, plus the audit-attribution columns are not editable
    via this surface.
    """

    # Cap notes at the serializer layer — model is `TextField` (unbounded).
    # Defends against payload bloat / audit-log inflation from a Tier 2
    # writer.
    notes = serializers.CharField(max_length=10_000, allow_blank=True, required=False)

    class Meta:
        model = ExSituPopulation
        fields = [
            "count_total",
            "count_male",
            "count_female",
            "count_unsexed",
            "breeding_status",
            "last_census_date",
            "notes",
            "studbook_managed",
        ]
