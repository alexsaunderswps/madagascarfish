# Ideation — Key Biodiversity Area (KBA) overlay

**Raised by:** Alex, 2026-04-21 (post-Gate-1)
**Status:** Queued — post-ABQ

## The idea

Add a Key Biodiversity Area (KBA) polygon layer to the distribution map, so that for each species we can answer: *is this species' known range covered by an existing KBA?* The coordinator-facing prompt is **"which species live inside an active conservation area, and which fall outside every protection umbrella?"**

KBAs are a well-established global standard (the KBA Partnership / IUCN) for sites that contribute significantly to the global persistence of biodiversity. Many KBAs were designated on the basis of birds, plants, or mammals — the freshwater fish inside them are often passengers on protection designated for other taxa. A map showing fish-range × KBA-polygon intersection is a direct conservation-programming tool.

## Why it's high-value

- **Leverage existing programs.** If a microendemic fish lives inside a KBA designated for a lemur or a bird, there's already a conservation program in the area — possibly with staff, funding, and land access. The platform becomes a prompt: *this fish might benefit from being added to that program's scope.*
- **Gap analysis.** The inverse is equally important: a fish whose range sits entirely outside every KBA is a candidate for proposing a new KBA or for seeking fresh funding. The map visualizes that gap.
- **Aligns with SHOAL.** SHOAL's 1,000 Fishes Blueprint is partly about finding leverage points where freshwater fish can ride existing conservation infrastructure. This overlay operationalizes that thinking.

## Data source

The KBA Partnership publishes a global spatial dataset (boundaries + site metadata) via the **World Database of KBAs**. Access is free for non-commercial research and requires registration plus an attribution. Madagascar's KBA inventory is well-populated — likely ~100+ sites — covering a mix of terrestrial and freshwater systems.

Local cache pattern would mirror the existing **HyBAS watershed** import: pull once, store as a PostGIS model, re-import periodically. No runtime dependency on the KBA Partnership API.

## Architectural shape (sketch)

- New Django model `KeyBiodiversityArea` with a `PolygonField`, `site_name`, `iso_code`, `qualifying_species[]` (for context), `designation_date`, and a source URL.
- A management command `import_kba.py` reads a GeoPackage or Shapefile from the KBA Partnership and loads Madagascar-filtered polygons.
- New API endpoint `/api/v1/kbas/?bbox=...` returns a GeoJSON collection, same contract as the existing `/api/v1/localities/` feed.
- Frontend: `MapClient.tsx` gains a toggleable KBA layer (off by default; on via a map-controls panel). Polygon fill is deliberately soft so locality points remain the primary signal.
- Per-species roll-up on the profile: "This species is recorded inside *N* Key Biodiversity Areas: [list]." Computed as `ST_Intersects(locality.point, kba.polygon)` aggregated per species.

## Sequencing considerations

This is **post-ABQ work.** Pre-June 1 we need Gate 3 (coordinator dashboard) to be the demo centerpiece. A KBA overlay is additive — it would be excellent if ABQ's SHOAL conversation naturally leads to "what if we overlay existing protected-area data?" and we have it; but we should not delay Gate 3 to build it.

After ABQ, sequence:
1. Acquire the KBA dataset (registration + download).
2. Build the import pipeline (model + management command + fixture).
3. Add the map layer (toggleable, off by default).
4. Add per-species KBA roll-up on the profile.
5. Surface KBA-coverage status on the Gate 3 coverage-gap panel: "12 of 34 species in the coverage gap fall outside every KBA" — gap × gap, the highest-priority cohort.

## Related prior art

- `Watershed` model (HyBAS) — established pattern for mirrored global spatial data.
- `SpeciesLocality.drainage_basin_name` — precedent for annotating per-locality context computed on save.
- `ProtectedArea` model — already in the codebase as a WDPA mirror. WDPA ≠ KBA (WDPA is legal designation; KBA is biodiversity-driven), but the model shape and admin treatment are a close analogue and could be extended or paralleled.

## Decision point

Park as a **post-June-1 initiative.** Assign a gate number once the dashboard work is sequenced. Before starting, check whether the existing `ProtectedArea` (WDPA) model already covers enough of the use case to make a separate KBA model unnecessary — if 80 % of Madagascar KBAs overlap WDPA sites, WDPA may be the pragmatic layer to surface first.
