# Gate 07 Pre-Workshop Copy Pass — Notes

**Date:** 2026-04-17
**Branch:** `docs/conservation-writer-copy-pass`
**Context:** Voice-consistency pass pulled forward from the Gate 07 §2 W5 slot
(2026-05-16 → 05-22) so the MVP is voice-aligned before the ECA Workshop at
ABQ BioPark (2026-06-01 → 06-05).

## Voice decisions made

- **Dropped "most imperiled vertebrates" from the Hero H1.** Accurate but
  reads as campaign copy. Replaced with "A shared record for Madagascar's
  endemic freshwater fish." — a functional description that matches what the
  platform actually is. The imperilment framing is kept in the About page
  where there is room to cite it.
- **Removed the "imperiled vertebrate group" claim from the public
  About copy.** It appears in `CLAUDE.md` and in ideation documents, but on
  the public page it is phrased as "most imperiled vertebrate group on the
  island," which is a stronger claim than the About section needs. Kept the
  substance (threatened majority, captive-coverage gap) without the
  superlative.
- **"Refreshed hourly" replaces "Live counts" on the Hero nav card.** The
  dashboard revalidates every 3600 seconds; "live" overstates the cadence per
  the voice guide.
- **"Live statistics" language removed from the dashboard freshness banner.**
  Replaced with "Current statistics are temporarily unavailable. The last
  successfully retrieved values are shown below." Names the failure, names
  what the user is seeing. The stale-threshold variant is now "The counts
  shown are older than the usual refresh window. A refresh is in progress."
- **Chart caption spells out the mirror policy briefly.** "Counts mirror the
  most recent accepted IUCN Red List assessment for each endemic species in
  the registry. Species with no assessment appear under Not Evaluated." —
  this aligns the caption with the `CLAUDE.md` mirror-policy language so the
  public explanation matches the backend contract.
- **Directory empty state names the cause and offers one path.** When
  filters are active: "Clear one or more filters to widen the search, or
  browse the full directory." When not filtered but zero results: "No species
  are currently listed." Previously offered two competing CTAs ("Clear
  filters" and "Browse all species") even when nothing was filtered; that has
  been conditioned on `filtered`.
- **Map zero-results empty state names the coordinate-generalization
  constraint.** When a user arrives from a species profile and sees no
  markers, the body explicitly states: "Exact coordinates for threatened
  species are restricted to coordinator-tier accounts." This is the honest
  reason for many zero-marker cases and it reads better than "this species
  has no public locality records" alone.
- **Map-data-unavailable copy names the service.** "The locality data service
  is unreachable. Try again in a moment, or browse the species directory for
  profile and conservation details."
- **Global error boundary: "Something went wrong" replaced.** New heading:
  "This page could not be loaded." New body: "An unexpected error interrupted
  rendering. Try again in a moment, or return to the home page." Heading is
  now a statement, not a label.
- **Species profile sparse-data banner rewritten.** "Limited public data is
  available for this species. Additional information will be added as it is
  published." Drops the "our directory grows" phrasing, which sounded
  marketing-adjacent.
- **"Not yet assessed" normalized on the profile.** The Conservation Status
  section now says "Not yet assessed on the IUCN Red List." This matches the
  `CLAUDE.md` rule and is explicit about which list we mean (so it does not
  read as a statement about CARES or SHOAL status).
- **"External Links" heading renamed to "External References."** Nudge
  toward citation language rather than affiliate-link language.
- **Directory filter hit-count phrased as a statement, not an address.**
  "12 species match the current filters" rather than "Showing 12 species
  matching your filters." Drops second-person "your."
- **About page expanded with a citation to GBIF sensitive-species guidance.**
  This was implicit in the map behavior but not named anywhere user-facing.
  It now appears both in the About body and in the citations list.
- **New: `/about/glossary/` page.** Terms in scope per Gate 07: IUCN
  categories (CR/EN/VU/NT/LC/DD, plus NE phrased as "not yet assessed"),
  CARES, SHOAL, Darwin Core, GBIF, ex-situ, in-situ, studbook, endemic,
  threatened, ZIMS. Two sentences per entry, conservation-professional
  register. Linked from the About page Data Sources section.

## Inconsistencies flagged (not fixed — require product decision)

- **"Undescribed taxon" vs. "Undescribed morphospecies."** The profile
  previously said "Undescribed taxon — formal description pending"; the
  directory filter uses "Undescribed morphospecies." I aligned the profile
  banner to "Undescribed morphospecies" for consistency with the filter and
  with the database field name (`taxonomic_status = undescribed_morphospecies`).
  **Flag for Aleksei:** confirm this is the correct public-facing term. If
  "morphospecies" is judged too technical for journalists, we should pick a
  single less-technical phrase and use it in both places.
- **IUCN filter legend uses "Not Evaluated" (NE).** The `IUCN_LABELS` map in
  `frontend/lib/species.ts` still reads "Not Evaluated" for NE. The
  `CLAUDE.md` rule says public-facing copy should use "Not yet assessed"
  while NE remains the badge abbreviation. Changing the label map would ripple
  through the chart, filter panel, and badges; I did not do this because it
  crosses from copy into data-shape territory. **Flag for Aleksei:** decide
  whether to (a) change the label map globally, (b) introduce a separate
  "public label" field, or (c) keep "Not Evaluated" on labels and accept the
  divergence with the mirror-policy wording.
- **"~79 endemic species" vs. "roughly 79."** I standardized the hero and
  About on "roughly 79" (more conversational) while the `CLAUDE.md` project
  header says "~79." Dashboard continues to render the exact count from the
  backend, which is the source of truth. If the exact number differs from 79
  at build time, the headline claim and the dashboard tile will diverge.
  **Flag for Aleksei:** consider rewording the About intro to reference the
  live count (or a footnote pointing to the dashboard) once the registry is
  final.
- **Hero coverage-gap stat and Dashboard coverage-gap stat use identical
  wording.** This is intentional per the voice guide ("reuse the phrasing,
  don't paraphrase"). No flag, just noting that edits to one must edit the
  other.
- **Tile-fallback notice wording.** Gate 07 spec prescribed "Using offline
  basemap — satellite imagery unavailable." The live code says "Using offline
  basemap — satellite imagery limited to zoom N." The live version is more
  precise — imagery is still available below the cap — so I left it. **Flag
  for Aleksei:** confirm preference. If the spec wording is load-bearing for
  acceptance tests, I will update.
- **`frontend/components/SiteFooter.tsx` lists "Data: IUCN Red List,
  FishBase, GBIF, ZIMS" but the About page now also names SHOAL and CARES as
  data sources.** These are priority lists rather than primary data sources,
  so the footer is technically correct. **Flag for Aleksei:** decide whether
  to add SHOAL / CARES to the footer list or keep the distinction.

## Factual claims preserved verbatim (unverified)

- **"Leiss, A., et al. (2022). The extinction crisis of Madagascar's
  freshwater fishes."** Citation on the About page was present before this
  pass. I did not verify the author initial, spelling, or year against a
  primary source. The ideation PDF in the repo is titled "Review of
  Threatened Malagasy FF.pdf" and the crisis-report markdown referenced in
  the agent guidance does not exist at the expected path
  (`docs/ideation/extinction-crisis-report.md`). **Flag for Aleksei:**
  confirm the Leiss citation or replace with the actual bibliographic entry
  from the reviewed PDF.
- **"Licensed Apache-2.0."** Preserved from existing copy. Not independently
  verified against a LICENSE file on this pass.
- **Repo URL `github.com/alexsaunderswps/madagascarfish`.** Preserved from
  existing copy.
- **Ownership attribution "Wildlife Protection Solutions."** Preserved.
- **"SHOAL 1,000 Fishes Blueprint."** Preserved.
- **"GBIF sensitive-species coordinate-generalization guidance."** Named as
  a practice the platform follows. The specific GBIF publication is not
  cited inline; this matches the abstraction level of the other references.

## Out of scope but observed

- **i18n readiness:** Several strings now contain conditional phrasing
  ("one locality record" vs. "N locality records") that will be harder to
  localize than they were before. Flagged for Gate 09. No action this pass.
- **No `loading.tsx` added.** Per the user's memory note ("No loading.tsx on
  fetch routes"), I did not add streaming skeletons for the updated error
  paths.
- **EmptyState component itself was not changed.** The voice pass is on call
  sites; the component's shape is correct.

## Files edited

- `frontend/app/page.tsx`
- `frontend/app/about/page.tsx`
- `frontend/app/about/glossary/page.tsx` (new)
- `frontend/app/dashboard/page.tsx`
- `frontend/app/species/page.tsx`
- `frontend/app/species/[id]/page.tsx`
- `frontend/app/species/[id]/not-found.tsx`
- `frontend/app/map/page.tsx`
- `frontend/app/not-found.tsx`
- `frontend/app/error.tsx`

## Suggested commit boundaries

1. `copy(hero,nav): tighten landing copy and nav card descriptions`
   — `frontend/app/page.tsx`
2. `copy(about): expand About with mission, data sources, and citations`
   — `frontend/app/about/page.tsx`
3. `copy(glossary): add IUCN + Darwin Core + CARES glossary page`
   — `frontend/app/about/glossary/page.tsx`
4. `copy(dashboard): freshness banner, chart caption, stat tile labels`
   — `frontend/app/dashboard/page.tsx`
5. `copy(empty-states): align directory, map, 404, and error-boundary microcopy`
   — `frontend/app/species/page.tsx`,
     `frontend/app/species/[id]/not-found.tsx`,
     `frontend/app/map/page.tsx`,
     `frontend/app/not-found.tsx`,
     `frontend/app/error.tsx`
6. `copy(species-profile): sparse-data banner, section headings, assessment wording`
   — `frontend/app/species/[id]/page.tsx`
