from __future__ import annotations

from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from species.models import SpeciesLocality, Watershed


class SpeciesLocalityGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer with tier-aware coordinate selection.

    Serves location_generalized for is_sensitive=True records (public),
    exact location for non-sensitive records.
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
        """Swap geometry to generalized coordinates for sensitive records.

        If is_sensitive=True but location_generalized is NULL (e.g. bulk update
        bypassed save()), serve null geometry rather than leaking exact coords.
        """
        original_location = instance.location
        if instance.is_sensitive:
            if instance.location_generalized:
                instance.location = instance.location_generalized
            else:
                instance.location = None
        try:
            ret = super().to_representation(instance)
        finally:
            instance.location = original_location
        return ret


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
