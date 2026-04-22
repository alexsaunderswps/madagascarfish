"""Idempotently seed ExSituPopulation (and its Institution) rows from CSV.

One row in the CSV = one population. Institutions are deduplicated by
name: if three rows share an ``institution_name`` the command creates
one Institution and three populations attached to it.

Shape of a CSV row (* = required):

    institution_name*
    institution_type     (default: hobbyist_keeper)
    country              (default: "Unknown")
    city
    contact_email
    species_scientific_name*
    count_total
    count_male
    count_female
    count_unsexed
    breeding_status      (breeding / non-breeding / unknown; default: unknown)
    studbook_managed     (true / false; default: false)
    last_census_date     (YYYY-MM-DD)
    date_established     (YYYY-MM-DD)
    founding_source
    notes

Species must already exist in the registry (they're seeded separately
by `seed_species`). A row referencing a missing species is skipped
with an error printed — not a fatal failure, so a larger CSV doesn't
get thrown out by one typo.
"""

from __future__ import annotations

import csv
from datetime import date, datetime
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from populations.models import ExSituPopulation, Institution
from species.models import Species

BOOLEAN_TRUE = {"true", "yes", "y", "1"}
BOOLEAN_FALSE = {"false", "no", "n", "0", ""}

INSTITUTION_TYPES = {c for c, _ in Institution.InstitutionType.choices}
BREEDING_STATUSES = {c for c, _ in ExSituPopulation.BreedingStatus.choices}

REQUIRED_COLUMNS = {"institution_name", "species_scientific_name"}


class Command(BaseCommand):
    help = (
        "Idempotently load ex-situ populations (and their institutions) from a "
        "CSV. Institutions are deduplicated by name across rows."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--csv", required=True, help="Path to the populations CSV")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args: Any, **options: Any) -> None:
        csv_path = Path(options["csv"])
        dry_run: bool = options["dry_run"]

        if not csv_path.exists():
            raise CommandError(f"CSV not found: {csv_path}")

        inst_created = inst_updated = 0
        pop_created = pop_updated = 0
        skipped = 0
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
                        scientific_name=parsed["species_scientific_name"]
                    ).first()
                    if not species:
                        skipped += 1
                        errors.append(
                            f"line {lineno}: species not found: "
                            f"{parsed['species_scientific_name']!r}"
                        )
                        continue

                    inst_defaults = {
                        "institution_type": parsed["institution_type"],
                        "country": parsed["country"],
                        "city": parsed["city"],
                        "contact_email": parsed["contact_email"],
                    }
                    # Drop blanks so we don't overwrite existing values with "".
                    inst_defaults = {k: v for k, v in inst_defaults.items() if v not in ("", None)}
                    institution, inst_was_created = Institution.objects.update_or_create(
                        name=parsed["institution_name"],
                        defaults=inst_defaults,
                    )
                    inst_created += int(inst_was_created)
                    inst_updated += int(not inst_was_created)

                    pop_defaults = {
                        "count_total": parsed["count_total"],
                        "count_male": parsed["count_male"],
                        "count_female": parsed["count_female"],
                        "count_unsexed": parsed["count_unsexed"],
                        "breeding_status": parsed["breeding_status"],
                        "studbook_managed": parsed["studbook_managed"],
                        "last_census_date": parsed["last_census_date"],
                        "date_established": parsed["date_established"],
                        "founding_source": parsed["founding_source"],
                        "notes": parsed["notes"],
                    }
                    pop_defaults = {k: v for k, v in pop_defaults.items() if v is not None}
                    _, pop_was_created = ExSituPopulation.objects.update_or_create(
                        species=species,
                        institution=institution,
                        defaults=pop_defaults,
                    )
                    pop_created += int(pop_was_created)
                    pop_updated += int(not pop_was_created)

                if dry_run:
                    transaction.savepoint_rollback(sid)
                else:
                    transaction.savepoint_commit(sid)

        self.stdout.write(f"institutions: {inst_created} created, {inst_updated} updated")
        self.stdout.write(
            f"populations: {pop_created} created, {pop_updated} updated, {skipped} skipped"
        )
        for err in errors[:50]:
            self.stderr.write(err)
        if len(errors) > 50:
            self.stderr.write(f"... {len(errors) - 50} more errors suppressed")
        if dry_run:
            self.stdout.write(self.style.WARNING("dry-run: no changes committed"))

    def _parse_row(self, row: dict[str, str], lineno: int) -> dict[str, Any]:
        institution_name = (row.get("institution_name") or "").strip()
        if not institution_name:
            raise ValueError("institution_name is required")

        species_name = (row.get("species_scientific_name") or "").strip()
        if not species_name:
            raise ValueError("species_scientific_name is required")

        institution_type = (row.get("institution_type") or "").strip() or (
            Institution.InstitutionType.HOBBYIST_KEEPER
        )
        if institution_type not in INSTITUTION_TYPES:
            raise ValueError(
                f"institution_type={institution_type!r} not in {sorted(INSTITUTION_TYPES)}"
            )

        breeding_status = (row.get("breeding_status") or "").strip() or (
            ExSituPopulation.BreedingStatus.UNKNOWN
        )
        if breeding_status not in BREEDING_STATUSES:
            raise ValueError(
                f"breeding_status={breeding_status!r} not in {sorted(BREEDING_STATUSES)}"
            )

        return {
            "institution_name": institution_name,
            "institution_type": institution_type,
            "country": (row.get("country") or "Unknown").strip(),
            "city": (row.get("city") or "").strip(),
            "contact_email": (row.get("contact_email") or "").strip(),
            "species_scientific_name": species_name,
            "count_total": self._parse_int(row.get("count_total"), "count_total"),
            "count_male": self._parse_int(row.get("count_male"), "count_male"),
            "count_female": self._parse_int(row.get("count_female"), "count_female"),
            "count_unsexed": self._parse_int(row.get("count_unsexed"), "count_unsexed"),
            "breeding_status": breeding_status,
            "studbook_managed": self._parse_bool(row.get("studbook_managed"), "studbook_managed"),
            "last_census_date": self._parse_date(row.get("last_census_date"), "last_census_date"),
            "date_established": self._parse_date(row.get("date_established"), "date_established"),
            "founding_source": (row.get("founding_source") or "").strip(),
            "notes": (row.get("notes") or "").strip(),
        }

    @staticmethod
    def _parse_int(raw: str | None, field: str) -> int | None:
        if raw is None or raw.strip() == "":
            return None
        try:
            return int(raw.strip())
        except ValueError as exc:
            raise ValueError(f"{field}={raw!r} is not an integer") from exc

    @staticmethod
    def _parse_bool(raw: str | None, field: str) -> bool:
        value = (raw or "").strip().lower()
        if value in BOOLEAN_TRUE:
            return True
        if value in BOOLEAN_FALSE:
            return False
        raise ValueError(f"{field}={raw!r} is not a boolean")

    @staticmethod
    def _parse_date(raw: str | None, field: str) -> date | None:
        value = (raw or "").strip()
        if not value:
            return None
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError(f"{field}={raw!r} is not YYYY-MM-DD") from exc
