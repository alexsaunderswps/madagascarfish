from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


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
    verbose_name = _("Translation pipeline")

    def ready(self):
        # Wire post_save / pre_save signal handlers that keep
        # TranslationStatus rows in sync with translatable model edits.
        # See backend/i18n/signals.py.
        from i18n import signals  # noqa: F401
