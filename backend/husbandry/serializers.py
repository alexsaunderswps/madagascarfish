"""DRF serializers for the husbandry API.

Tier 1 public surface — no governance fields beyond `last_reviewed_by`
(username + ORCID), `last_reviewed_at`, and a computed `review_is_stale`.
`published` is NEVER exposed: absence of a published record surfaces as a
404, not `published: false` (AC-08.5).
"""

from __future__ import annotations

from rest_framework import serializers

from husbandry.models import HusbandrySource, SpeciesHusbandry


class HusbandrySourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = HusbandrySource
        fields = ["label", "url", "order"]


class ReviewerSerializer(serializers.Serializer):
    """Minimal reviewer surface — username (`name`) + ORCID if present."""

    name = serializers.CharField()
    orcid_id = serializers.CharField(allow_blank=True)


class SpeciesHusbandrySerializer(serializers.ModelSerializer):
    sources = HusbandrySourceSerializer(many=True, read_only=True)
    last_reviewed_by = serializers.SerializerMethodField()
    review_is_stale = serializers.BooleanField(read_only=True)

    class Meta:
        model = SpeciesHusbandry
        fields = [
            "species_id",
            # Water
            "water_temp_c_min",
            "water_temp_c_max",
            "water_ph_min",
            "water_ph_max",
            "water_hardness_dgh_min",
            "water_hardness_dgh_max",
            "water_hardness_dkh_min",
            "water_hardness_dkh_max",
            "water_flow",
            "water_notes",
            # Tank
            "tank_min_volume_liters",
            "tank_min_footprint_cm",
            "tank_aquascape",
            "tank_substrate",
            "tank_cover",
            "tank_notes",
            # Diet
            "diet_accepted_foods",
            "diet_live_food_required",
            "diet_feeding_frequency",
            "diet_notes",
            # Behavior
            "behavior_temperament",
            "behavior_recommended_sex_ratio",
            "behavior_schooling",
            "behavior_community_compatibility",
            "behavior_notes",
            # Breeding
            "breeding_spawning_mode",
            "breeding_triggers",
            "breeding_egg_count_typical",
            "breeding_fry_care",
            "breeding_survival_bottlenecks",
            "breeding_notes",
            # Difficulty factors
            "difficulty_adult_size",
            "difficulty_space_demand",
            "difficulty_temperament_challenge",
            "difficulty_water_parameter_demand",
            "difficulty_dietary_specialization",
            "difficulty_breeding_complexity",
            "difficulty_other",
            # Sourcing
            "sourcing_cares_registered_breeders",
            "sourcing_notes",
            # Narrative
            "narrative",
            # Governance (public-safe subset)
            "contributors",
            "last_reviewed_by",
            "last_reviewed_at",
            "review_is_stale",
            # Sources
            "sources",
        ]

    def get_last_reviewed_by(self, obj: SpeciesHusbandry) -> dict | None:
        reviewer = obj.last_reviewed_by
        if reviewer is None:
            return None
        return {
            "name": reviewer.name,
            "orcid_id": reviewer.orcid_id or "",
        }
