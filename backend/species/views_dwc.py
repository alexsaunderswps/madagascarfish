"""Public Darwin Core Archive endpoints (Gate 15).

Three URLs serve the platform's GBIF-publishable dataset:

    GET /api/v1/dwc/archive.zip   — full DwC-A (eml.xml + meta.xml + occurrence.txt)
    GET /api/v1/dwc/occurrence.txt — bare TSV (handy for preview / debugging)
    GET /api/v1/dwc/eml.xml        — dataset metadata only

All three are unauthenticated — published data is public by definition.
Coordinate generalization for IUCN-threatened species is applied by the
`integration.darwincore` module before the response leaves the server.

Caching: each response sets `Cache-Control: public, max-age=3600` so a
GBIF IPT polling once an hour can ride a CDN. Set to ``no-cache`` if a
data fix needs immediate visibility.
"""

from __future__ import annotations

from django.http import HttpRequest, HttpResponse
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_GET

from integration.darwincore import (
    build_archive_bytes,
    published_localities_queryset,
    render_eml_xml,
    render_occurrence_tsv,
)
from integration.darwincore import locality_to_dwc_row as _locality_to_dwc_row

_CACHE_SECONDS = 3600


@require_GET
@cache_control(public=True, max_age=_CACHE_SECONDS)
def archive_zip(_request: HttpRequest) -> HttpResponse:
    body = build_archive_bytes()
    response = HttpResponse(body, content_type="application/zip")
    response["Content-Disposition"] = 'attachment; filename="mffcp-occurrences.zip"'
    response["Content-Length"] = str(len(body))
    return response


@require_GET
@cache_control(public=True, max_age=_CACHE_SECONDS)
def occurrence_tsv(_request: HttpRequest) -> HttpResponse:
    qs = published_localities_queryset()
    rows = [_locality_to_dwc_row(loc) for loc in qs.iterator()]
    body = render_occurrence_tsv(rows)
    return HttpResponse(body, content_type="text/tab-separated-values; charset=utf-8")


@require_GET
@cache_control(public=True, max_age=_CACHE_SECONDS)
def eml_xml(_request: HttpRequest) -> HttpResponse:
    qs = published_localities_queryset()
    body = render_eml_xml(record_count=qs.count())
    return HttpResponse(body, content_type="application/xml; charset=utf-8")
