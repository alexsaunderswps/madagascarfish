"""Read-only diff between a SHOAL priority CSV and the species registry.

Makes ZERO writes. Produces a three-section worklist for the operator
to review manually in admin:

    1. In CSV, not flagged True in registry (candidates to flip True).
    2. Flagged True in registry, not in CSV (review — stale CSV vs.
       delisted by SHOAL).
    3. In CSV, not in registry at all (likely taxonomy drift or a
       missing species in the seed catalogue).

Does NOT change any ``Species.shoal_priority`` values. A future
``reconcile_shoal_priority`` could do that once we have a high-confidence
list with provenance; until then the operator uses this report as a
worklist and flips flags through admin.

CSV shape: the tool expects SHOAL's export format — a header row
followed by rows whose **second column** is the scientific name. Other
columns are ignored (we only need the species identity for the diff).
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from species.models import Species

# Species in the CSV that are not Madagascar-endemic priorities for
# MFFCP — they appear because Madagascar is in their global range.
# Filtering them out keeps the worklist relevant to the registry.
_NON_ENDEMIC_COSMOPOLITAN_NAMES: set[str] = {
    "Pristis pristis",  # Largetooth sawfish — global range
}


class Command(BaseCommand):
    help = (
        "Diff a SHOAL priority-species CSV against the species registry. "
        "Read-only — prints a three-section worklist, makes no writes."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--csv", required=True, help="Path to the SHOAL CSV")
        parser.add_argument(
            "--include-cosmopolitan",
            action="store_true",
            help=(
                "Include species whose range extends beyond Madagascar "
                "(e.g. Pristis pristis). Off by default since those aren't "
                "relevant to the Madagascar endemic registry."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        csv_path = Path(options["csv"])
        include_cosmopolitan: bool = options["include_cosmopolitan"]

        if not csv_path.exists():
            raise CommandError(f"CSV not found: {csv_path}")

        csv_names = self._read_csv_names(csv_path, include_cosmopolitan)
        registry_priority = set(
            Species.objects.filter(shoal_priority=True).values_list("scientific_name", flat=True)
        )
        registry_all = set(Species.objects.values_list("scientific_name", flat=True))

        in_csv_not_flagged = sorted(csv_names & registry_all - registry_priority)
        flagged_not_in_csv = sorted(registry_priority - csv_names)
        in_csv_not_in_registry = sorted(csv_names - registry_all)

        self.stdout.write(self.style.MIGRATE_HEADING("SHOAL priority reconciliation — worklist"))
        self.stdout.write(f"CSV: {csv_path}")
        self.stdout.write(
            f"SHOAL species considered: {len(csv_names)} "
            f"(cosmopolitan {'included' if include_cosmopolitan else 'excluded'})"
        )
        self.stdout.write(f"Registry species total: {len(registry_all)}")
        self.stdout.write(f"Registry currently shoal_priority=True: {len(registry_priority)}")
        self.stdout.write("")

        self._print_section(
            "1. In CSV, not flagged True in registry — CANDIDATES TO FLIP TRUE",
            in_csv_not_flagged,
            "Review each in /admin/species/species/ and set shoal_priority=True "
            "if the species is still on SHOAL's current priority list.",
        )
        self._print_section(
            "2. Flagged True in registry, not in CSV — REVIEW (stale CSV or delisted?)",
            flagged_not_in_csv,
            "Either SHOAL removed them in a newer list (flip False) or the CSV "
            "is an incomplete snapshot (leave True). Check SHOAL's current site "
            "before flipping.",
        )
        self._print_section(
            "3. In CSV, not in registry at all — TAXONOMY / SEEDING GAP",
            in_csv_not_in_registry,
            "Likely genus agreement drift (e.g. 'omalonota' vs 'omalonotus') or "
            "a species missing from the seed catalogue. Investigate synonyms; "
            "do NOT add via this command — go through the species seed process.",
        )

        self.stdout.write(self.style.WARNING("No changes written. This is a read-only report."))

    def _read_csv_names(self, csv_path: Path, include_cosmopolitan: bool) -> set[str]:
        names: set[str] = set()
        with csv_path.open(newline="", encoding="utf-8") as fh:
            reader = csv.reader(fh)
            next(reader, None)  # header row (may be blank in SHOAL export)
            for row in reader:
                if len(row) < 2:
                    continue
                sci = (row[1] or "").strip()
                if not sci:
                    continue
                if not include_cosmopolitan and sci in _NON_ENDEMIC_COSMOPOLITAN_NAMES:
                    continue
                names.add(sci)
        return names

    def _print_section(self, title: str, names: list[str], guidance: str) -> None:
        self.stdout.write(self.style.MIGRATE_LABEL(title))
        self.stdout.write(f"  count: {len(names)}")
        if names:
            for n in names:
                self.stdout.write(f"  - {n}")
        else:
            self.stdout.write("  (none)")
        self.stdout.write(f"  → {guidance}")
        self.stdout.write("")
