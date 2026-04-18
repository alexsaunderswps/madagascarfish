"""Husbandry URL config.

Mounted under `/api/v1/species/<pk>/husbandry/` from config/api_urls.py so
the route lives alongside the species detail endpoint in the public API.
"""

from __future__ import annotations

from django.urls import path

from husbandry.views import SpeciesHusbandryDetailView

urlpatterns = [
    path(
        "species/<int:pk>/husbandry/",
        SpeciesHusbandryDetailView.as_view(),
        name="species-husbandry-detail",
    ),
]
