# TODO

## Ship-before-workshop (ECA Workshop, 2026-06-01)

From the *Paretroplus menarambo* UX review (2026-04-19).

- ✅ Silhouette SVG empty-state on profile — custom per-species slot now on
  `Species.silhouette_svg`, generic cichlid fallback otherwise.
- ✅ External References promoted above Field Programs when Field Programs is
  empty (close on outbound signal).
- ✅ Difficulty Factors Option A — profile callout at ≥3 factors + husbandry
  page `<details>` progressive disclosure.
- ✅ Husbandry breadcrumb reads "← Back to *{binomial}*".
- ⏳ **Mobile pass on husbandry at 375px** — verify at-a-glance labels
  ("CARES registered breeders" is the likely wrap offender) and governance
  footer don't wrap ugly. Fix what breaks.
- ⏳ **Author custom silhouette SVGs for priority species** (Alex).
  Form lives in Species admin now; paste inline `<svg>…</svg>` with
  `currentColor` fills. Start with *P. menarambo*, then other CARES/SHOAL.

## Post-workshop backlog

From the UX review:

- Sticky in-page TOC on husbandry wide-screens (twelve h2s, reader can't
  jump to Breeding without scrolling past six sections).
- Right-rail Difficulty Factors sidebar (Option B) — revisit if the inline
  list still feels heavy after real users test the page.
- Iconography Difficulty Factors (Option C) — only with a designer.
- Prioritization score + CARES/SHOAL chips surfaced in the profile header
  (currently only on the husbandry teaser).
- Narrative first-paragraph lede treatment when narrative > ~400 words.
- Double-check the sparse-data amber bar + emphasized-teaser accent border
  don't both render on the same profile.
- "View on Map" button competes with the IUCN badge in the header — consider
  moving below the taxonomic line.
- Disclaimer slab — line-break after "conditions vary between systems,
  regions, and individual fish" for scannability.
- Silhouette **scale bar** — reintroduce alongside calibrated per-species
  SVG story when ready (removed 2026-04-19).

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
- **Add `manual_expert` source to `ConservationAssessment.Source`** —
  currently only `iucn_official` and `recommended_revision` exist. Needed so
  that operator edits have a canonical source tag instead of being untracked
  `Species.iucn_status` writes.

### Next action

Invoke `@business-analyst` with this scope → then `@product-manager` for
gate-level breakdown and acceptance criteria. Do **not** implement before
spec is reviewed — audit infrastructure touches every model and is expensive
to retrofit if we pick the wrong approach.

---

## Reconcile canonical watershed basin names (polish, not a blocker)

**Status:** ✅ MVP target met — 21 of 50 root basins named in
`backend/species/basins.py::CANONICAL_BASIN_NAMES`. All five biogeographic
regions have at least one named anchor. Remaining 7 candidates currently
render with a coordinate-tagged fallback (e.g., `"Basin near 22.57°S
43.93°E"`). None are blockers.

### Unmatched candidates

| Basin | Region | Reference area |
|-------|--------|---------------:|
| Linta | Deep S | 6,500 |
| Rianila | E (Toamasina) | 7,820 |
| Ivondro | E (Toamasina) | 2,600 |
| Sambirano (Nosy Be hinterland) | NW | 2,980 |
| Lokoho (Masoala) | NE | 3,200 |
| Mananjeba | Far N | 2,500 |
| Ankofia | NW | 4,500 |

**Name-variant caveats to preserve when labelling:**
- Onilahy, not Onihaly (colonial spelling)
- Always qualify the two Mahavavys: `Mahavavy-Nord` vs `Mahavavy-Sud`
- Always qualify the two Mananaras: `Mananara-Nord` (small NE) vs `Mananara-Sud`
- Prefer `Betsiboka` for the outlet polygon, not `Ikopa` (Ikopa is a
  tributary)

### Reconciliation recipe

1. Dump unnamed basins with centroids:
   ```bash
   docker compose exec -T web python manage.py shell -c "
   from species.models import Watershed
   for w in Watershed.objects.filter(name__startswith='Basin near').order_by('-area_sq_km'):
       c = w.geometry.centroid
       print(f'{w.hybas_id},{w.area_sq_km},{c.y:.4f},{c.x:.4f}')
   " > unnamed_basins.csv
   ```

2. Visually match each row to a named river basin via geojson.io + FAO /
   OSM / FEOW references below.

3. Add entries to `backend/species/basins.py::CANONICAL_BASIN_NAMES`.

4. Re-run pipeline (no code change, no migration):
   ```bash
   docker compose exec -T web python manage.py load_reference_layers \
       --watersheds /data/reference/hydrobasins_madagascar_lev06.shp
   docker compose exec -T web python manage.py generate_map_layers \
       --output-dir /app/staticfiles/map-layers/
   ```

### Authoritative sources

- Rakotoarisoa, M. et al. (2022). *Water* 14(3):449.
  https://www.mdpi.com/2073-4441/14/3/449
- Aldegheri (ORSTOM/IRD). *Rivers and Streams on Madagascar.*
  https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/b_fdi_30-30/32882.pdf
- FAO AQUASTAT — Madagascar: https://www.fao.org/aquastat/en/countries-and-basins/country-profiles/country/MDG/
- FAO hydrological basins of Africa: https://data.apps.fao.org/catalog/iso/e54e2014-d23b-402b-8e73-c827628d17f4
- FEOW Madagascar 581: https://feow.org/ecoregions/details/581
