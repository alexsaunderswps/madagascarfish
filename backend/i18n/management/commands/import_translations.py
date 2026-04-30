"""
Import locale-column content + TranslationStatus rows from a JSON export.

Designed for the cross-env propagation problem: machine-translate +
review on one environment (e.g. local Docker), then apply the
identical state on another (e.g. Hetzner staging) without re-running
the MT pipeline or re-doing the human-approval pass.

The export is keyed by `scientific_name` (the natural key on Species),
so it's robust against differing primary-key values between
environments.

Export format (JSON array, one object per species):

    [
      {
        "scientific_name": "Bedotia albomarginata",
        "fields": {
          "distribution_narrative": {
            "fr_text": "Bassins versants supérieurs...",
            "status": "human_approved"
          },
          "description": {...},
          ...
        }
      },
      ...
    ]

Usage:

    python manage.py import_translations \\
        --json /data/seed/fr-translations/fr-translations-export.json \\
        --locale fr

Flags:
    --json PATH        Path to the export JSON.
    --locale CODE      Target locale (fr / de / es).
    --dry-run          Print what would change; do not write.
    --skip-missing     If a scientific_name in the JSON isn't in the
                       target DB, skip with a warning instead of failing.
    --approve-all      After import, set status='human_approved' on
                       every imported row regardless of source status.
                       Use only when you trust the export wholesale.

The import is idempotent: re-running it overwrites the locale-column
content + the TranslationStatus row for each (species, field, locale)
tuple. Other fields on Species are not touched.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from i18n.models import TranslationStatus
from species.models import Species

VALID_LOCALES = {"fr", "de", "es"}
VALID_STATUSES = {choice for choice, _ in TranslationStatus.Status.choices}


class Command(BaseCommand):
    help = "Apply a locale-column + status export onto this environment's DB."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--json", required=True, help="Export JSON path.")
        parser.add_argument(
            "--locale",
            required=True,
            choices=sorted(VALID_LOCALES),
            help="Target locale (fr / de / es).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print would-be changes; do not write.",
        )
        parser.add_argument(
            "--skip-missing",
            action="store_true",
            help="Skip rows whose scientific_name is missing locally.",
        )
        parser.add_argument(
            "--approve-all",
            action="store_true",
            help="Force status='human_approved' on every imported row.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        json_path = Path(options["json"])
        locale = options["locale"]
        dry_run = options["dry_run"]
        skip_missing = options["skip_missing"]
        approve_all = options["approve_all"]

        if not json_path.exists():
            raise CommandError(f"JSON file not found: {json_path}")

        with json_path.open(encoding="utf-8") as fh:
            payload = json.load(fh)

        if not isinstance(payload, list):
            raise CommandError("Export must be a JSON array of species records.")

        ct = ContentType.objects.get_for_model(Species)
        now = timezone.now()
        prefix = "[import_translations]"
        if dry_run:
            prefix += " (DRY-RUN)"

        species_updates = 0
        status_writes = 0
        missing = 0

        for record in payload:
            sci_name = record.get("scientific_name")
            fields = record.get("fields") or {}
            if not sci_name or not fields:
                continue

            try:
                sp = Species.objects.get(scientific_name=sci_name)
            except Species.DoesNotExist:
                if skip_missing:
                    self.stdout.write(f"{prefix} skip missing: {sci_name}")
                    missing += 1
                    continue
                raise CommandError(
                    f"Species not found: {sci_name!r}. "
                    f"Pass --skip-missing to ignore."
                )

            update_fields: list[str] = []
            for field, payload_field in fields.items():
                column = f"{field}_{locale}"
                if not hasattr(sp, column):
                    self.stdout.write(
                        f"{prefix} skip unknown column on Species: {column}"
                    )
                    continue

                fr_text = (payload_field or {}).get("fr_text") or ""
                imported_status = (payload_field or {}).get("status") or "mt_draft"
                if imported_status not in VALID_STATUSES:
                    imported_status = "mt_draft"

                final_status = "human_approved" if approve_all else imported_status

                if not dry_run:
                    setattr(sp, column, fr_text)
                    update_fields.append(column)
                    status_kwargs = {
                        "status": final_status,
                        "mt_provider": "deepl",
                        "mt_translated_at": now,
                    }
                    if final_status == TranslationStatus.Status.HUMAN_APPROVED:
                        status_kwargs["human_approved_at"] = now
                    elif final_status == TranslationStatus.Status.WRITER_REVIEWED:
                        status_kwargs["writer_reviewed_at"] = now
                    TranslationStatus.objects.update_or_create(
                        content_type=ct,
                        object_id=sp.pk,
                        field=field,
                        locale=locale,
                        defaults=status_kwargs,
                    )
                    status_writes += 1
                else:
                    self.stdout.write(
                        f"{prefix} would update {sci_name}.{column} "
                        f"({len(fr_text)} chars, status={final_status})"
                    )

            if update_fields and not dry_run:
                with transaction.atomic():
                    sp.save(update_fields=update_fields)
                species_updates += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix} done. species updated: {species_updates}, "
                f"status rows written: {status_writes}, missing skipped: {missing}"
            )
        )
