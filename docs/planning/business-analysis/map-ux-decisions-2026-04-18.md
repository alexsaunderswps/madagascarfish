# Map & Directory UX decisions — 2026-04-18

Captures the design decisions made during the 2026-04-18 working session
against the live staging site. Implementation spans PR #38 (UX polish) and a
follow-on fix for offshore locality records.

**Status:** Decisions locked. Implementation in `feat/map-ux-improvements`
(PR #38) and `fix/offshore-locality-quarantine` (pending).

---

## 1. Clear-filter affordance on `/map/`

**Problem:** When `?species_id=N` is set (from species profile or list-view
click-through), there was no in-UI way to return to the all-species map — users
had to hand-edit the URL.

**Decision:** Show a "Filtered to *X* · Clear" chip above the map whenever
`species_id` is present. Clear link resolves to `/map/` (preserving `view=list`
if the user is in list mode).

**Rationale:** Single-species view is a useful navigation target from profile
pages; making it a one-way trip was a friction trap. Chip pattern matches how
filter pills work in the species directory — consistent mental model.

## 2. Sortable columns in "View as list"

**Problem:** List view had 8 columns, none sortable. Users couldn't answer
"show me oldest records" or "group CR species together."

**Decision:** Seven of the eight columns are sortable (scientific name, IUCN,
locality, type, presence, water body, year). Source citation is not sorted
because the citation string has no meaningful sort order. IUCN sorts by
**severity** (CR → NE) rather than alphabetically, because alphabetic IUCN
sort ("CR, DD, EN…") is noise — severity is what users care about.

**Rationale:** Client-side sort (data is already loaded); no backend change
needed. Severity-first IUCN ordering matches how the rest of the platform
presents conservation data (dashboards, status charts).

## 3. Row-click navigation to focused locality

**Problem:** Clicking a list row did not take the user to that record on the
map. Clicking the scientific name sent them to the species profile
(potentially useful, but not what a user scanning the list expects).

**Decision:** Row background is clickable and navigates to
`/map/?species_id=X&focus_locality=Y`, which switches to the map view with
the map `flyTo`-zoomed to that locality. The scientific name cell retains its
link to `/species/[id]/` via `stopPropagation`, so both pathways exist.

**Rationale:** Preserves the existing species-profile pathway while giving the
more common "show me on the map" intent a single-click answer. The explicit
`focus_locality` query param is preferred over in-memory state so the focused
view is shareable/bookmarkable.

## 4. Cluster marker styling

**Problem:** Leaflet's default `markercluster` CSS was not loading, so
clusters rendered as bare numbers floating on the map — hard to read against
both OSM and satellite basemaps.

**Decision:** `.mffcp-cluster` CSS gives clusters a sky-700 @ 90% filled
circle with a 2px white border and a shadow. Sizes (32/40/48 px) scale with
cluster size. Added to `frontend/app/globals.css` alongside Tailwind layers.

**Rationale:** Clusters are the first visual language of the map at country
zoom — they have to read as tappable. Sky-700 matches the platform's primary
link/action color so clusters don't compete with IUCN-colored individual pins.

## 5. Introduced species hidden from directory by default

**Problem:** The Species Directory mixed *Oreochromis niloticus* (invasive
tilapia), *O. mossambicus*, and other introduced species into a list framed
as "Madagascar's endemic freshwater fish."

**Decision:** Default `/api/v1/species/` list response excludes records with
`endemic_status="introduced"`. Adding `?include_introduced=true` OR any
explicit `?endemic_status=…` filter bypasses the exclusion. Directory UI
surfaces a "Show introduced (exotic) species" checkbox. The retrieve endpoint
(`/api/v1/species/<id>/`) is unchanged — direct profile links work for any
species.

**Rationale:** The directory is a public artifact positioning Madagascar's
native fauna. Mixing in *Oreochromis* undermines the framing. But the data is
valuable — hobbyists and researchers studying invasion ecology need access.
Default-hide + explicit opt-in is the right compromise.

## 6. Offshore locality records — quarantine, not delete

**Problem:** Two seed records were visible as pins in the Indian Ocean, well
east of Madagascar's landmass:

- *Bedotia madagascariensis* at `49.910°E, -19.130°S` (GBIF:RDR0093,
  "Andriana") — ~165 km offshore.
- *Ptychochromis oligacanthus* at `50.983°E, -14.800°S` (AMNH 58491,
  "Nosy Be, Lake Amparihibe") — ~300 km east of Madagascar. Nosy Be is
  actually on the NW coast (~48.3°E); the coord is almost certainly a
  transcription error.

Neither is `is_sensitive=true`, so GBIF 0.1° generalization is not the
cause — these are source-data errors.

**Decision:**
- Do **not** delete the records. Preserve source data for later verification
  against the upstream institution (AMNH, GBIF publisher).
- Add `needs_review: bool` and `review_notes: text` fields to
  `SpeciesLocality`. The two offshore records are flagged
  `needs_review=true` with a note identifying the nature of the problem
  ("coordinates place point in open ocean east of Madagascar; source record
  needs re-verification").
- **Public map API excludes** `needs_review=true` records by default — users
  don't see pins in the ocean.
- **Django admin surfaces a filter** "Needs review" so an admin can work
  through the queue, correct or dismiss individual records, and lift the
  flag.
- **Loader bounds tightened:** `LNG_MAX` drops from `51.0` to `50.6` (the
  actual eastern extent of Madagascar, including near-shore islands). Future
  imports at the east edge will reject with a validation error rather than
  landing as coast-adjacent ocean points.

**Rationale:** The research principle here is data preservation — we don't
throw away source-institution records even when they're wrong; we flag them
for review. This mirrors the governance pattern already used for
`ConservationAssessment` (conflicts flagged, not silently overwritten). The
admin "needs checking" queue becomes a useful workflow artifact in itself
and a demonstration of data-integrity discipline when presenting to SHOAL.

## 7. About → Data-handling page

**Problem:** No public-facing explanation of how the platform sources data,
handles sensitive coordinates, or treats known source-data errors.

**Decision:** New page at `/about/data/`, linked from the About page.
Drafted by conservation-writer. Covers: data sources (IUCN, FishBase, GBIF,
CARES, SHOAL), mirror policy in plain English, coordinate generalization
rationale + the 0.1°/Tier-3 gate, known-limitations-and-how-we-handle-them
(including the "needs review" queue), what's not public, and Darwin Core /
GBIF alignment.

**Rationale:** Transparency serves two audiences — conservation partners
(SHOAL, IUCN reviewers) who want to understand the methodology, and the
general public who deserve to know how sensitive-species data is protected.
Bundling it as an About sub-page keeps it out of the primary nav while
making it trivially linkable from grants, talks, and external articles.

---

## Implementation references

- PR #38 — `feat/map-ux-improvements` — items 1-5 above.
- Pending branch `fix/offshore-locality-quarantine` — item 6 (migration +
  flag the two records + admin filter + loader bounds tightening).
- Pending branch `docs/data-handling-page` (conservation-writer) — item 7
  plus husbandry sourcing-ethics block.
- BA husbandry assessment: `docs/planning/business-analysis/species-profile-husbandry.md`
  — includes Aleksei's locked answers to the five open questions on husbandry
  scope, difficulty presentation, sourcing ethics, Contribute CTA
  (Django contact form, not Google Form), and reviewed-by identity
  (structured User FK).
