from __future__ import annotations

from pathlib import Path
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

DEFAULT_DATA_DIR = Path("/data")

DEFAULT_WATERSHEDS = "reference/hydrobasins_madagascar_lev06.shp"
DEFAULT_PROTECTED_AREAS = "reference/wdpa_madagascar.shp"
DEFAULT_SPECIES_CSV = "seed/madagascar_freshwater_fish_seed.csv"
DEFAULT_LOCALITIES_CSV = "seed/madagascar_freshwater_fish_localities_seed.csv"


class Command(BaseCommand):
    help = (
        "Seed a fresh environment end-to-end: reference layers (watersheds + "
        "protected areas), species, then localities. Idempotent — safe to re-run."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--data-dir",
            default=str(DEFAULT_DATA_DIR),
            help="Root directory holding reference/ and seed/ subdirs (default: /data)",
        )
        parser.add_argument(
            "--skip-reference",
            action="store_true",
            help="Skip load_reference_layers (watersheds + protected areas)",
        )
        parser.add_argument(
            "--skip-species",
            action="store_true",
            help="Skip seed_species",
        )
        parser.add_argument(
            "--skip-localities",
            action="store_true",
            help="Skip seed_localities",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        data_dir = Path(options["data_dir"])
        if not data_dir.is_dir():
            raise CommandError(f"data dir not found: {data_dir}")

        if not options["skip_reference"]:
            self.stdout.write(self.style.MIGRATE_HEADING("== load_reference_layers =="))
            call_command(
                "load_reference_layers",
                watersheds=str(data_dir / DEFAULT_WATERSHEDS),
                protected_areas=str(data_dir / DEFAULT_PROTECTED_AREAS),
            )

        if not options["skip_species"]:
            self.stdout.write(self.style.MIGRATE_HEADING("== seed_species =="))
            call_command(
                "seed_species",
                csv=str(data_dir / DEFAULT_SPECIES_CSV),
            )

        if not options["skip_localities"]:
            self.stdout.write(self.style.MIGRATE_HEADING("== seed_localities =="))
            call_command(
                "seed_localities",
                csv=str(data_dir / DEFAULT_LOCALITIES_CSV),
            )

        self.stdout.write(self.style.SUCCESS("seed_all complete"))
