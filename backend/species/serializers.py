from __future__ import annotations

from django.db import models as db_models
from rest_framework import serializers

from accounts.serializer_mixins import TierAwareSerializerMixin
from species.models import CommonName, ConservationAssessment, Species


class CommonNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommonName
        fields = ["name", "language"]


class ConservationAssessmentPublicSerializer(serializers.ModelSerializer):
    """Tier 1-2: only accepted assessments, review_status/review_notes/flagged fields omitted."""

    class Meta:
        model = ConservationAssessment
        fields = [
            "category",
            "source",
            "assessment_date",
            "assessor",
            "criteria",
        ]


class ConservationAssessmentFullSerializer(serializers.ModelSerializer):
    """Tier 3+: all assessments with review fields."""

    class Meta:
        model = ConservationAssessment
        fields = [
            "category",
            "source",
            "assessment_date",
            "assessor",
            "criteria",
            "review_status",
            "review_notes",
            "flagged_by",
            "flagged_date",
        ]


class SpeciesListSerializer(serializers.ModelSerializer):
    common_names = CommonNameSerializer(many=True, read_only=True)

    class Meta:
        model = Species
        fields = [
            "id",
            "scientific_name",
            "taxonomic_status",
            "provisional_name",
            "family",
            "genus",
            "endemic_status",
            "iucn_status",
            "cares_status",
            "shoal_priority",
            "common_names",
        ]


class _FieldProgramBriefSerializer(serializers.Serializer):
    """Inline representation for species detail — avoids circular import."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    status = serializers.CharField()


class SpeciesDetailSerializer(TierAwareSerializerMixin, serializers.ModelSerializer):
    common_names = CommonNameSerializer(many=True, read_only=True)
    conservation_assessments = serializers.SerializerMethodField()
    field_programs = serializers.SerializerMethodField()
    ex_situ_summary = serializers.SerializerMethodField()

    class Meta:
        model = Species
        fields = [
            "id",
            "scientific_name",
            "taxonomic_status",
            "provisional_name",
            "authority",
            "year_described",
            "family",
            "genus",
            "endemic_status",
            "iucn_status",
            "cares_status",
            "shoal_priority",
            "description",
            "ecology_notes",
            "distribution_narrative",
            "morphology",
            "max_length_cm",
            "habitat_type",
            "iucn_taxon_id",
            "common_names",
            "conservation_assessments",
            "field_programs",
            "ex_situ_summary",
        ]

    def get_conservation_assessments(self, obj: Species) -> list[dict]:
        tier = self._get_tier()
        qs = obj.conservation_assessments.for_tier(tier)
        if tier < 3:
            return ConservationAssessmentPublicSerializer(qs, many=True).data
        return ConservationAssessmentFullSerializer(qs, many=True).data

    def get_field_programs(self, obj: Species) -> list[dict]:
        programs = obj.field_programs.only("id", "name", "status")
        return _FieldProgramBriefSerializer(programs, many=True).data

    def get_ex_situ_summary(self, obj: Species) -> dict:
        from django.db.models import Count, Sum

        from populations.models import ExSituPopulation

        qs = ExSituPopulation.objects.filter(species=obj)
        agg = qs.aggregate(
            institutions_holding=Count("institution", distinct=True),
            total_individuals=Sum("count_total"),
            breeding_programs=Count("pk", filter=db_models.Q(breeding_status="breeding")),
        )
        return {
            "institutions_holding": agg["institutions_holding"] or 0,
            "total_individuals": agg["total_individuals"] or 0,
            "breeding_programs": agg["breeding_programs"] or 0,
        }
