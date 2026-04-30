"""
Machine-translate Species + Taxon translatable fields via DeepL.

Walks every Species in the registry (and Taxon for common_family_name).
For each (object, field, target_locale) where the target locale's
column is empty, calls DeepL on the English source and writes the
translation to the target column. Records the operation in a
`TranslationStatus` row with status='mt_draft'.

Process is idempotent: re-running the command skips fields that
already have content. Use --force to retranslate everything.

This produces the **MT draft** state. The next pipeline step is the
@conservation-writer agent's voice review, then human approval through
the admin side-by-side review screen — at which point the
TranslationStatus advances to writer_reviewed → human_approved.

Usage:
    python manage.py translate_species --locale fr
    python manage.py translate_species --locale fr --species 42 43 99
    python manage.py translate_species --locale fr --family Bedotiidae
    python manage.py translate_species --locale fr --force
    python manage.py translate_species --locale fr --retranslate-stale
    python manage.py translate_species --locale fr --dry-run

Reads DEEPL_API_KEY from the .env loaded by config/settings/base.py.
Detects free vs. paid tier from the :fx suffix on the key. Auth is
header-based (Authorization: DeepL-Auth-Key …) per DeepL's
November 2025 deprecation of form-body auth.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from typing import Iterable

import requests
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from i18n.models import TranslationStatus
from species.models import Species, Taxon

# Translatable fields per model. Mirrors the registrations in
# backend/species/translation.py.
SPECIES_FIELDS = (
    "description",
    "ecology_notes",
    "distribution_narrative",
    "morphology",
)
TAXON_FIELDS = ("common_family_name",)

DEEPL_FREE_ENDPOINT = "https://api-free.deepl.com/v2/translate"
DEEPL_PAID_ENDPOINT = "https://api.deepl.com/v2/translate"
BATCH_SIZE = 50

LOCALE_TO_DEEPL = {"fr": "FR", "de": "DE", "es": "ES"}


@dataclass
class TranslationJob:
    """One field on one object scheduled for MT."""

    model: str  # "species" or "taxon"
    object_id: int
    field: str  # e.g., "description"
    source_text: str  # English value


class Command(BaseCommand):
    help = (
        "Machine-translate Species + Taxon translatable fields via DeepL "
        "and record TranslationStatus rows."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--locale",
            required=True,
            choices=["fr", "de", "es"],
            help="Target locale code.",
        )
        parser.add_argument(
            "--species",
            nargs="+",
            type=int,
            default=None,
            help="Restrict to specific Species ids (default: all).",
        )
        parser.add_argument(
            "--family",
            default=None,
            help=(
                "Restrict to one family (case-sensitive Latin name, e.g., "
                "Bedotiidae). Useful for the @conservation-writer batched "
                "review workflow."
            ),
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help=(
                "Retranslate fields that already have target-locale content. "
                "Use sparingly — overwrites human-approved translations."
            ),
        )
        parser.add_argument(
            "--retranslate-stale",
            action="store_true",
            help=(
                "Re-run MT only on TranslationStatus rows that were demoted "
                "back to mt_draft because their English source changed (signal "
                "auto-invalidation). Overwrites the existing target column. "
                "Equivalent to scoping --species + --force to those rows."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print the job plan without calling DeepL.",
        )
        parser.add_argument(
            "--no-taxon",
            action="store_true",
            help="Skip Taxon.common_family_name translation.",
        )

    def handle(self, *args, **options):
        locale: str = options["locale"]
        deepl_lang = LOCALE_TO_DEEPL[locale]
        species_ids: list[int] | None = options["species"]
        family: str | None = options["family"]
        force: bool = options["force"]
        dry_run: bool = options["dry_run"]
        skip_taxon: bool = options["no_taxon"]
        retranslate_stale: bool = options["retranslate_stale"]

        # --retranslate-stale resolves to: find species rows whose
        # TranslationStatus is mt_draft AND was auto-demoted (signal note
        # about English-source change). Force-retranslate those.
        if retranslate_stale:
            if species_ids or family:
                raise CommandError(
                    "--retranslate-stale is mutually exclusive with --species and --family."
                )
            species_ct = ContentType.objects.get_for_model(Species)
            stale_ids = list(
                TranslationStatus.objects.filter(
                    content_type=species_ct,
                    locale=locale,
                    status=TranslationStatus.Status.MT_DRAFT,
                    notes__icontains="English source changed",
                )
                .values_list("object_id", flat=True)
                .distinct()
            )
            if not stale_ids:
                self.stdout.write(
                    f"[translate_species] no stale {locale} rows; nothing to do."
                )
                return
            species_ids = stale_ids
            force = True

        key = os.environ.get("DEEPL_API_KEY", "").strip()
        if not key and not dry_run:
            raise CommandError(
                "DEEPL_API_KEY is not set. Add it to .env (root) or pass "
                "via environment. Use --dry-run to plan without it."
            )

        endpoint = DEEPL_FREE_ENDPOINT if key.endswith(":fx") else DEEPL_PAID_ENDPOINT

        self.stdout.write(
            f"[translate_species] target={locale} (deepl_lang={deepl_lang}) "
            f"endpoint={endpoint.split('//')[1].split('/')[0]} "
            f"{'(DRY-RUN)' if dry_run else ''}"
        )

        # Build the job list.
        species_qs = Species.objects.all()
        if species_ids:
            species_qs = species_qs.filter(pk__in=species_ids)
        if family:
            species_qs = species_qs.filter(family=family)

        jobs: list[TranslationJob] = []

        for sp in species_qs.iterator():
            for field in SPECIES_FIELDS:
                source = getattr(sp, f"{field}_en", None) or getattr(sp, field, "")
                if not source or not source.strip():
                    continue
                target = getattr(sp, f"{field}_{locale}", None)
                if target and target.strip() and not force:
                    continue
                jobs.append(
                    TranslationJob(
                        model="species",
                        object_id=sp.pk,
                        field=field,
                        source_text=source,
                    )
                )

        if not skip_taxon:
            taxon_qs = Taxon.objects.all()
            if family:
                # Filter Taxon by name match for family-level taxa, OR
                # constrain to taxa whose name appears in the species
                # subset. Simpler: filter by name == family.
                taxon_qs = taxon_qs.filter(name=family)
            for tx in taxon_qs.iterator():
                for field in TAXON_FIELDS:
                    source = getattr(tx, f"{field}_en", None) or getattr(tx, field, "")
                    if not source or not source.strip():
                        continue
                    target = getattr(tx, f"{field}_{locale}", None)
                    if target and target.strip() and not force:
                        continue
                    jobs.append(
                        TranslationJob(
                            model="taxon",
                            object_id=tx.pk,
                            field=field,
                            source_text=source,
                        )
                    )

        species_jobs = sum(1 for j in jobs if j.model == "species")
        taxon_jobs = sum(1 for j in jobs if j.model == "taxon")
        self.stdout.write(
            f"[translate_species] {len(jobs)} jobs scheduled "
            f"({species_jobs} species fields, {taxon_jobs} taxon fields)"
        )

        if not jobs:
            self.stdout.write("[translate_species] nothing to translate. Exiting.")
            return

        if dry_run:
            for j in jobs[:20]:
                preview = j.source_text[:60].replace("\n", " ")
                self.stdout.write(
                    f"  - {j.model}#{j.object_id}.{j.field}: {preview!r}"
                )
            if len(jobs) > 20:
                self.stdout.write(f"  ... and {len(jobs) - 20} more")
            return

        # Execute in batches.
        sp_ct = ContentType.objects.get_for_model(Species)
        tx_ct = ContentType.objects.get_for_model(Taxon)

        translated = 0
        for batch_start in range(0, len(jobs), BATCH_SIZE):
            batch = jobs[batch_start : batch_start + BATCH_SIZE]
            sources = [j.source_text for j in batch]
            try:
                translations = self._call_deepl(
                    key, endpoint, sources, deepl_lang
                )
            except Exception as exc:
                self.stderr.write(
                    f"[translate_species] DeepL batch starting at {batch_start} failed: {exc}"
                )
                self.stderr.write(
                    "[translate_species] partial batch NOT written. Re-run to retry."
                )
                raise

            with transaction.atomic():
                now = timezone.now()
                for job, translated_text in zip(batch, translations, strict=True):
                    if job.model == "species":
                        sp = Species.objects.get(pk=job.object_id)
                        setattr(sp, f"{job.field}_{locale}", translated_text)
                        sp.save(update_fields=[f"{job.field}_{locale}"])
                        ct = sp_ct
                    else:
                        tx = Taxon.objects.get(pk=job.object_id)
                        setattr(tx, f"{job.field}_{locale}", translated_text)
                        tx.save(update_fields=[f"{job.field}_{locale}"])
                        ct = tx_ct
                    TranslationStatus.objects.update_or_create(
                        content_type=ct,
                        object_id=job.object_id,
                        field=job.field,
                        locale=locale,
                        defaults={
                            "status": TranslationStatus.Status.MT_DRAFT,
                            "mt_provider": "deepl",
                            "mt_translated_at": now,
                        },
                    )
                    translated += 1
            self.stdout.write(
                f"[translate_species] {translated}/{len(jobs)} translated"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"[translate_species] wrote {translated} translations + "
                f"TranslationStatus rows ({locale})"
            )
        )

    def _call_deepl(
        self,
        key: str,
        endpoint: str,
        texts: list[str],
        target_lang: str,
    ) -> list[str]:
        """Call DeepL with header-based auth; preserve XML tags. Long-form
        species text is unlikely to contain ICU placeholders, but we do
        encode `&` → `&amp;` to keep the parser happy on text like
        "Description & Ecology"."""
        if not texts:
            return []

        encoded_texts = [self._encode_for_deepl(t) for t in texts]

        response = requests.post(
            endpoint,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"DeepL-Auth-Key {key}",
            },
            data=json.dumps(
                {
                    "text": encoded_texts,
                    "source_lang": "EN",
                    "target_lang": target_lang,
                    "tag_handling": "xml",
                    "preserve_formatting": True,
                }
            ),
            timeout=60,
        )

        if response.status_code == 429:
            # DeepL rate limit; back off and retry once.
            time.sleep(5)
            response = requests.post(
                endpoint,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"DeepL-Auth-Key {key}",
                },
                data=json.dumps(
                    {
                        "text": encoded_texts,
                        "source_lang": "EN",
                        "target_lang": target_lang,
                        "tag_handling": "xml",
                        "preserve_formatting": True,
                    }
                ),
                timeout=60,
            )

        if not response.ok:
            raise RuntimeError(
                f"DeepL {response.status_code}: {response.text[:500]}"
            )

        data = response.json()
        return [self._decode_from_deepl(t["text"]) for t in data["translations"]]

    @staticmethod
    def _encode_for_deepl(s: str) -> str:
        # Escape stray ampersands; DeepL's XML parser rejects raw `&`.
        return re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;)", "&amp;", s)

    @staticmethod
    def _decode_from_deepl(s: str) -> str:
        return s.replace("&amp;", "&")
