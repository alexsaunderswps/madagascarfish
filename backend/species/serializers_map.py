from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from species.models import SpeciesLocality, Watershed

# Coordinator tier — first rung at which users see exact coordinates for
# species flagged sensitive. Matches the public promise on /about/data/
# ("Exact coordinates for sensitive species are available to conservation
# coordinator accounts (Tier 3) and above") and the CLAUDE.md access matrix.
TIER_EXACT_COORDS = 3


def _request_sees_exact_coords(request: Request | None) -> bool:
    """True iff the requesting user is authenticated at Tier 3 or above.

    Anonymous and authentication-missing cases fall through to False so
    generalization is the default — never leak exact coordinates when we
    can't confirm the tier.
    """
    if request is None:
        return False
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    return getattr(user, "access_tier", 0) >= TIER_EXACT_COORDS


class SpeciesLocalityGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer with tier-aware coordinate generalization.

    Decision matrix served to the client:

    - Tier 3+ authenticated user → exact coordinates for every record.
    - Anyone else (anonymous, Tier 1-2) → exact coordinates for records
      whose ``effective_is_sensitive`` is False; 0.1°-generalized point
      for records where it is True.
    - If somehow a sensitive record is missing its precomputed generalized
      point (should not happen post-0019 backfill — kept as a belt-and-
      braces guard against bulk updates that bypass ``save()``) the
      geometry is served as ``null`` rather than leaking the exact point.
    """

    scientific_name = serializers.CharField(source="species.scientific_name", read_only=True)
    family = serializers.CharField(source="species.family", read_only=True)
    iucn_status = serializers.CharField(source="species.iucn_status", read_only=True)
    species_id = serializers.IntegerField(source="species.id", read_only=True)

    class Meta:
        model = SpeciesLocality
        geo_field = "location"
        fields = [
            "id",
            "species_id",
            "scientific_name",
            "family",
            "iucn_status",
            "locality_name",
            "locality_type",
            "presence_status",
            "water_body",
            "water_body_type",
            "drainage_basin_name",
            "year_collected",
            "coordinate_precision",
            "source_citation",
        ]

    def to_representation(self, instance: SpeciesLocality) -> dict:
        request = self.context.get("request")
        serve_exact = _request_sees_exact_coords(request)

        original_location = instance.location
        if not serve_exact and instance.effective_is_sensitive:
            # Below the Tier-3 gate and the species is sensitive — swap to
            # the precomputed generalized point, or None if that's missing.
            instance.location = instance.location_generalized or None
        try:
            return super().to_representation(instance)
        finally:
            instance.location = original_location


class WatershedListSerializer(serializers.ModelSerializer):
    species_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Watershed
        fields = ["id", "name", "pfafstetter_level", "area_sq_km", "species_count"]


class MapSummarySerializer(serializers.Serializer):
    total_localities = serializers.IntegerField()
    species_with_localities = serializers.IntegerField()
    species_without_localities = serializers.IntegerField()
    watersheds_represented = serializers.IntegerField()
    locality_type_counts = serializers.DictField(child=serializers.IntegerField())
    presence_status_counts = serializers.DictField(child=serializers.IntegerField())
