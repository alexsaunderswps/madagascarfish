from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from species.models import Species

# Return reasons for the post-seed IUCN name lookup — exported for tests and logs.
LOOKUP_MATCH = "match"
LOOKUP_NO_MATCH = "no_match"  # API returned nothing
LOOKUP_MISMATCH = "mismatch"  # API returned a taxon, but binomial did not match exactly
LOOKUP_UNPARSEABLE = "unparseable"  # response missing fields we need


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
        parser.add_argument(
            "--iucn-lookup",
            action="store_true",
            help=(
                "After seeding, attempt to populate iucn_taxon_id for described species "
                "that lack one by querying the IUCN scientific-name endpoint. Strict "
                "binomial match required; provisional taxa are skipped."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        csv_path = Path(options["csv"])
        dry_run = options["dry_run"]
        iucn_lookup = options["iucn_lookup"]

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
            return

        if iucn_lookup:
            self._run_iucn_lookup()

    def _parse_row(self, row: dict[str, str]) -> dict[str, Any]:
        # Strip embedded CR/LF so operator-controlled names can't forge log lines
        # when echoed to stdout/stderr from _run_iucn_lookup.
        scientific_name = (
            (row.get("scientific_name") or "").replace("\r", " ").replace("\n", " ").strip()
        )
        if not scientific_name:
            raise ValueError("scientific_name is required")

        family = (row.get("family") or "").strip()
        genus = (row.get("genus") or "").strip()
        if not family or not genus:
            raise ValueError("family and genus are required")

        endemic_status = (row.get("endemic_status") or "").strip()
        if endemic_status not in ENDEMIC_STATUSES:
            raise ValueError(f"endemic_status {endemic_status!r} not in {sorted(ENDEMIC_STATUSES)}")

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

    def _run_iucn_lookup(self) -> None:
        """Populate iucn_taxon_id for described species that lack one.

        Strict binomial match: the IUCN response's genus + species must exactly
        equal our scientific_name (case-insensitive, trimmed). Ambiguous or
        non-matching responses are logged to stderr and the row is left unchanged
        — a wrong taxon ID would cause the weekly sync to pull the wrong
        assessment for months. Provisional / undescribed taxa are skipped since
        IUCN has no record to match.
        """
        from integration.clients.iucn import IUCNAPIError, IUCNClient

        candidates = Species.objects.filter(
            iucn_taxon_id__isnull=True,
            taxonomic_status=Species.TaxonomicStatus.DESCRIBED,
        ).filter(Q(provisional_name__isnull=True) | Q(provisional_name=""))

        total = candidates.count()
        matched = mismatched = no_match = unparseable = errored = 0
        client = IUCNClient()

        self.stdout.write(f"iucn-lookup: {total} candidate species")
        for species in candidates.iterator():
            try:
                payload, cache_hit = client.get_species_by_name(species.scientific_name)
            except IUCNAPIError as exc:
                errored += 1
                self.stderr.write(f"iucn-lookup error: {species.scientific_name}: {exc}")
                continue

            if not cache_hit:
                client.wait_between_requests()

            sis_id, reason = _extract_strict_match(payload, species.scientific_name)
            if reason == LOOKUP_MATCH:
                Species.objects.filter(pk=species.pk).update(iucn_taxon_id=sis_id)
                matched += 1
                self.stdout.write(f"iucn-lookup match: {species.scientific_name} -> {sis_id}")
            elif reason == LOOKUP_NO_MATCH:
                no_match += 1
                self.stderr.write(f"iucn-lookup no match: {species.scientific_name}")
            elif reason == LOOKUP_MISMATCH:
                mismatched += 1
                self.stderr.write(
                    f"iucn-lookup mismatch (binomial differed from request): "
                    f"{species.scientific_name}"
                )
            else:
                unparseable += 1
                self.stderr.write(f"iucn-lookup unparseable response: {species.scientific_name}")

        self.stdout.write(
            f"iucn-lookup: matched={matched} no_match={no_match} "
            f"mismatch={mismatched} unparseable={unparseable} errored={errored}"
        )


def _extract_strict_match(
    payload: dict[str, Any] | None, scientific_name: str
) -> tuple[int | None, str]:
    """Pull an IUCN SIS taxon ID from the response, but only if the binomial matches exactly.

    Returns ``(sis_id, LOOKUP_MATCH)`` on success; ``(None, <reason>)`` otherwise.
    We defend against shape drift: IUCN v4 returns a ``taxon`` object with
    ``sis_taxon_id``, ``genus_name``, ``species_name`` — we also tolerate the
    flatter shape some v4 endpoints use (fields at the top level) and
    ``scientific_name`` as a single string.
    """
    if payload is None:
        return None, LOOKUP_NO_MATCH

    parts = scientific_name.strip().split()
    if len(parts) < 2:
        return None, LOOKUP_MISMATCH
    want_genus, want_species = parts[0].lower(), parts[1].lower()

    # v4 responses come in a few shapes — list of taxa, single taxon under "taxon",
    # or fields at top level. Collect candidates and check each for an exact match.
    candidates: list[dict[str, Any]] = []
    if isinstance(payload.get("taxon"), dict):
        candidates.append(payload["taxon"])
    if isinstance(payload.get("taxa"), list):
        candidates.extend(t for t in payload["taxa"] if isinstance(t, dict))
    if "sis_taxon_id" in payload or "scientific_name" in payload:
        candidates.append(payload)

    for cand in candidates:
        sis_id = cand.get("sis_taxon_id") or cand.get("taxon_id")
        genus = (cand.get("genus_name") or "").strip().lower()
        species_epithet = (cand.get("species_name") or "").strip().lower()
        sci = (cand.get("scientific_name") or "").strip().lower()

        matched_binomial = False
        if genus and species_epithet:
            matched_binomial = genus == want_genus and species_epithet == want_species
        elif sci:
            sci_parts = sci.split()
            matched_binomial = (
                len(sci_parts) >= 2 and sci_parts[0] == want_genus and sci_parts[1] == want_species
            )

        if matched_binomial and sis_id is not None:
            try:
                return int(sis_id), LOOKUP_MATCH
            except (TypeError, ValueError):
                # Shape drift: sis_taxon_id came back as a non-coercible type.
                return None, LOOKUP_UNPARSEABLE

    # We had *something* back but nothing matched the requested binomial.
    if candidates:
        return None, LOOKUP_MISMATCH
    return None, LOOKUP_UNPARSEABLE
