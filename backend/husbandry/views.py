"""Husbandry API views.

Read-only public endpoint: `GET /api/v1/species/{id}/husbandry/`.

Returns 200 with the full payload when a published record exists; 404
otherwise — regardless of whether a draft exists (AC-08.5, never leak
`published: false`).
"""

from __future__ import annotations

from django.http import Http404
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny

from husbandry.models import SpeciesHusbandry
from husbandry.serializers import SpeciesHusbandrySerializer


class SpeciesHusbandryDetailView(RetrieveAPIView):
    """Public, read-only. Returns 404 unless a published record exists."""

    permission_classes = [AllowAny]
    serializer_class = SpeciesHusbandrySerializer
    # Lookup is species_id passed as the URL kwarg `pk`.
    lookup_field = "species_id"
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        # Crucially, filter on published=True so unpublished drafts produce
        # 404, not 200-with-flag. Adversarial test AC-08.5 depends on this.
        return (
            SpeciesHusbandry.objects.filter(published=True)
            .select_related("last_reviewed_by")
            .prefetch_related("sources")
        )

    def get_object(self):
        try:
            return super().get_object()
        except Http404:
            raise  # Deliberate: do not leak any information about drafts.
