from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count

from species.models import ProtectedArea, SpeciesLocality, Watershed


class Command(BaseCommand):
    help = "Serialize reference layers (watersheds, protected areas) to static GeoJSON."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--output-dir",
            required=True,
            help="Directory where GeoJSON files will be written",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        out_dir = Path(options["output_dir"])
        out_dir.mkdir(parents=True, exist_ok=True)
        if not out_dir.is_dir():
            raise CommandError(f"output-dir is not a directory: {out_dir}")

        self._write_watersheds(out_dir / "watersheds.geojson")
        self._write_protected_areas(out_dir / "protected-areas.geojson")

    def _write_watersheds(self, path: Path) -> None:
        basin_species_counts: dict[int, int] = dict(
            SpeciesLocality.objects.exclude(drainage_basin__isnull=True)
            .values_list("drainage_basin_id")
            .annotate(n=Count("species", distinct=True))
            .values_list("drainage_basin_id", "n")
        )

        features = []
        for w in Watershed.objects.all().iterator():
            features.append(
                {
                    "type": "Feature",
                    "geometry": json.loads(w.geometry.geojson),
                    "properties": {
                        "hybas_id": w.hybas_id,
                        "name": w.name,
                        "pfafstetter_code": w.pfafstetter_code,
                        "pfafstetter_level": w.pfafstetter_level,
                        "area_sq_km": float(w.area_sq_km) if w.area_sq_km is not None else None,
                        "species_count": basin_species_counts.get(w.id, 0),
                    },
                }
            )

        self._write_collection(path, features)

    def _write_protected_areas(self, path: Path) -> None:
        features = []
        for pa in ProtectedArea.objects.all().iterator():
            features.append(
                {
                    "type": "Feature",
                    "geometry": json.loads(pa.geometry.geojson),
                    "properties": {
                        "wdpa_id": pa.wdpa_id,
                        "name": pa.name,
                        "designation": pa.designation,
                        "iucn_category": pa.iucn_category,
                        "status": pa.status,
                        "status_year": pa.status_year,
                        "area_km2": float(pa.area_km2) if pa.area_km2 is not None else None,
                    },
                }
            )

        self._write_collection(path, features)

    def _write_collection(self, path: Path, features: list[dict[str, Any]]) -> None:
        payload = {"type": "FeatureCollection", "features": features}
        path.write_text(json.dumps(payload))
        size_kb = path.stat().st_size / 1024
        self.stdout.write(f"{path}: {len(features)} features, {size_kb:.1f} KB")
