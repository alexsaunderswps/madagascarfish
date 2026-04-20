"""Public genus silhouette endpoint — serves the SVG body for the frontend
silhouette cascade (docs/design.md §15). Species without their own SVG fall
back to the genus SVG; this endpoint is the only place the SVG body is
hydrated over the wire (keeping the list/detail payloads small).
"""

from __future__ import annotations

from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_control
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from species.models import Genus


@method_decorator(cache_control(public=True, max_age=3600), name="dispatch")
class GenusSilhouetteView(APIView):
    """GET /api/v1/genera/<name>/silhouette/

    Returns 200 with {svg, credit} when a genus silhouette exists, 404
    otherwise. One-hour browser/CDN cache; admin saves trigger the shared
    ``revalidate_public_pages`` hook which invalidates the Next.js cache.
    """

    permission_classes = [AllowAny]

    def get(self, request, name: str) -> HttpResponse:
        try:
            genus = Genus.objects.only("silhouette_svg", "silhouette_credit").get(name=name)
        except Genus.DoesNotExist:
            return Response(
                {"detail": "Genus not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if not genus.silhouette_svg:
            return Response(
                {"detail": "No silhouette on file."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(
            {"svg": genus.silhouette_svg, "credit": genus.silhouette_credit}
        )
