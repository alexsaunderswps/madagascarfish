"""
Locale-aware serializer helpers.

`TranslationActualLocaleMixin` adds a sibling `<field>_locale_actual`
key for each translatable field, indicating which locale was actually
returned. The frontend uses this to render an "(English)" badge on
content that fell back to the default locale.

L1 logic (`I18N_ENFORCE_REVIEW_GATE=False`): if the requested locale's
`<field>_<locale>` column has a non-empty value, return it and the
actual-locale equals the requested locale; otherwise fall back to
English.

L3 logic (`I18N_ENFORCE_REVIEW_GATE=True`): eligibility additionally
requires a `TranslationStatus` row with `status='human_approved'` or
`'published'`. MT drafts and writer-reviewed content are NOT served
publicly; they fall back to English until a human reviewer approves
the translation through the admin pipeline. This is the architect's
B2 lift — only human-approved translations reach public readers.
"""

from __future__ import annotations

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.utils import translation


class TranslationActualLocaleMixin:
    """Adds `<field>_locale_actual` keys to the serialized payload.

    Subclasses set `translatable_fields` to the list of field names that
    have language-suffixed columns (registered in
    `<app>/translation.py`). The mixin emits one extra key per field.
    """

    # Subclass override.
    translatable_fields: tuple[str, ...] = ()

    def to_representation(self, instance):  # type: ignore[override]
        data = super().to_representation(instance)
        active = translation.get_language() or settings.MODELTRANSLATION_DEFAULT_LANGUAGE

        # Pre-fetch all approved-status translation rows for this
        # instance once when the review-gate is enabled, so we don't
        # query per-field. Empty dict when gate is off.
        approved_locales_by_field = self._approved_status_lookup(instance, active)

        for field in self.translatable_fields:
            actual = self._resolve_actual_locale(instance, field, active, approved_locales_by_field)
            data[f"{field}_locale_actual"] = actual
            # If the actual locale differs from the requested locale, the
            # value in the payload is from the fallback (default) locale,
            # not the requested one. Modeltranslation already returned
            # the active-language column via descriptor, but the gate may
            # have rejected it. Patch the payload to the English value.
            if actual != active:
                data[field] = self._read_default_locale(instance, field)

        return data

    def _approved_status_lookup(self, instance, active_locale: str) -> dict[str, set[str]]:
        """Return {field: {locales-with-approved-status}} for the active
        non-default locale. Empty when the review-gate is off OR the
        active locale is the default (en)."""
        if not getattr(settings, "I18N_ENFORCE_REVIEW_GATE", False):
            return {}
        if active_locale == settings.MODELTRANSLATION_DEFAULT_LANGUAGE:
            return {}

        # Lazy import to avoid app-loading cycles during settings init.
        from i18n.models import TranslationStatus

        ct = ContentType.objects.get_for_model(instance)
        rows = TranslationStatus.objects.filter(
            content_type=ct,
            object_id=instance.pk,
            locale=active_locale,
            status__in=[
                TranslationStatus.Status.HUMAN_APPROVED,
                TranslationStatus.Status.PUBLISHED,
            ],
        ).values_list("field", "locale")

        result: dict[str, set[str]] = {}
        for field, locale in rows:
            result.setdefault(field, set()).add(locale)
        return result

    def _resolve_actual_locale(
        self,
        instance,
        field: str,
        requested_locale: str,
        approved_locales_by_field: dict[str, set[str]],
    ) -> str:
        """Return the locale code whose column actually supplied the
        value rendered for `field`. Order:
          1. If requested_locale == default → return default.
          2. If requested-locale column is empty → fallback to default.
          3. If review-gate is on AND no approved status row → fallback
             to default.
          4. Otherwise → return requested_locale.
        """
        default_locale = settings.MODELTRANSLATION_DEFAULT_LANGUAGE

        if requested_locale == default_locale:
            return default_locale

        candidate = getattr(instance, f"{field}_{requested_locale}", None)
        if not candidate or not str(candidate).strip():
            return default_locale

        if getattr(settings, "I18N_ENFORCE_REVIEW_GATE", False):
            approved = approved_locales_by_field.get(field, set())
            if requested_locale not in approved:
                return default_locale

        return requested_locale

    @staticmethod
    def _read_default_locale(instance, field: str):
        """Read the default-locale (English) column directly, bypassing
        modeltranslation's active-language descriptor.

        Returns the suffixed `<field>_en` column value verbatim, even
        if empty. We deliberately do NOT fall through to the unsuffixed
        attribute (`getattr(instance, field)`) — that goes through
        modeltranslation's descriptor and returns the active-locale
        value, which is exactly what we're trying to override here.

        If `<field>_en` is empty for a row whose translation we just
        rejected via the review gate, the frontend renders an empty
        section with the "(English)" fallback badge. That's correct:
        unapproved translations must not leak through, and an empty
        English source is honest about the data state."""
        default = settings.MODELTRANSLATION_DEFAULT_LANGUAGE
        return getattr(instance, f"{field}_{default}", None)
