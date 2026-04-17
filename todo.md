# TODO

## Conservation status governance spec (follow-up to gate 06)

**Status:** 🟡 Awaiting BA/PM spec. Partial implementation landed in gate 06
(`ALLOW_IUCN_STATUS_OVERWRITE` setting + mirror in `iucn_sync` + CLAUDE.md
"Conservation status sourcing" convention). The remaining pieces need
requirements work before implementation.

**Goal:** guarantee that `Species.iucn_status` is always traceable to an
authoritative or human-reviewed source, with audit logging and an explicit
conflict-resolution path when manual assessments disagree with IUCN.

### Remaining scope (needs BA/PM)

- **Audit log infrastructure** — every change to `Species.iucn_status` and to
  any `ConservationAssessment` row records actor, action, before/after,
  timestamp. Candidate approaches: `django-simple-history`, `django-auditlog`,
  or a hand-rolled `AuditEntry` model. Decision needed on scope (which models
  get tracked) and retention.
- **Blocking warning on external-source contradiction** — two enforcement
  points:
  1. Admin form validator when an operator tries to set
     `Species.iucn_status` directly (the mirror policy in CLAUDE.md forbids
     this; we should enforce it in the UI too).
  2. Pre-publish check in the GBIF / Darwin Core Archive export pipeline
     (gate 08+) that refuses to publish if the species-level status
     disagrees with the latest accepted `iucn_official` assessment.
- **Inverse pending-review signal** — when `iucn_sync` pulls a category that
  disagrees with an existing `manual_expert` assessment on the same species,
  flag *that row* as `pending_review` and create an alert for a coordinator,
  rather than silently accepting the IUCN one alongside it.
- **Add `manual_expert` source to `ConservationAssessment.Source`** — currently
  only `iucn_official` and `recommended_revision` exist. Needed so that
  operator edits have a canonical source tag instead of being untracked
  `Species.iucn_status` writes.

### Next action

Invoke `@business-analyst` with this scope → then `@product-manager` for
gate-level breakdown and acceptance criteria. Do **not** implement before spec
is reviewed — audit infrastructure touches every model and is expensive to
retrofit if we pick the wrong approach.

---

## Reconcile canonical watershed basin names

**Status:** ✅ MVP target met — 21 of 50 root basins named in
`backend/species/basins.py::CANONICAL_BASIN_NAMES` (53 of 82 polygons
covered once sub-basins inherit). All five biogeographic regions have
at least one named anchor.

**Remaining work** (optional polish before gate 07 ships the frontend map):
7 candidates from the original list still need matching to HYBAS_IDs.
None of them are blockers; their polygons currently render with the
coordinate-tagged fallback (e.g., `"Basin near 22.57°S 43.93°E"`).

### Candidate name list

| Basin | Region | Reference area | Status |
|-------|--------|---------------:|--------|
| Betsiboka | NW | 49,000 | ✅ named (1060036860) |
| Mangoky | SW | 55,750 | ✅ named (1060035590) |
| Tsiribihina | W | 49,800 | ✅ named (1060036020) |
| Onilahy | SW | 32,000 | ✅ named (1060035400) |
| Sofia | NW | 27,315 | ✅ named (1060037100) |
| Mangoro | E | 17,175 | ✅ named (1060038860) |
| Mahajamba | NW | 14,600 | ✅ named (1060037110) |
| Maningory (incl. Lake Alaotra) | NE | 12,645 | ✅ named (1060038850) |
| Manambolo | W | 13,970 | ✅ named (1060036120) |
| Mandrare | S | 12,435 | ✅ named (1060040000) |
| Mahavavy (Sud) | W | 14,000 | ✅ named (1060036750) |
| Mananara (Sud) | SE | 10,500 | ✅ named (1060039740) |
| Fiherenana | SW (Toliara) | 7,900 | ✅ named (1060035410) |
| Menarandra | Deep S | 8,350 | ✅ named (1060035180) |
| Manambovo | Deep S | 5,700 | ✅ named (1060040020) |
| Mananjary | E | 6,100 | ✅ named (1060039260) |
| Faraony | E | 3,800 | ✅ named (1060039470) |
| Namorona (Ranomafana NP) | E | 2,300 | ✅ named (1060039460) |
| Matitanana | SE | 4,395 | ✅ named (1060039620) |
| Mahavavy-Nord | N | 5,800 | ✅ named (1060037310) |
| Bemarivo (Nord, Sava) | NE | 5,400 | ✅ named (1060038200) |
| Linta | Deep S | 6,500 | 🔍 unmatched |
| Rianila | E (Toamasina) | 7,820 | 🔍 unmatched |
| Ivondro | E (Toamasina) | 2,600 | 🔍 unmatched |
| Sambirano (Nosy Be hinterland) | NW | 2,980 | 🔍 unmatched |
| Lokoho (Masoala) | NE | 3,200 | 🔍 unmatched |
| Mananjeba | Far N | 2,500 | 🔍 unmatched |
| Ankofia | NW | 4,500 | 🔍 unmatched |

**Name-variant caveats to preserve when labelling:**
- Onilahy, not Onihaly (colonial spelling)
- Always qualify the two Mahavavys: `Mahavavy-Nord` vs `Mahavavy-Sud`
- Always qualify the two Mananaras: `Mananara-Nord` (small NE) vs `Mananara-Sud`
- Prefer `Betsiboka` for the outlet polygon, not `Ikopa` (Ikopa is a
  tributary)

### Reconciliation steps

1. **Dump the unnamed basins with their outlet centroids.** Run:
   ```bash
   docker compose exec -T web python manage.py shell -c "
   from species.models import Watershed
   for w in Watershed.objects.filter(name__startswith='Basin near').order_by('-area_sq_km'):
       c = w.geometry.centroid
       print(f'{w.hybas_id},{w.area_sq_km},{c.y:.4f},{c.x:.4f}')
   " > unnamed_basins.csv
   ```
   Columns: `hybas_id, area_sq_km, centroid_lat, centroid_lng`.

2. **Visually match each row to a named river basin.** Easiest path is
   dropping `backend/staticfiles/map-layers/watersheds.geojson` into
   [geojson.io](https://geojson.io) alongside a reference map:
   - [FAO hydrological basins of Africa](https://data.apps.fao.org/catalog/iso/e54e2014-d23b-402b-8e73-c827628d17f4)
     (authoritative polygon + name layer)
   - [OpenStreetMap waterways overlay](https://www.openstreetmap.org/)
     — rivers are labelled, follow them upstream from the coast.
   - [Freshwater Ecoregions of the World — Madagascar](https://feow.org/ecoregions/details/581)
     — fish-biogeography-aligned, matches this project's priorities.

   For each unnamed polygon: click the polygon in geojson.io, note the
   `HYBAS_ID` from properties, trace its outlet to the coast on the
   reference map, record the river name.

3. **Cross-check against the candidate list above.** If the area
   roughly matches (within ~2×) one of the 🔍 unmatched rows, use that
   name. If no match, the polygon may be an unnamed coastal stretch —
   leave it on the fallback label.

4. **Add entries to `backend/species/basins.py`**:
   ```python
   CANONICAL_BASIN_NAMES: dict[int, str] = {
       1060036860: "Betsiboka",
       # ...existing...
       106xxxxxxx: "Mandrare",
       106xxxxxxx: "Mahavavy-Nord",
   }
   ```

5. **Re-run the pipeline** (no code change, no migration):
   ```bash
   docker compose exec -T web python manage.py load_reference_layers \
       --watersheds /data/reference/hydrobasins_madagascar_lev06.shp
   docker compose exec -T web python manage.py generate_map_layers \
       --output-dir /app/staticfiles/map-layers/
   ```

6. **Spot-check in Django admin** that sub-basins correctly pick up
   "Sub-basin of <NewName>" and `parent_basin` FKs point at the right
   root row.

### Authoritative sources (from the research agent)

- Rakotoarisoa, M. et al. (2022). *Water* 14(3):449.
  https://www.mdpi.com/2073-4441/14/3/449 — the citable "12 major
  basins" reference.
- Aldegheri (ORSTOM/IRD). *Rivers and Streams on Madagascar.*
  https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/b_fdi_30-30/32882.pdf
  — foundational French-era gazetteer with basin areas.
- FAO AQUASTAT — Madagascar country profile.
  https://www.fao.org/aquastat/en/countries-and-basins/country-profiles/country/MDG/
- FAO *Hydrological basins in Africa* (polygon layer with names).
  https://data.apps.fao.org/catalog/iso/e54e2014-d23b-402b-8e73-c827628d17f4
- FEOW Madagascar 581.
  https://feow.org/ecoregions/details/581

### Cutoff recommendation

Research agent suggested **25 basins** as the right public-map cutoff —
covers all five biogeographic regions without overloading labels at
national zoom. Beyond 30 is diminishing returns (basins <2,000 km²,
unfamiliar names).
