from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from species.models import Species, SpeciesLocality, Watershed

BOOLEAN_TRUE = {"true", "yes", "y", "1"}
BOOLEAN_FALSE = {"false", "no", "n", "0", ""}

LOCALITY_TYPES = {c for c, _ in SpeciesLocality.LocalityType.choices}
PRESENCE_STATUSES = {c for c, _ in SpeciesLocality.PresenceStatus.choices}
WATER_BODY_TYPES = {c for c, _ in SpeciesLocality.WaterBodyType.choices}
COORDINATE_PRECISIONS = {c for c, _ in SpeciesLocality.CoordinatePrecision.choices}

REQUIRED_COLUMNS = {
    "scientific_name",
    "latitude",
    "longitude",
    "locality_name",
    "locality_type",
    "source_citation",
}

LAT_MIN, LAT_MAX = -26.0, -11.5
LNG_MIN, LNG_MAX = 43.0, 51.0
# Longitudes beyond ~50.6°E are east of Madagascar's coast (open Indian Ocean).
# Records in this band are loaded but flagged needs_review so they do not render
# on the public map until a human has verified the coordinates.
LNG_OFFSHORE_THRESHOLD = 50.6


class Command(BaseCommand):
    help = "Idempotently load species locality records from CSV into SpeciesLocality."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--csv", required=True, help="Path to the localities CSV")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args: Any, **options: Any) -> None:
        csv_path = Path(options["csv"])
        dry_run = options["dry_run"]

        if not csv_path.exists():
            raise CommandError(f"CSV not found: {csv_path}")

        if not Watershed.objects.exists():
            self.stderr.write(
                self.style.WARNING(
                    "No Watershed records found — drainage_basin FKs will be null. "
                    "Run load_reference_layers first for drainage basin assignment."
                )
            )

        created = updated = skipped = 0
        no_basin = 0
        errors: list[str] = []

        with csv_path.open(newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
            if missing:
                raise CommandError(f"CSV missing required columns: {sorted(missing)}")

            with transaction.atomic():
                sid = transaction.savepoint()
                for lineno, row in enumerate(reader, start=2):
                    try:
                        parsed = self._parse_row(row, lineno)
                    except ValueError as exc:
                        skipped += 1
                        errors.append(f"line {lineno}: {exc}")
                        continue

                    species = Species.objects.filter(
                        scientific_name=parsed["scientific_name"]
                    ).first()
                    if not species:
                        skipped += 1
                        errors.append(
                            f"line {lineno}: species not found: {parsed['scientific_name']!r}"
                        )
                        continue

                    point = Point(parsed["longitude"], parsed["latitude"], srid=4326)
                    basin = self._resolve_basin(point)
                    if basin is None:
                        no_basin += 1

                    if (
                        parsed["locality_type"] == SpeciesLocality.LocalityType.TYPE_LOCALITY
                        and species.taxonomic_status
                        == Species.TaxonomicStatus.UNDESCRIBED_MORPHOSPECIES
                    ):
                        self.stderr.write(
                            f"line {lineno}: warning — type_locality for "
                            f"undescribed morphospecies {species.scientific_name}"
                        )

                    location_key = f"{point.x:.5f},{point.y:.5f}"
                    needs_review = point.x > LNG_OFFSHORE_THRESHOLD
                    review_notes = ""
                    if needs_review:
                        review_notes = (
                            f"Auto-flagged: longitude {point.x:.3f}°E is east of "
                            f"Madagascar's coast (threshold {LNG_OFFSHORE_THRESHOLD}°E). "
                            f"Source: {parsed['source_citation']}. Verify coordinates "
                            f"against the original record before surfacing publicly."
                        )
                    defaults = {
                        "locality_name": parsed["locality_name"],
                        "location": point,
                        "water_body": parsed["water_body"],
                        "water_body_type": parsed["water_body_type"],
                        "drainage_basin": basin,
                        "presence_status": parsed["presence_status"],
                        "source_citation": parsed["source_citation"],
                        "year_collected": parsed["year_collected"],
                        "collector": parsed["collector"],
                        "coordinate_precision": parsed["coordinate_precision"],
                        "is_sensitive": parsed["is_sensitive"],
                        "notes": parsed["notes"],
                        "needs_review": needs_review,
                        "review_notes": review_notes,
                    }
                    _, was_created = SpeciesLocality.objects.update_or_create(
                        species=species,
                        location_key=location_key,
                        locality_type=parsed["locality_type"],
                        defaults=defaults,
                    )
                    created += int(was_created)
                    updated += int(not was_created)

                if dry_run:
                    transaction.savepoint_rollback(sid)
                else:
                    transaction.savepoint_commit(sid)

        self.stdout.write(f"created: {created}")
        self.stdout.write(f"updated: {updated}")
        self.stdout.write(f"skipped: {skipped}")
        self.stdout.write(f"no drainage basin matched: {no_basin}")
        for err in errors[:50]:
            self.stderr.write(err)
        if len(errors) > 50:
            self.stderr.write(f"... {len(errors) - 50} more errors suppressed")
        if dry_run:
            self.stdout.write(self.style.WARNING("dry-run: no changes committed"))

    def _parse_row(self, row: dict[str, str], lineno: int) -> dict[str, Any]:
        scientific_name = (row.get("scientific_name") or "").strip()
        if not scientific_name:
            raise ValueError("scientific_name is required")

        latitude = self._decimal_coord(row, "latitude", LAT_MIN, LAT_MAX)
        longitude = self._decimal_coord(row, "longitude", LNG_MIN, LNG_MAX)

        locality_name = (row.get("locality_name") or "").strip()
        if not locality_name:
            raise ValueError("locality_name is required")

        locality_type = (row.get("locality_type") or "").strip()
        if locality_type not in LOCALITY_TYPES:
            raise ValueError(f"locality_type={locality_type!r} not in {sorted(LOCALITY_TYPES)}")

        source_citation = (row.get("source_citation") or "").strip()
        if not source_citation:
            raise ValueError("source_citation is required")

        presence_status = (row.get("presence_status") or "present").strip() or "present"
        if presence_status not in PRESENCE_STATUSES:
            raise ValueError(
                f"presence_status={presence_status!r} not in {sorted(PRESENCE_STATUSES)}"
            )

        water_body_type = (row.get("water_body_type") or "").strip()
        if water_body_type and water_body_type not in WATER_BODY_TYPES:
            raise ValueError(
                f"water_body_type={water_body_type!r} not in {sorted(WATER_BODY_TYPES)}"
            )

        coordinate_precision = (row.get("coordinate_precision") or "exact").strip() or "exact"
        if coordinate_precision not in COORDINATE_PRECISIONS:
            raise ValueError(
                f"coordinate_precision={coordinate_precision!r} "
                f"not in {sorted(COORDINATE_PRECISIONS)}"
            )

        year_raw = (row.get("year_collected") or "").strip()
        try:
            year_collected = int(year_raw) if year_raw else None
        except ValueError as exc:
            raise ValueError(f"year_collected={year_raw!r} is not an integer") from exc

        return {
            "scientific_name": scientific_name,
            "latitude": latitude,
            "longitude": longitude,
            "locality_name": locality_name,
            "locality_type": locality_type,
            "presence_status": presence_status,
            "water_body": (row.get("water_body") or "").strip(),
            "water_body_type": water_body_type,
            "coordinate_precision": coordinate_precision,
            "year_collected": year_collected,
            "collector": (row.get("collector") or "").strip(),
            "source_citation": source_citation,
            "is_sensitive": self._boolean(row, "is_sensitive", default=False),
            "notes": (row.get("notes") or "").strip(),
        }

    @staticmethod
    def _resolve_basin(point: Point) -> Watershed | None:
        matches = list(Watershed.objects.filter(geometry__contains=point).order_by("area_sq_km"))
        return matches[0] if matches else None

    @staticmethod
    def _decimal_coord(row: dict[str, str], column: str, low: float, high: float) -> float:
        raw = (row.get(column) or "").strip()
        if not raw:
            raise ValueError(f"{column} is required")
        try:
            value = float(raw)
        except ValueError as exc:
            raise ValueError(f"{column}={raw!r} is not a number") from exc
        if not (low <= value <= high):
            raise ValueError(f"{column}={value} outside [{low}, {high}]")
        return value

    @staticmethod
    def _boolean(row: dict[str, str], column: str, default: bool) -> bool:
        value = (row.get(column) or "").strip().lower()
        if value in BOOLEAN_TRUE:
            return True
        if value in BOOLEAN_FALSE:
            return default if value == "" else False
        raise ValueError(f"{column}={value!r} is not a boolean")
