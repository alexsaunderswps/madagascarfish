# TODO

## Wire up `malagasyfishes.org` (public URL — decided 2026-04-19)

**Decision:** Public URL is `malagasyfishes.org`. Staging remains
`api.malagasyfishes.org` (already live). Frontend production alias
needs to be `malagasyfishes.org` → Vercel, with `www` as an alias.

**Remaining work (owner: Aleksei):**
- [ ] Register `malagasyfishes.org` at a registrar (Namecheap / Cloudflare)
- [ ] Point DNS: apex `A`/`ALIAS` + `www` `CNAME` → Vercel; keep
      `api.malagasyfishes.org` `A` → Hetzner VPS
- [ ] Add the domain in Vercel project settings, verify ownership
- [ ] Update `CSRF_TRUSTED_ORIGINS` / `ALLOWED_HOSTS` in backend prod
      settings to include `malagasyfishes.org` + `www.malagasyfishes.org`
      if the frontend will ever POST to the backend from either origin
- [ ] Update About page's GitHub/admin links if we want a custom
      apex for admin (optional — `api.malagasyfishes.org/admin/` works)
- [ ] Update any references in arch docs + conservation-writer copy
      that assumed `madagascarfish.vercel.app`

Blocker for: SHOAL/ECA pre-workshop email, printed handouts at ABQ
BioPark June 1–5. Needs to land well before 2026-05-15.

## Ship-before-workshop (ECA Workshop, 2026-06-01)

From the *Paretroplus menarambo* UX review (2026-04-19).

- ✅ Silhouette SVG empty-state on profile — custom per-species slot now on
  `Species.silhouette_svg`, generic cichlid fallback otherwise.
- ✅ External References promoted above Field Programs when Field Programs is
  empty (close on outbound signal).
- ✅ Difficulty Factors Option A — profile callout at ≥3 factors + husbandry
  page `<details>` progressive disclosure.
- ✅ Husbandry breadcrumb reads "← Back to *{binomial}*".
- ✅ Mobile pass on husbandry at 375px (PR #111).
- ⏳ **Author custom silhouette SVGs for priority species** (Alex).
  Form lives in Species admin now; paste inline `<svg>…</svg>` with
  `currentColor` fills. Start with *P. menarambo*, then other CARES/SHOAL.

## Post-workshop backlog

From the UX review:

- ✅ Sticky in-page TOC on husbandry wide-screens (PR #111).
- Right-rail Difficulty Factors sidebar (Option B) — revisit if the inline
  list still feels heavy after real users test the page.
- Iconography Difficulty Factors (Option C) — only with a designer.
- ✅ Prioritization score + CARES/SHOAL chips on the profile header
  (already shipped — `BasinPill` chips at lines 361–366 of species
  profile; todo.md note was stale).
- ✅ Narrative first-paragraph lede treatment when narrative > ~400 words
  (already shipped — see husbandry page.tsx `wordCount > 400` branch).
- ✅ Sparse-data amber bar + emphasized-teaser accent border conflict —
  moot in current code: `HusbandryTeaser` component exists but is not
  imported on the species profile, so the overlap can't happen today.
  Re-evaluate if/when the emphasized teaser is wired in.
- ✅ "View on Map" button — already lives in the body Distribution box,
  not the header; the todo note was stale.
- ✅ Disclaimer slab line-break — already a two-paragraph block in
  `HusbandryDisclaimer.tsx`; the todo note was stale.
- Silhouette **scale bar** — reintroduce alongside calibrated per-species
  SVG story when ready (removed 2026-04-19).

## Conservation status governance (follow-up to gate 06)

**Status:** 🟢 BA + PM spec complete. Substantial implementation already
landed; reconciliation pass needed (see "What's still open" below).

**Goal:** guarantee that `Species.iucn_status` is always traceable to an
authoritative or human-reviewed source, with audit logging and an explicit
conflict-resolution path when manual assessments disagree with IUCN.

### Existing planning artifacts

- BA assessment: `docs/planning/business-analysis/conservation-status-governance.md`
- PM gate spec: `docs/planning/specs/gate-06-governance-follow-up.md`

### What's already shipped

A re-audit on 2026-04-26 found these pieces are in code:

- `audit/` Django app (`AuditEntry` model, signal handlers,
  `audit_actor` thread-local context manager, admin) — wired into
  `iucn_sync` and `species/admin.py`.
- `ConservationAssessment.Source.MANUAL_EXPERT` enum value, `created_by`
  FK, `iucn_assessment_id`, `last_sync_job` FK,
  `conflict_acknowledged_assessment_ids` JSONField.
- `ConservationStatusConflict` model with the four resolution outcomes
  (`accepted_iucn` / `retained_manual` / `reconciled` / `dismissed`).
- `tests/test_audit_entry.py`, `tests/test_audit_signals.py`,
  `tests/test_iucn_sync_conflict.py`, `tests/test_iucn_sync_audit.py`,
  `tests/test_manual_expert_admin.py` — all green on main.

### What's still open

Confirm by walking the gate-06b spec deliverables list against what's in
the code; suspected remaining items:

- **Pre-publish check on GBIF / Darwin Core Archive export pipeline**
  (BA Req 3b) — explicitly deferred to gate 08+ when the export pipeline
  itself is built.
- **Public badge attribution string** ("Expert review — {assessor}")
  truncation rules and multi-assessor formatting — open question per the
  BA, blocking gate 07 polish.
- **`assessment_id` stability probe** (gate-06b decision 8) — has the
  IUCN sync been validated against IUCN's `assessment_id` semantics with
  the composite-key fallback (`iucn_taxon_id`, `year_published`,
  `category`)? If not, conflict acknowledgement may be brittle.
- **`conflict_acknowledged_assessment_ids` admin protection** — must be
  read-only in admin or a coordinator could silently silence future
  conflicts. Verify the admin registration honors this.

### Next action

A PM reconciliation pass is needed: walk the gate-06b deliverables list,
mark already-landed items as done, and re-anchor the remaining work into
a smaller follow-up gate (or fold into gate 07 polish). Not workshop-
critical. Defer until after ABQ unless one of the open items above
becomes a workshop-relevant blocker.

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
