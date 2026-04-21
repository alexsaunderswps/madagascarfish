from __future__ import annotations

from django.db import models as db_models
from rest_framework import serializers

from accounts.serializer_mixins import TierAwareSerializerMixin
from species.models import CommonName, ConservationAssessment, Genus, Species


class GenusBriefSerializer(serializers.ModelSerializer):
    """Compact genus representation embedded on Species payloads. Signals
    whether a fallback silhouette exists so the frontend cascade can decide
    whether to fetch the SVG body from the dedicated genus endpoint."""

    has_silhouette = serializers.SerializerMethodField()

    class Meta:
        model = Genus
        fields = ["name", "has_silhouette"]

    def get_has_silhouette(self, obj: Genus) -> bool:
        return bool(obj.silhouette_svg)


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
    genus_fk = GenusBriefSerializer(read_only=True)
    # Both fields are populated by annotations on SpeciesViewSet.get_queryset
    # so list rendering stays O(1) per row. See docs/planning/
    # registry-redesign/gate-1-visual-system.md (S17).
    primary_basin = serializers.CharField(
        read_only=True, allow_null=True, default=None
    )
    locality_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Species
        fields = [
            "id",
            "scientific_name",
            "taxonomic_status",
            "provisional_name",
            "family",
            "genus",
            "genus_fk",
            "endemic_status",
            "iucn_status",
            "cares_status",
            "shoal_priority",
            "common_names",
            "primary_basin",
            "locality_count",
        ]


class _FieldProgramBriefSerializer(serializers.Serializer):
    """Inline representation for species detail — avoids circular import."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    status = serializers.CharField()


class SpeciesDetailSerializer(TierAwareSerializerMixin, serializers.ModelSerializer):
    common_names = CommonNameSerializer(many=True, read_only=True)
    genus_fk = GenusBriefSerializer(read_only=True)
    conservation_assessments = serializers.SerializerMethodField()
    field_programs = serializers.SerializerMethodField()
    ex_situ_summary = serializers.SerializerMethodField()
    has_localities = serializers.SerializerMethodField()
    has_husbandry = serializers.SerializerMethodField()
    difficulty_factor_count = serializers.SerializerMethodField()
    # Populated by the SpeciesViewSet queryset annotation (same Subquery used
    # on the list endpoint). NULL when no locality carries a basin name.
    primary_basin = serializers.CharField(
        read_only=True, allow_null=True, default=None
    )

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
            "genus_fk",
            "endemic_status",
            "iucn_status",
            "cares_status",
            "shoal_priority",
            "description",
            "ecology_notes",
            "distribution_narrative",
            "morphology",
            "max_length_cm",
            "silhouette_svg",
            "habitat_type",
            "iucn_taxon_id",
            "common_names",
            "conservation_assessments",
            "field_programs",
            "ex_situ_summary",
            "has_localities",
            "has_husbandry",
            "difficulty_factor_count",
            "primary_basin",
        ]

    def get_has_localities(self, obj: Species) -> bool:
        return obj.localities.exists()

    def get_has_husbandry(self, obj: Species) -> bool:
        # Tier 1 shape: boolean only, derived from presence of a PUBLISHED
        # SpeciesHusbandry row. Drafts must not flip this true (AC-08.5).
        # Local import keeps the species app independent of husbandry at
        # module-load time.
        from husbandry.models import SpeciesHusbandry

        return SpeciesHusbandry.objects.filter(species_id=obj.pk, published=True).exists()

    def get_difficulty_factor_count(self, obj: Species) -> int:
        # Count of populated Difficulty Factor fields on the published husbandry
        # record — surfaces "this species has N specialized considerations"
        # without shipping the full record. Profile-page callout threshold
        # lives on the FE (UX review 2026-04-19, Option A).
        from husbandry.models import SpeciesHusbandry

        h = (
            SpeciesHusbandry.objects.filter(species_id=obj.pk, published=True)
            .only(
                "difficulty_adult_size",
                "difficulty_space_demand",
                "difficulty_temperament_challenge",
                "difficulty_water_parameter_demand",
                "difficulty_dietary_specialization",
                "difficulty_breeding_complexity",
                "difficulty_other",
            )
            .first()
        )
        if h is None:
            return 0
        fields = (
            h.difficulty_adult_size,
            h.difficulty_space_demand,
            h.difficulty_temperament_challenge,
            h.difficulty_water_parameter_demand,
            h.difficulty_dietary_specialization,
            h.difficulty_breeding_complexity,
            h.difficulty_other,
        )
        return sum(1 for v in fields if v and v.strip())

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
