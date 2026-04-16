"""Cache invalidation signals for dashboard and map endpoints."""

from __future__ import annotations

from django.core.cache import cache
from django.db.models.signals import post_delete, post_save

from species.models import ConservationAssessment, Species, SpeciesLocality
from species.views_dashboard import DASHBOARD_CACHE_KEY
from species.views_map import MAP_SUMMARY_CACHE_KEY


def _invalidate_dashboard(**kwargs: object) -> None:
    cache.delete(DASHBOARD_CACHE_KEY)


def _invalidate_map(**kwargs: object) -> None:
    cache.delete(MAP_SUMMARY_CACHE_KEY)


# Dashboard: invalidated by Species, ExSituPopulation, ConservationAssessment changes
post_save.connect(_invalidate_dashboard, sender=Species)
post_delete.connect(_invalidate_dashboard, sender=Species)
post_save.connect(_invalidate_dashboard, sender=ConservationAssessment)
post_delete.connect(_invalidate_dashboard, sender=ConservationAssessment)

# Map: invalidated by SpeciesLocality changes
post_save.connect(_invalidate_map, sender=SpeciesLocality)
post_delete.connect(_invalidate_map, sender=SpeciesLocality)
