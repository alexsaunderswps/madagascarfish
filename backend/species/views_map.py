from __future__ import annotations

from django.contrib.gis.geos import Polygon
from django.core.cache import cache
from django.db.models import Count
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from species.models import Species, SpeciesLocality, Watershed
from species.serializers_map import (
    SpeciesLocalityGeoSerializer,
    WatershedListSerializer,
)

MAP_SUMMARY_CACHE_KEY = "api:map:summary:v1"
MAP_CACHE_TTL = 300  # 5 minutes


class SpeciesLocalityGeoView(APIView):
    """GeoJSON FeatureCollection of species localities with filtering."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        qs = SpeciesLocality.objects.select_related("species")

        # Apply filters — validate numeric params to prevent 500 on bad input
        species_id = request.query_params.get("species_id")
        if species_id:
            try:
                qs = qs.filter(species_id=int(species_id))
            except (ValueError, TypeError):
                pass  # Invalid ID — return unfiltered rather than 500

        family = request.query_params.get("family")
        if family:
            qs = qs.filter(species__family=family)

        iucn_status = request.query_params.get("iucn_status")
        if iucn_status:
            qs = qs.filter(species__iucn_status=iucn_status)

        watershed_id = request.query_params.get("watershed_id")
        if watershed_id:
            try:
                qs = qs.filter(drainage_basin_id=int(watershed_id))
            except (ValueError, TypeError):
                pass

        locality_type = request.query_params.get("locality_type")
        if locality_type:
            qs = qs.filter(locality_type=locality_type)

        presence_status = request.query_params.get("presence_status")
        if presence_status:
            qs = qs.filter(presence_status=presence_status)

        coordinate_precision = request.query_params.get("coordinate_precision")
        if coordinate_precision:
            qs = qs.filter(coordinate_precision=coordinate_precision)

        bbox = request.query_params.get("bbox")
        if bbox:
            try:
                parts = [float(x) for x in bbox.split(",")]
                if len(parts) == 4:
                    min_lng, min_lat, max_lng, max_lat = parts
                    geom = Polygon.from_bbox((min_lng, min_lat, max_lng, max_lat))
                    geom.srid = 4326
                    qs = qs.filter(location__within=geom)
            except (ValueError, TypeError):
                pass  # Ignore malformed bbox

        serializer = SpeciesLocalityGeoSerializer(qs, many=True)
        return Response(serializer.data)


class WatershedListView(APIView):
    """Watershed list with species counts (no geometry)."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        qs = Watershed.objects.annotate(
            species_count=Count("localities__species", distinct=True)
        ).order_by("name")
        serializer = WatershedListSerializer(qs, many=True)
        return Response(serializer.data)


class MapSummaryView(APIView):
    """Aggregate map statistics, cached."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        data = cache.get(MAP_SUMMARY_CACHE_KEY)
        if data is not None:
            return Response(data)

        data = self._build_summary()
        cache.set(MAP_SUMMARY_CACHE_KEY, data, MAP_CACHE_TTL)
        return Response(data)

    def _build_summary(self) -> dict:
        total_localities = SpeciesLocality.objects.count()
        species_with = SpeciesLocality.objects.values("species").distinct().count()
        total_species = Species.objects.count()
        watersheds_represented = (
            SpeciesLocality.objects.exclude(drainage_basin__isnull=True)
            .values("drainage_basin")
            .distinct()
            .count()
        )

        # Locality type counts
        type_qs = SpeciesLocality.objects.values("locality_type").annotate(c=Count("id")).order_by()
        locality_type_counts = {row["locality_type"]: row["c"] for row in type_qs}

        # Presence status counts
        status_qs = (
            SpeciesLocality.objects.values("presence_status").annotate(c=Count("id")).order_by()
        )
        presence_status_counts = {row["presence_status"]: row["c"] for row in status_qs}

        return {
            "total_localities": total_localities,
            "species_with_localities": species_with,
            "species_without_localities": total_species - species_with,
            "watersheds_represented": watersheds_represented,
            "locality_type_counts": locality_type_counts,
            "presence_status_counts": presence_status_counts,
        }
