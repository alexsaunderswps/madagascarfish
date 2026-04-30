"""
Translation-pipeline signal handlers.

Reacts to saves on translatable models (Species, Taxon) to keep
`TranslationStatus` rows in sync. Two responsibilities:

1. **Ensure rows exist.** When a non-default locale column is populated
   for the first time (manual admin edit, MT pipeline, shell, etc.),
   create a `TranslationStatus(status=mt_draft)` row if one doesn't
   already exist. Doesn't change status on existing rows.

2. **Invalidate stale translations.** When the English (default-locale)
   source for a translatable field changes, demote any advanced-status
   rows for that field's non-default-locale translations back to
   `mt_draft`. This is the architect's L3 lift of the L1 deferral
   (B1): translations that were `human_approved` against an older
   English are now stale and need re-review.

The translate_species management command writes its own `TranslationStatus`
rows via update_or_create, but these signals also fire on those saves —
get_or_create on existing rows is a no-op, so it's safe.

The pre-save handler caches the prior DB state per (sender, pk) on a
thread-local. The post-save handler compares old vs new and acts. We
use thread-local state because Django's update_fields on default save()
isn't reliably populated (admin saves, ORM .save() without
update_fields, etc.).
"""

from __future__ import annotations

import threading
from typing import Any

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from i18n.models import TranslationStatus
from species.models import Species, Taxon


# Translatable fields per model. Mirrors backend/species/translation.py.
TRANSLATABLE: dict[type, tuple[str, ...]] = {
    Species: ("description", "ecology_notes", "distribution_narrative", "morphology"),
    Taxon: ("common_family_name",),
}


def _non_default_locales() -> list[str]:
    default = settings.MODELTRANSLATION_DEFAULT_LANGUAGE
    return [code for code, _ in settings.LANGUAGES if code != default]


# Thread-local cache of pre-save translatable values, keyed by
# (sender_class, pk). Read in post_save, popped when consumed.
_pre_save_cache = threading.local()


def _cache_get() -> dict[tuple[type, Any], dict[str, str]]:
    cache = getattr(_pre_save_cache, "values", None)
    if cache is None:
        cache = {}
        _pre_save_cache.values = cache
    return cache


def _all_translatable_columns(sender: type) -> list[str]:
    """All `<field>_<locale>` column names for the sender model, including
    the default-locale (en) column."""
    locales = [settings.MODELTRANSLATION_DEFAULT_LANGUAGE] + _non_default_locales()
    return [f"{field}_{locale}" for field in TRANSLATABLE[sender] for locale in locales]


@receiver(pre_save, sender=Species)
@receiver(pre_save, sender=Taxon)
def _cache_pre_save_translatable_values(sender, instance, **kwargs):
    """Capture the pre-save DB state for translatable columns so the
    post-save handler can detect what changed."""
    if instance.pk is None:
        # Creating new; no prior state to cache.
        return
    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return
    cache = _cache_get()
    cache[(sender, instance.pk)] = {
        col: (getattr(old, col, "") or "") for col in _all_translatable_columns(sender)
    }


@receiver(post_save, sender=Species)
@receiver(post_save, sender=Taxon)
def _update_translation_status_on_save(sender, instance, created, **kwargs):
    """For each translatable (field, non-default-locale) on the saved
    instance:
      - If the English source changed and the locale column did not
        change, invalidate advanced-status rows back to mt_draft.
      - If the locale column was populated (transitioned from empty
        to non-empty, or content changed), ensure a row exists. Does
        NOT advance status on existing rows — that happens through
        the admin review actions explicitly.
    """
    cache = _cache_get()
    old_values = cache.pop((sender, instance.pk), None) if not created else None
    ct = ContentType.objects.get_for_model(sender)
    default_locale = settings.MODELTRANSLATION_DEFAULT_LANGUAGE

    for field in TRANSLATABLE[sender]:
        en_col = f"{field}_{default_locale}"
        new_en = (getattr(instance, en_col, "") or "").strip()
        old_en = (old_values or {}).get(en_col, "").strip() if not created else ""
        en_changed = (new_en != old_en) and not created

        for locale in _non_default_locales():
            loc_col = f"{field}_{locale}"
            new_loc = (getattr(instance, loc_col, "") or "").strip()
            old_loc = (old_values or {}).get(loc_col, "").strip() if not created else ""
            loc_changed = (new_loc != old_loc) or (created and bool(new_loc))

            # If the English source moved but the locale column didn't,
            # mark any advanced statuses stale.
            if en_changed and not loc_changed and new_loc:
                TranslationStatus.objects.filter(
                    content_type=ct,
                    object_id=instance.pk,
                    field=field,
                    locale=locale,
                    status__in=[
                        TranslationStatus.Status.WRITER_REVIEWED,
                        TranslationStatus.Status.HUMAN_APPROVED,
                        TranslationStatus.Status.PUBLISHED,
                    ],
                ).update(
                    status=TranslationStatus.Status.MT_DRAFT,
                    notes=(
                        "English source changed after this translation was "
                        "approved; re-review needed."
                    ),
                )

            # If the locale column was populated (or changed), make sure
            # a row exists. Don't advance status.
            if loc_changed and new_loc:
                TranslationStatus.objects.get_or_create(
                    content_type=ct,
                    object_id=instance.pk,
                    field=field,
                    locale=locale,
                    defaults={
                        "status": TranslationStatus.Status.MT_DRAFT,
                    },
                )
