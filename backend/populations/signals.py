"""Cache invalidation for dashboard when ExSituPopulation changes."""

from __future__ import annotations

from django.core.cache import cache
from django.db.models.signals import post_delete, post_save

from populations.models import ExSituPopulation, Institution
from species.views_dashboard import DASHBOARD_CACHE_KEY


def _invalidate_dashboard(**kwargs: object) -> None:
    cache.delete(DASHBOARD_CACHE_KEY)


post_save.connect(_invalidate_dashboard, sender=ExSituPopulation)
post_delete.connect(_invalidate_dashboard, sender=ExSituPopulation)
post_save.connect(_invalidate_dashboard, sender=Institution)
post_delete.connect(_invalidate_dashboard, sender=Institution)
