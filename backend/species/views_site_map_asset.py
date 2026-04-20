"""Public SiteMapAsset endpoint — serves a curated map thumbnail by slot.

The frontend consumes by slot name (``hero_thumb``, ``profile_panel``). When
the row has no image uploaded yet the endpoint returns 404 so pages can render
the stripe fallback rather than a broken <img> tag.
"""

from __future__ import annotations

from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_control
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from species.models import SiteMapAsset


@method_decorator(cache_control(public=True, max_age=3600), name="dispatch")
class SiteMapAssetView(APIView):
    """GET /api/v1/site-map-assets/<slot>/

    Returns 200 with ``{url, alt, credit, width, height}`` when the row has an
    image uploaded; 404 when the slot is unknown or the image is empty. The
    admin save hook invalidates the Next.js cache on upload.
    """

    permission_classes = [AllowAny]

    def get(self, request: HttpRequest, slot: str) -> HttpResponse:
        if slot not in SiteMapAsset.Slot.values:
            return Response(
                {"detail": "Unknown slot."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            asset = SiteMapAsset.objects.get(slot=slot)
        except SiteMapAsset.DoesNotExist:
            return Response(
                {"detail": "Slot not seeded."}, status=status.HTTP_404_NOT_FOUND
            )
        if not asset.image:
            return Response(
                {"detail": "No asset uploaded."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(
            {
                "url": request.build_absolute_uri(asset.image.url),
                "alt": asset.alt_text,
                "credit": asset.credit,
                "width": asset.expected_width_px,
                "height": asset.expected_height_px,
            }
        )
