# BA Analysis: Interactive Conservation Map

**Date:** 2026-04-15
**Status:** Draft -- Open questions resolved 2026-04-15; ready for PM review
**Analyst:** Business Analyst Agent
**Input Documents:** Architecture Proposal (`docs/planning/architecture/conservation-map-proposal.md`), BA Assessment v1, Gate 07 Spec, Species Seed CSV
**Context:** Architecture Agent has proposed spatial data model, API endpoints, and gate impact for a `/map/` page. This analysis validates requirements, defines acceptance criteria, and draws the MVP boundary.

---

## 1. Feature Validation

**Verdict: YES, this belongs in MVP, but it is the highest-risk addition to Gate 07 and the data dependency is the primary constraint.**

### Why It Belongs

1. **Workshop impact.** A map of Madagascar showing species localities is the single most visually compelling demonstration artifact for the ECA Workshop. Species directories and dashboards are useful but abstract. A map immediately communicates geographic context -- where species are found, how restricted their ranges are, and how those ranges relate to protected areas. For a workshop audience of conservation professionals, this is the "show, don't tell" feature.

2. **Alignment with value proposition.** The BA assessment v1 defines the platform's unique value as "the single place where you can see every Malagasy freshwater fish species." A map is the natural spatial complement to the species directory -- the directory answers "what species exist?" and the map answers "where are they?"

3. **Data model is well-designed.** The architecture proposal's `SpeciesLocality`, `Watershed`, and `ProtectedArea` models are sound. The `coordinate_precision` field is a particularly strong design choice for a dataset with heterogeneous quality. The FK from locality to watershed is the right approach for the "species in this basin" query.

4. **Technical feasibility.** Data volumes are small (300-800 points, 60-100 watershed polygons, 120-160 PA polygons). Leaflet is a mature, lightweight library. The lazy-loading strategy for reference layers is appropriate.

### Why It Is Risky

1. **The localities CSV does not exist yet.** The map has no data to display. The architecture proposal's Section 8 outlines a data sourcing strategy, but the project lead must compile the CSV from multiple heterogeneous sources (GBIF, type descriptions, published literature, field reports). This is a research and data curation task that runs parallel to development -- and it is on the critical path. If the CSV is not ready, the map page is an empty shell.

2. **Gate 07 scope is already aggressive.** Gate 07 currently delivers three pages (species directory, species profile, dashboard) plus navigation, SSR/SSG, deployment, and verification agent reviews -- all in approximately 7 weeks before the June 1 deadline. Adding a fourth page that is the "most complex single page in Gate 07" (per the architecture proposal) increases delivery risk significantly.

3. **Reference layer data sourcing has its own dependencies.** HydroSHEDS and WDPA data must be downloaded, filtered to Madagascar, simplified, loaded, and named. This is not hard but it is a sequence of manual data processing steps that must happen before the map can render anything beyond points.

---

## 2. User Stories with Acceptance Criteria

### MAP-01: Public User Explores Species Distribution

**As** a workshop attendee or public visitor,
**I want** to see a map of Madagascar showing where freshwater fish species have been recorded,
**so that** I can understand the geographic distribution of this species group.

**Page:** `/map/`
**Rendering:** CSR (client-side rendering; map interactions are inherently client-side)

**Acceptance Criteria:**

**Given** a user visiting `/map/`
**When** the page loads
**Then** a Leaflet map renders centered on Madagascar (approximately -18.9, 47.5, zoom 6) with OpenStreetMap tiles as the default base layer; species locality point markers are visible; the map statistics bar shows "X localities for Y species"

**Given** a user visiting `/map/` and the localities API returns zero records
**When** the page loads
**Then** the map renders with the Madagascar base map and no point markers; the statistics bar shows "0 localities for 0 species"; no error state is displayed; a message reads "Locality data is being compiled -- check back soon" (graceful empty state, not a broken page)

**Given** a user visiting `/map/` and the localities API is unreachable
**When** the page loads
**Then** the base map still renders (tiles are from OpenStreetMap CDN, not the application API); an inline error message appears indicating "Species locality data temporarily unavailable"; layer toggles for watersheds and protected areas remain functional if their static files loaded

### MAP-02: Workshop Attendee Clicks Watershed to See Species

**As** a workshop attendee exploring the map,
**I want** to click on a watershed polygon to see which species have been recorded in that drainage basin,
**so that** I can understand the species assemblage of a given river system.

**Acceptance Criteria:**

**Given** a user with the "Watersheds" layer toggled on
**When** they click on a watershed polygon (e.g., Betsiboka)
**Then** a popup or sidebar panel displays: the watershed name, area in km2, and a list of species with localities in that watershed (species name as link to `/species/{id}/`, IUCN status badge, count of localities in this basin); the list is derived from the already-loaded locality data filtered client-side by `drainage_basin` FK

**Given** a user clicks on a watershed polygon that has no species localities assigned to it
**When** the popup renders
**Then** it shows the watershed name, area, and "No species locality records in this basin" -- not an error, not an empty panel

**Given** a user clicks on an unnamed watershed (HydroBASINS feature with no human-readable name)
**When** the popup renders
**Then** the name displays as "Sub-basin of [parent basin name]" or "Basin [Pfafstetter code]" -- never blank, never "null"

### MAP-03: User Toggles Layers to Compare Localities vs. Protected Areas

**As** a conservation professional,
**I want** to toggle the protected areas layer on alongside species localities,
**so that** I can visually assess how well species localities fall within or outside protected areas.

**Acceptance Criteria:**

**Given** a user viewing the map with species localities visible
**When** they toggle the "Protected Areas" layer on
**Then** protected area polygons render as a semi-transparent overlay that does not obscure the locality point markers beneath; locality markers remain clickable through the polygon overlay

**Given** a user with both the "Watersheds" and "Protected Areas" layers toggled on simultaneously
**When** both layers render
**Then** the layers use distinct visual styling (different colors, different opacity, different border styles) so they are visually distinguishable when overlapping; locality point markers render above both polygon layers

**Given** a user toggling a reference layer on for the first time
**When** the static GeoJSON file is loading (2-15 MB)
**Then** a loading indicator appears on the layer toggle control; the map remains interactive during loading; once loaded, the layer appears without page reload

**Given** a user on a slow connection (simulated 3G)
**When** they toggle the protected areas layer on
**Then** a loading state is visible for up to 10-15 seconds; the map does not freeze; the user can cancel by toggling the layer off before loading completes

### MAP-04: User Clicks Species Point to Navigate to Profile

**As** a visitor exploring the map,
**I want** to click a species locality marker and then navigate to that species' full profile,
**so that** I can learn more about a species I discovered geographically.

**Acceptance Criteria:**

**Given** a user clicks on a species locality marker
**When** the popup opens
**Then** it displays: scientific name (italic), IUCN status badge, locality name, locality type (e.g., "Type Locality"), presence status, water body name, year collected (if available), source citation, and coordinate precision indicator; the scientific name is a clickable link

**Given** a user clicks the scientific name link in the popup
**When** the click is registered
**Then** the user is navigated to `/species/{id}/` for that species

**Given** multiple locality markers overlap at the same location or are clustered at the current zoom level
**When** the user clicks on the cluster
**Then** the map zooms in to reveal individual markers (Leaflet.markercluster standard behavior); individual markers become clickable at sufficient zoom

### MAP-05: User Visually Distinguishes Type Localities

**As** a taxonomist or conservation coordinator,
**I want** type localities to be visually distinct from other collection records on the map,
**so that** I can immediately identify the original description locality for each species.

**Acceptance Criteria:**

**Given** a species has both a type locality and other collection records displayed on the map
**When** the user views the map at a zoom level where both are visible
**Then** the type locality marker has a distinct visual treatment -- specifically, a star or diamond shape or a prominent border/outline that differentiates it from the standard circle markers used for other locality types; both marker types are explained in the legend

**Given** an undescribed morphospecies (e.g., *Bedotia* sp. 'manombo') has locality records
**When** those records are displayed on the map
**Then** none of the records use the type locality marker style, because undescribed morphospecies do not have formal type localities; records use the standard `collection_record`, `literature_record`, or `observation` marker styles

**Given** the user views the map legend
**When** the legend renders
**Then** it includes: (1) a color key for IUCN status (CR=red, EN=orange, VU=yellow, NT=near-green, LC=green, DD=gray, NE=light gray), (2) a shape key for locality type with type_locality visually distinct, (3) a fill/outline key for presence status (solid=present, hollow=extirpated, dashed=unknown, distinct marker for reintroduced)

### MAP-06: User Identifies Extirpated vs. Present Localities

**As** a conservation professional,
**I want** to see at a glance which localities represent current vs. historical (extirpated) presence,
**so that** I can assess range contraction for threatened species.

**Acceptance Criteria:**

**Given** a species has localities with `presence_status = "present"` and `presence_status = "historically_present_extirpated"`
**When** both are visible on the map
**Then** present localities use solid-fill markers; extirpated localities use hollow (outline-only) markers or a cross-through symbol; the difference is immediately perceptible without clicking

**Given** a user filters by `presence_status = "historically_present_extirpated"` using the filter panel
**When** the filter is applied
**Then** only extirpated localities are shown; the statistics bar updates to reflect the filtered count; the filter state is reflected in URL query parameters (shareable link)

**Given** a species like *Ptychochromis onilahy* that is IUCN Extinct
**When** its localities appear on the map
**Then** all its localities display with the extirpated marker style (hollow/crossed); clicking a marker popup shows presence_status = "historically_present_extirpated"

### MAP-07: Cross-Page Linking from Species Directory to Map

**As** a user browsing the species directory,
**I want** to click a "View on Map" link for a species and see its localities highlighted on the map,
**so that** I can quickly navigate from taxonomic browsing to geographic exploration.

**Acceptance Criteria:**

**Given** a user viewing a species profile at `/species/{id}/`
**When** the species has at least one locality record in the database
**Then** a "View on Map" button or link is visible on the profile page

**Given** a user clicks "View on Map" on the profile for *Pachypanchax sakaramyi*
**When** the map page loads
**Then** the URL is `/map/?species_id={id}`; the map is filtered to show only that species' localities; the map auto-zooms to fit the extent of that species' locality points; the filter panel reflects the active species filter; the statistics bar shows "X localities for Pachypanchax sakaramyi"

**Given** a user viewing a species profile for a species with ZERO locality records
**When** the profile renders
**Then** the "View on Map" button is either absent or disabled with a tooltip "No locality data available for this species"; the user is not sent to an empty map page

**Given** a user arrives at `/map/?species_id=9999` (nonexistent species)
**When** the map page loads
**Then** the map renders with all localities (no filter applied); an inline notice reads "Species not found -- showing all localities"; no error page, no crash

### MAP-08: Mobile/Tablet Viewport Behavior

**As** a workshop attendee viewing the map on a tablet,
**I want** the map to be usable on a tablet-sized screen,
**so that** I can explore species distribution during a workshop session without a laptop.

**Acceptance Criteria:**

**Given** a user on a tablet (viewport 768-1024px width)
**When** the map page loads
**Then** the map fills the available viewport; the filter panel is collapsible (not permanently visible, eating screen space); the layer toggle panel is compact; marker popups fit within the viewport without requiring horizontal scroll

**Given** a user on a mobile phone (viewport < 768px)
**When** the map page loads
**Then** the map renders at full viewport width and at least 60% viewport height; the filter panel is accessible via a button/drawer (not visible by default); the statistics bar collapses to essential info only; touch gestures (pinch zoom, pan) work correctly

**Given** a user taps a cluster of markers on a tablet
**When** the tap registers
**Then** the cluster expands or zooms in (same as desktop click behavior); individual marker popups are tap-accessible

**Given** a user on a tablet with the filter panel open
**When** they select a family filter
**Then** the filter applies immediately; the map updates; the filter panel remains open for additional filter selections (not auto-closing after each filter change)

---

## 3. MVP Boundary Definition

### IN SCOPE for MVP

| Item | Rationale |
|------|-----------|
| `/map/` standalone page with Leaflet | Core deliverable for workshop |
| SpeciesLocality point markers (color by IUCN, shape by type, fill by presence) | Primary data layer |
| Watershed polygon overlay (toggleable) | Enables "species in this basin" narrative |
| Protected area polygon overlay (toggleable) | Enables gap analysis visual |
| Layer toggle panel | Essential UX for multi-layer map |
| Filter panel (family, IUCN status, locality type, presence status, watershed) | Enables focused exploration |
| Marker popups with species link | Navigation pathway to profiles |
| Legend (IUCN colors, locality types, presence status) | Map is unreadable without this |
| Map statistics bar (locality/species counts) | Context for what the user is seeing |
| Switchable base layers (OpenStreetMap + ESRI satellite) | Confirmed in architecture proposal |
| Cross-page link: "View on Map" from species profile | Low-effort, high-value navigation |
| Marker clustering (Leaflet.markercluster) | Decluttering at low zoom levels |
| Mobile/tablet responsive layout | Workshop tablet demos confirmed |

### DEFERRED (confirmed out of scope for MVP)

| Item | Rationale | When to Revisit |
|------|-----------|-----------------|
| IUCN range polygons | Different data source (IUCN spatial data requires separate license/download); heavy geometry; not needed when point localities are shown | Post-MVP when species profiles are enriched |
| OccurrenceRecord-based point plotting | OccurrenceRecord model is deferred from MVP entirely (per BA assessment v1). The map uses SpeciesLocality, not OccurrenceRecord. These are distinct: SpeciesLocality is curated reference data; OccurrenceRecord is Darwin Core observation data. | When occurrence records and survey data are implemented |
| Survey gap analysis overlay | Requires occurrence/survey data that does not exist in MVP | Post-MVP with field program data entry |
| Habitat suitability overlays | Requires environmental raster data (WorldClim, etc.); complex modeling; not in platform scope | Likely never -- this is a specialized GIS task, not a platform feature |
| Tier-based coordinate generalization on the map | At MVP, all map access is Tier 1 (public). The architecture handles this correctly: `is_sensitive` records serve `location_generalized`. Full tier-aware generalization (exact coords for Tier 3+) requires authenticated map access. | When authenticated frontend access is built (Gate 08+) |
| User-contributed locality data via frontend forms | No frontend data entry at MVP; all data via Django Admin or management commands | Post-MVP when coordinator frontend is built |
| Species profile embedded mini-map | See cross-page integration section (Section 6) |
| Dashboard map widget | See cross-page integration section (Section 6) |
| Time-slider for historical locality records | Adds complexity with minimal value for the MVP dataset | Post-MVP when temporal coverage improves |
| Print/export map view | Nice-to-have; standard Leaflet print plugins exist | Post-MVP based on user request |

---

## 4. Data Quality Risk Assessment

### Risk 1: Localities CSV Does Not Yet Exist (CRITICAL)

**Severity:** Critical -- this is the single highest risk to the map feature.

**Details:** The architecture proposal outlines a data sourcing strategy (Section 8) with 8 source categories (Leiss et al., GBIF, FishBase, eDNA papers, CARES, primary literature, Sparks & Stiassny revisions, Stiassny & Raminosoa checklist). The project lead must compile 300-800 locality records from these sources, geocode records that lack coordinates, assess coordinate precision for each record, and make sensitivity decisions. This is weeks of research work.

**Mitigation:**
1. Prioritize a "thin seed" approach: compile type localities first (one per described species = ~79 records). Type localities are the most consistently available data point (every described species has one). This gives the map a meaningful display even without full locality coverage.
2. Set a hard deadline: the localities CSV must be feature-complete enough to demonstrate at the workshop by May 25 (one week before June 1). The map code can be developed against synthetic test data while the real CSV is being compiled.
3. The `seed_localities --dry-run` flag is essential for catching data errors before they enter the database.

### Risk 2: Species with ZERO Known Locality Records

**Severity:** Medium.

**Details:** From the seed CSV, approximately 23 undescribed morphospecies and several described species with vague distribution narratives like "Eastern Madagascar" or "NW Madagascar" may not yield geocodable locality records. For some species, particularly the undescribed morphospecies, the only geographic information is the locality embedded in their provisional name (e.g., *Bedotia* sp. 'manombo' -- Manombo area).

**Expected zero-locality species:**
- Most undescribed morphospecies (~23 species) unless the curator can geocode from the provisional name locality
- Recently synonymized or poorly known species (e.g., *Ambassis fontoynonti*, *Ratsirakia legendrei*)
- Native (non-endemic) species if the curator limits the localities CSV to endemics only (per architecture proposal Section 8.6: "Non-endemic species are excluded from the initial dataset")

**Mitigation:**
1. The map summary endpoint should report `species_without_localities` prominently so the data gap is transparent.
2. Species profile pages for species with zero localities should NOT show a "View on Map" button (see MAP-07 acceptance criteria).
3. The map page itself could include a sidebar note: "X species have no mapped locality data. [View species without localities]" linking to a filtered directory view.

### Risk 3: Coordinate Precision Heterogeneity

**Severity:** Medium.

**Details:** The architecture proposal correctly identifies this with the `coordinate_precision` field (exact/approximate/locality_centroid/water_body_centroid). However, the visual representation of imprecise coordinates needs thought. A point marker at the centroid of "Eastern Madagascar" is misleading -- it implies the species was recorded at a specific location when it was not.

**Mitigation:**
1. Display a visual indicator of precision on the marker. Options:
   - **Recommended for MVP:** Include `coordinate_precision` in the marker popup text, clearly labeled (e.g., "Location precision: approximate" or "Location: water body centroid"). This is the minimum viable approach.
   - **Post-MVP enhancement:** Vary marker opacity by precision (exact = fully opaque, centroid = semi-transparent). Or add a dashed circle around imprecise points indicating uncertainty radius.
2. The filter panel should include a coordinate_precision filter so researchers can show only exact-coordinate records when doing spatial analysis.

### Risk 4: Undescribed Morphospecies and Type Localities

**Severity:** Low but conceptually important.

**Details:** Undescribed morphospecies cannot have `locality_type = "type_locality"` because they have not been formally described. The seed data management command should validate this: if a record has `locality_type = "type_locality"` and the species has `taxonomic_status = "undescribed_morphospecies"`, the import should log a warning. The data curator should use `collection_record` or `observation` instead.

**Mitigation:** Add a validation rule to `seed_localities`: warn (do not reject) if `locality_type = "type_locality"` is paired with an undescribed morphospecies.

### Risk 5: "No Coordinates Available" vs. "Coordinates Generalized for Sensitivity"

**Severity:** Medium -- this is a UX clarity issue.

**Details:** Two completely different situations produce the same visual result (no precise point on the map):
- A species has no locality records at all (data gap).
- A species has locality records, but they are marked `is_sensitive = true` and the user is Tier 1, so they see generalized coordinates.

At MVP, both are visible: the first case shows no markers; the second shows markers at generalized (0.1-degree snapped) coordinates. The distinction is actually handled well by the architecture. However, users seeing a marker at a generalized location might not realize the point has been shifted.

**Mitigation:**
1. For sensitive records displayed with generalized coordinates, the marker popup should include a note: "Location generalized to protect sensitive species" (same language GBIF uses).
2. The marker could optionally use a slightly different style (e.g., a translucent circle around it indicating the generalization area), but this is a post-MVP refinement.

### Risk 6: HydroSHEDS Naming Gaps

**Severity:** Low.

**Details:** Resolved in architecture proposal: cross-reference with published hydrological maps for the ~15-20 major systems, auto-generate "Sub-basin of [parent name]" for the rest.

**Residual concern:** The Pfafstetter hierarchy approach only works if parent basins ARE named. The naming must be applied top-down starting from the major basins. The management command should implement top-down naming to avoid "Sub-basin of Sub-basin of..." chains.

### Risk 7: WDPA Coverage Quality for Freshwater-Relevant PAs

**Severity:** Low.

**Details:** Madagascar's WDPA coverage is reasonably complete for terrestrial PAs (~120-160 features). However, freshwater-specific protected areas are underrepresented globally in WDPA. Many important sites for freshwater fish conservation (e.g., specific river reaches, lake margins) are not independently protected areas but fall within larger terrestrial PAs. The map will show the PA polygon correctly, but users should not interpret "locality outside PA polygon" as "unprotected."

**Mitigation:** No technical mitigation needed for MVP. Add a note to the map legend or about text: "Protected area boundaries are from the World Database on Protected Areas (WDPA). Protection status of specific freshwater habitats may differ from the terrestrial PA boundaries shown."

---

## 5. Cross-Page Integration Recommendations

### Species Profile Embedded Mini-Map: DEFER

**Recommendation:** Defer to post-MVP.

**Rationale:** An embedded mini-map on each species profile page would require either (a) loading Leaflet on every profile page (increasing bundle size for all profile pages), or (b) lazy-loading Leaflet only when the map component is visible (complexity). The "View on Map" link (MAP-07) achieves 80% of the value at 10% of the cost by linking to `/map/?species_id={id}`.

**Post-MVP approach:** Use Next.js dynamic imports to lazy-load a Leaflet mini-map component on species profile pages. Show only that species' localities, no reference layers, minimal controls.

### Conservation Dashboard Map Widget: DEFER

**Recommendation:** Defer to post-MVP.

**Rationale:** The dashboard is designed as a metrics/statistics page. Adding a map widget would compete visually with the coverage gap statistic (which is the dashboard's primary message). The map is better as a standalone page that tells a geographic story, complementing the dashboard's statistical story.

**Post-MVP approach:** A small static map image (pre-rendered PNG) showing species richness by watershed could work as a dashboard widget without loading Leaflet. This is a different approach than the interactive map and should be evaluated separately.

### Standalone `/map/` Page: BUILD THIS

This is the correct MVP approach. The map is a peer page alongside species directory, dashboard, and about.

---

## 6. Navigation Impact Assessment

### Current Gate 07 Navigation

The Gate 07 spec defines three header links: "Species Directory" (`/species/`), "Conservation Dashboard" (`/dashboard/`), "About".

### With Map Addition

Four header links: "Species Directory" (`/species/`), "Map" (`/map/`), "Conservation Dashboard" (`/dashboard/`), "About".

**Assessment:** Four navigation items is well within standard web navigation patterns. No hamburger menu needed on desktop. On mobile (< 768px), four items may not fit in a single row -- the mobile navigation should use a hamburger menu or collapsible drawer regardless of whether there are 3 or 4 items.

**Recommended link order:** Species Directory, Map, Conservation Dashboard, About. This follows a logical flow: browse species (directory) -> see where they are (map) -> understand the crisis (dashboard) -> learn about the platform (about).

**Label recommendation:** Use "Map" as the short label in the navigation header, not "Conservation Map" or "Interactive Conservation Map." Shorter labels leave more room at narrow viewports and the context makes the meaning clear.

---

## 7. Resolved Questions (2026-04-15)

### Q1: Localities CSV Timeline and Thin Seed Strategy [RESOLVED — IN PROGRESS]

**Decision:** The project lead is actively working on the localities CSV now (as of 2026-04-15). Timeline details (thin seed date, full CSV deadline, non-endemic scope) to be confirmed as curation progresses. The PM should plan development against synthetic test data and treat the real CSV as a Gate 06 dependency that can land late without blocking code work.

### Q2: Coordinate Precision Visual Treatment at MVP [RESOLVED]

**Decision: Preferred level.** The MVP map will:
1. Show `coordinate_precision` in the marker popup text (e.g., "Location precision: water body centroid")
2. Include a `coordinate_precision` filter in the filter panel so users can exclude imprecise records

Visual marker differentiation by precision (opacity, uncertainty circles) is deferred to post-MVP. The filter panel addition means the filter list is: family, IUCN status, locality type, presence status, watershed, **coordinate precision** (6 filters total).

### Q3: Map Page Effort vs. Gate 07 Scope [RESOLVED]

**Decision: Minimum viable map is the accepted fallback.** If Gate 07 scope must be cut, the map can ship with just locality points + legend (no watershed overlay, no PA overlay, no filter panel). This reduces map effort from 2-3 weeks to ~1 week. The PM should spec the map in two tiers:
- **Tier A (must-ship):** Locality points, legend, marker popups, marker clustering, base layer switcher, "View on Map" cross-link from species profiles
- **Tier B (ship if time allows):** Watershed overlay, protected area overlay, filter panel, watershed click-to-list, coordinate precision filter, map statistics bar

### Q4: Sensitive Species Handling [RESOLVED]

**Decision:** The project lead is the sole decision-maker on `is_sensitive` at MVP. Default remains `false` (public until explicitly marked sensitive). The project lead will apply sensitivity rules from the architecture proposal Section 8.5 during CSV curation:
- CR/EN species with recent (last 20 years) locality records: `is_sensitive = true`
- Cave fish (*Typhleotris* spp.): all localities sensitive regardless of age
- Published type localities older than 50 years: not sensitive
This is documented and accepted.

### Q5: Extinct Species on the Map [RESOLVED]

**Decision: Yes.** Historical localities for *Ptychochromis onilahy* (EX) and *Malagodon madagascariensis* (EX) will be included in the localities CSV with `presence_status = "historically_present_extirpated"`. These render with the hollow/crossed marker style. The existing presence status legend entry covers this -- no separate "Extinct" legend item needed, as the marker style communicates "no longer present here" regardless of whether the species is globally extinct or locally extirpated.
