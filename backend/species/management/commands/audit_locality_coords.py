from __future__ import annotations

import csv
import sys
from pathlib import Path
from typing import Any

from django.contrib.gis.db.models import Union
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.core.management.base import BaseCommand
from django.db.models import Q

from species.models import SpeciesLocality, Watershed


class Command(BaseCommand):
    help = (
        "Audit SpeciesLocality records whose point falls outside every Watershed "
        "(offshore or outside Madagascar landmass). Report counts and optionally "
        "emit a CSV for manual correction."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--csv",
            help="Optional output CSV of offshore records for manual correction.",
        )
        parser.add_argument(
            "--distance-km",
            type=float,
            default=None,
            help=(
                "If set, also report distance from the nearest basin edge in km — "
                "useful for deciding which to snap vs. which are truly bad."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        if not Watershed.objects.exists():
            self.stderr.write(
                self.style.ERROR(
                    "No Watershed records loaded — run load_reference_layers first."
                )
            )
            sys.exit(1)

        landmass = Watershed.objects.aggregate(geom=Union("geometry"))["geom"]
        if landmass is None:
            self.stderr.write(self.style.ERROR("Could not build landmass from watersheds."))
            sys.exit(1)

        offshore = (
            SpeciesLocality.objects.exclude(location__isnull=True)
            .exclude(location__intersects=landmass)
            .select_related("species")
            .order_by("species__scientific_name", "id")
        )
        total = SpeciesLocality.objects.filter(~Q(location__isnull=True)).count()
        off_count = offshore.count()

        self.stdout.write(
            f"offshore / outside-landmass localities: {off_count} / {total} "
            f"({(off_count / total * 100) if total else 0:.1f}%)"
        )

        if off_count == 0:
            return

        by_species: dict[str, int] = {}
        for loc in offshore:
            by_species[loc.species.scientific_name] = (
                by_species.get(loc.species.scientific_name, 0) + 1
            )
        self.stdout.write("\nBy species:")
        for name, n in sorted(by_species.items(), key=lambda kv: -kv[1]):
            self.stdout.write(f"  {n:4d}  {name}")

        csv_path = options.get("csv")
        if not csv_path:
            return

        out = Path(csv_path)
        want_distance = options.get("distance_km") is not None
        with out.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            header = [
                "id",
                "scientific_name",
                "locality_name",
                "longitude",
                "latitude",
                "coordinate_precision",
                "source_citation",
            ]
            if want_distance:
                header.append("distance_to_land_km")
            writer.writerow(header)

            qs: Any = offshore
            if want_distance:
                qs = offshore.annotate(
                    dist=Distance("location", landmass, spheroid=True)
                )

            for loc in qs:
                row = [
                    loc.id,
                    loc.species.scientific_name,
                    loc.locality_name,
                    f"{loc.location.x:.6f}",
                    f"{loc.location.y:.6f}",
                    loc.coordinate_precision,
                    loc.source_citation,
                ]
                if want_distance:
                    row.append(f"{loc.dist.km:.3f}" if loc.dist else "")  # type: ignore[attr-defined]
                writer.writerow(row)

        threshold_hint = ""
        if options.get("distance_km") is not None:
            near = sum(
                1
                for loc in offshore.annotate(
                    dist=Distance("location", landmass, spheroid=True)
                )
                if loc.dist is not None and loc.dist < D(km=options["distance_km"])  # type: ignore[attr-defined]
            )
            threshold_hint = (
                f" ({near} within {options['distance_km']:g} km — candidates to snap)"
            )
        self.stdout.write(self.style.SUCCESS(f"\nwrote {out}{threshold_hint}"))
