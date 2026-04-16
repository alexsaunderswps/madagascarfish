from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from typing import Any

from django.contrib.gis.gdal import DataSource
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from species.models import ProtectedArea, Watershed


class Command(BaseCommand):
    help = (
        "Load HydroBASINS watersheds and/or WDPA protected areas into PostGIS. "
        "Idempotent on hybas_id / wdpa_id."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--watersheds", help="Path to HydroBASINS shapefile")
        parser.add_argument("--protected-areas", help="Path to WDPA shapefile")
        parser.add_argument(
            "--simplify",
            type=float,
            default=0.001,
            help="ST_Simplify tolerance in degrees (~100m); 0 to skip",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args: Any, **options: Any) -> None:
        watersheds_path = options["watersheds"]
        pa_path = options["protected_areas"]
        if not watersheds_path and not pa_path:
            raise CommandError("provide at least one of --watersheds or --protected-areas")

        tolerance = options["simplify"]
        dry_run = options["dry_run"]

        with transaction.atomic():
            sid = transaction.savepoint()
            if watersheds_path:
                self._load_watersheds(Path(watersheds_path), tolerance)
            if pa_path:
                self._load_protected_areas(Path(pa_path), tolerance)
            if dry_run:
                transaction.savepoint_rollback(sid)
                self.stdout.write(self.style.WARNING("dry-run: no changes committed"))
            else:
                transaction.savepoint_commit(sid)

    def _load_watersheds(self, path: Path, tolerance: float) -> None:
        if not path.exists():
            raise CommandError(f"watersheds shapefile not found: {path}")

        ds = DataSource(str(path))
        layer = ds[0]
        created = updated = 0
        verts_before = verts_after = 0

        for feat in layer:
            hybas_id = int(feat["HYBAS_ID"].value)
            pfaf_id = int(feat["PFAF_ID"].value)
            sub_area = feat["SUB_AREA"].value

            geom = self._to_multipolygon(feat.geom.geos)
            verts_before += geom.num_coords
            if tolerance > 0:
                geom = GEOSGeometry(geom.simplify(tolerance, preserve_topology=True).wkt, srid=4326)
                geom = self._to_multipolygon(geom)
            verts_after += geom.num_coords

            defaults = {
                "name": f"Basin {hybas_id}",
                "pfafstetter_level": 6,
                "pfafstetter_code": pfaf_id,
                "area_sq_km": Decimal(str(sub_area)) if sub_area is not None else None,
                "geometry": geom,
            }
            _, was_created = Watershed.objects.update_or_create(
                hybas_id=hybas_id, defaults=defaults
            )
            created += int(was_created)
            updated += int(not was_created)

        self.stdout.write(
            f"watersheds: {created} created, {updated} updated "
            f"(vertices {verts_before} -> {verts_after})"
        )

    def _load_protected_areas(self, path: Path, tolerance: float) -> None:
        if not path.exists():
            raise CommandError(f"protected areas shapefile not found: {path}")

        ds = DataSource(str(path))
        layer = ds[0]
        created = updated = 0
        verts_before = verts_after = 0

        for feat in layer:
            wdpa_id = int(feat["SITE_ID"].value)
            name = feat["NAME"].value or feat["NAME_ENG"].value or f"PA {wdpa_id}"
            designation = feat["DESIG_ENG"].value or feat["DESIG"].value or ""
            iucn_cat = feat["IUCN_CAT"].value or ""
            status = feat["STATUS"].value or ""
            status_year = feat["STATUS_YR"].value or None
            gis_area = feat["GIS_AREA"].value

            geom = self._to_multipolygon(feat.geom.geos)
            verts_before += geom.num_coords
            if tolerance > 0:
                geom = GEOSGeometry(geom.simplify(tolerance, preserve_topology=True).wkt, srid=4326)
                geom = self._to_multipolygon(geom)
            verts_after += geom.num_coords

            defaults = {
                "name": name[:300],
                "designation": designation[:200],
                "iucn_category": iucn_cat[:20],
                "status": status[:100],
                "status_year": int(status_year) if status_year else None,
                "area_km2": Decimal(str(gis_area)) if gis_area is not None else None,
                "geometry": geom,
            }
            _, was_created = ProtectedArea.objects.update_or_create(
                wdpa_id=wdpa_id, defaults=defaults
            )
            created += int(was_created)
            updated += int(not was_created)

        self.stdout.write(
            f"protected areas: {created} created, {updated} updated "
            f"(vertices {verts_before} -> {verts_after})"
        )

    @staticmethod
    def _to_multipolygon(geom: GEOSGeometry) -> MultiPolygon:
        if geom.geom_type == "MultiPolygon":
            return geom
        if geom.geom_type == "Polygon":
            return MultiPolygon(geom, srid=geom.srid or 4326)
        raise CommandError(f"unsupported geometry type: {geom.geom_type}")
