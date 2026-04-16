from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from species.models import Species


BOOLEAN_TRUE = {"true", "yes", "y", "1"}
BOOLEAN_FALSE = {"false", "no", "n", "0", ""}
IUCN_CODES = {c for c, _ in Species.IUCNStatus.choices}
ENDEMIC_STATUSES = {c for c, _ in Species.EndemicStatus.choices}
TAXONOMIC_STATUSES = {c for c, _ in Species.TaxonomicStatus.choices}
POPULATION_TRENDS = {c for c, _ in Species.PopulationTrend.choices}
CARES_STATUSES = {c for c, _ in Species.CARESStatus.choices}

# Columns listed as "not stored directly" in the data-preparation guide.
INFORMATIONAL_COLUMNS = {"synonyms", "captive_institutions", "notes"}

REQUIRED_COLUMNS = {
    "scientific_name",
    "family",
    "genus",
    "endemic_status",
    "taxonomic_status",
}


class Command(BaseCommand):
    help = "Idempotently load species from the seed CSV (keyed on scientific_name)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--csv", required=True, help="Path to the species seed CSV")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate the CSV and report outcomes without writing to the database",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        csv_path = Path(options["csv"])
        dry_run = options["dry_run"]

        if not csv_path.exists():
            raise CommandError(f"CSV not found: {csv_path}")

        created = updated = skipped = 0
        errors: list[str] = []

        with csv_path.open(newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
            if missing:
                raise CommandError(f"CSV is missing required columns: {sorted(missing)}")

            with transaction.atomic():
                sid = transaction.savepoint()
                for lineno, row in enumerate(reader, start=2):
                    try:
                        fields = self._parse_row(row)
                    except ValueError as exc:
                        skipped += 1
                        errors.append(f"line {lineno}: {exc}")
                        continue

                    scientific_name = fields.pop("scientific_name")
                    obj, was_created = Species.objects.update_or_create(
                        scientific_name=scientific_name,
                        defaults=fields,
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1

                if dry_run:
                    transaction.savepoint_rollback(sid)
                else:
                    transaction.savepoint_commit(sid)

        self.stdout.write(f"created: {created}")
        self.stdout.write(f"updated: {updated}")
        self.stdout.write(f"skipped: {skipped}")
        for err in errors:
            self.stderr.write(err)
        if dry_run:
            self.stdout.write(self.style.WARNING("dry-run: no changes committed"))

    def _parse_row(self, row: dict[str, str]) -> dict[str, Any]:
        scientific_name = (row.get("scientific_name") or "").strip()
        if not scientific_name:
            raise ValueError("scientific_name is required")

        family = (row.get("family") or "").strip()
        genus = (row.get("genus") or "").strip()
        if not family or not genus:
            raise ValueError("family and genus are required")

        endemic_status = (row.get("endemic_status") or "").strip()
        if endemic_status not in ENDEMIC_STATUSES:
            raise ValueError(
                f"endemic_status {endemic_status!r} not in {sorted(ENDEMIC_STATUSES)}"
            )

        taxonomic_status = (row.get("taxonomic_status") or "described").strip()
        if taxonomic_status not in TAXONOMIC_STATUSES:
            raise ValueError(
                f"taxonomic_status {taxonomic_status!r} not in {sorted(TAXONOMIC_STATUSES)}"
            )

        iucn_status = self._optional_enum(row, "iucn_status", IUCN_CODES)
        population_trend = self._optional_enum(row, "population_trend", POPULATION_TRENDS)
        cares_status = self._optional_enum(row, "cares_status", CARES_STATUSES)

        return {
            "scientific_name": scientific_name,
            "authority": (row.get("authority") or "").strip() or None,
            "year_described": self._optional_int(row, "year_described"),
            "family": family,
            "genus": genus,
            "endemic_status": endemic_status,
            "iucn_status": iucn_status,
            "iucn_taxon_id": self._optional_int(row, "iucn_taxon_id"),
            "population_trend": population_trend,
            "cares_status": cares_status,
            "taxonomic_status": taxonomic_status,
            "provisional_name": (row.get("provisional_name") or "").strip() or None,
            "shoal_priority": self._boolean(row, "shoal_priority", default=False),
            "fishbase_id": self._optional_int(row, "fishbase_id"),
            "distribution_narrative": (row.get("distribution_narrative") or "").strip(),
            "habitat_type": (row.get("habitat_type") or "").strip(),
            "max_length_cm": self._optional_decimal(row, "max_length_cm"),
            "in_captivity": self._boolean(row, "in_captivity", default=False),
        }

    @staticmethod
    def _optional_enum(row: dict[str, str], column: str, allowed: set[str]) -> str | None:
        value = (row.get(column) or "").strip()
        if not value:
            return None
        if value not in allowed:
            raise ValueError(f"{column}={value!r} not in {sorted(allowed)}")
        return value

    @staticmethod
    def _optional_int(row: dict[str, str], column: str) -> int | None:
        value = (row.get(column) or "").strip()
        if not value:
            return None
        try:
            return int(value)
        except ValueError as exc:
            raise ValueError(f"{column}={value!r} is not an integer") from exc

    @staticmethod
    def _optional_decimal(row: dict[str, str], column: str) -> Decimal | None:
        value = (row.get(column) or "").strip()
        if not value:
            return None
        try:
            return Decimal(value)
        except InvalidOperation as exc:
            raise ValueError(f"{column}={value!r} is not a decimal") from exc

    @staticmethod
    def _boolean(row: dict[str, str], column: str, default: bool) -> bool:
        value = (row.get(column) or "").strip().lower()
        if value in BOOLEAN_TRUE:
            return True
        if value in BOOLEAN_FALSE:
            return default if value == "" else False
        raise ValueError(f"{column}={value!r} is not a boolean")
