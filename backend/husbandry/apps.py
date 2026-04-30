from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class HusbandryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "husbandry"
    verbose_name = _("Husbandry & Breeding Guidance")
