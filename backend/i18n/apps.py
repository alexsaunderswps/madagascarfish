from django.apps import AppConfig


class I18NConfig(AppConfig):
    """Cross-cutting app for translation pipeline state. Tracks the
    review status of each translatable field per locale per object.
    Decoupled from `species` and other content apps so any model with
    translatable fields can register a `TranslationStatus` row.

    L1 lands the model only. Signal handlers that auto-create or
    invalidate rows on translatable-field saves are explicitly L3 work
    (architect doc §5 / B1 deferral)."""

    name = "i18n"
    label = "i18n"
    default_auto_field = "django.db.models.BigAutoField"
    verbose_name = "Translation pipeline"
