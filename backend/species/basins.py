"""Canonical names for Madagascar's major drainage basins.

Keyed on HydroBASINS ``MAIN_BAS`` — the HYBAS_ID of the root polygon that
represents the basin's outlet. A HydroBASINS level-6 polygon group shares
a single MAIN_BAS, so naming by MAIN_BAS labels every sub-polygon at once.

Source: Rakotoarisoa et al. (2022) "Analysis of River Basin Management in
Madagascar" (Water 14(3):449) and Aldegheri (ORSTOM) hydrological
gazetteer. Area and outlet centroid matched against the clipped
HydroBASINS Madagascar level-6 shapefile in data/reference/.

Entries here are high-confidence only; additional named basins can be
layered in via operator CSV override without code change once we have the
next tier of name↔outlet correspondences confirmed.
"""

from __future__ import annotations

CANONICAL_BASIN_NAMES: dict[int, str] = {
    1060036860: "Betsiboka",
    1060035590: "Mangoky",
    1060036020: "Tsiribihina",
    1060035400: "Onilahy",
    1060037100: "Sofia",
    1060038860: "Mangoro",
}


def basin_display_name(main_bas: int, hybas_id: int, outlet_lng: float, outlet_lat: float) -> str:
    """Return a human-readable name for a watershed polygon.

    The root polygon (``hybas_id == main_bas``) gets the canonical basin
    name if known, otherwise a coordinate-tagged fallback. Sub-polygons
    get ``"Sub-basin of <canonical>"`` when the root is named, otherwise
    a coordinate-tagged fallback of their own.
    """
    canonical = CANONICAL_BASIN_NAMES.get(main_bas)
    is_root = hybas_id == main_bas

    if canonical:
        return canonical if is_root else f"Sub-basin of {canonical}"

    lat_str = f"{abs(outlet_lat):.2f}°S"
    lng_str = f"{outlet_lng:.2f}°E"
    return f"Basin near {lat_str} {lng_str}"
