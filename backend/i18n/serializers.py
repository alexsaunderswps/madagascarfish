"""
Locale-aware serializer helpers.

`TranslationActualLocaleMixin` adds a sibling `<field>_locale_actual`
key for each translatable field, indicating which locale was actually
returned. The frontend uses this to render an "(English)" badge on
content that fell back to the default locale.

In Gate L1 the mixin checks "column populated/empty" only — if the
requested locale's `<field>_<locale>` column has a non-empty value, it
is returned and the actual-locale equals the requested locale; otherwise
we fall back to English. Gate L3 turns on `I18N_ENFORCE_REVIEW_GATE`,
at which point eligibility additionally consults
`TranslationStatus.status` (only `human_approved` or `published` content
is shown in the requested locale; everything else falls back).

See architect doc §4 / B2 for the staged rollout.
"""

from __future__ import annotations

from django.conf import settings
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
        active = (
            translation.get_language()
            or settings.MODELTRANSLATION_DEFAULT_LANGUAGE
        )
        for field in self.translatable_fields:
            data[f"{field}_locale_actual"] = self._resolve_actual_locale(
                instance, field, active
            )
        return data

    def _resolve_actual_locale(
        self, instance, field: str, requested_locale: str
    ) -> str:
        """Return the locale code whose column actually supplied the
        value rendered for `field`. The contract is:
        - If the requested locale's column is non-empty, return it.
        - Otherwise return the default locale (en).

        L3 will extend this to gate on `TranslationStatus.status`."""
        candidate = getattr(instance, f"{field}_{requested_locale}", None)
        if candidate:
            return requested_locale
        return settings.MODELTRANSLATION_DEFAULT_LANGUAGE
