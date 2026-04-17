# Gate 07 UX Review Memo

**Date:** 2026-04-17
**Scope:** PM spec `docs/planning/specs/gate-07-mvp-public-frontend.md` + architecture `docs/planning/architecture/gate-07-frontend-architecture.md`
**Context:** ECA Workshop demo, June 1–5 2026. Hard deadline. Solo dev. Anglophone, mixed-expertise audience (conservation pros, funders, policy folks, journalists).

Severity legend: **(a)** must-fix-before-workshop, **(b)** should-fix-if-time, **(c)** post-workshop.

---

## 1. Inter-page flow — the cold-visit walkthrough

**Persona:** Funder or SHOAL partner clicks the staging URL from an email. They have never seen the site and have ~90 seconds before forming an opinion.

### Issue 1.1 — No defined landing page / root route (a)
The spec names four pages (`/species/`, `/species/[id]/`, `/dashboard/`, `/map/`) but does not specify what `/` does. A cold visitor typing or pasting the bare domain lands on an implicit 404 or a Next.js default. At a workshop where attendees will be handed a URL on a slide, this is the single highest-severity inter-page gap.

*Suggestion:* Define `/` as a minimal hero page: one-sentence mission, the coverage-gap headline stat from `/dashboard/`, and three large cards linking to Directory / Map / Dashboard. Or — cheaper — redirect `/` to `/dashboard/` and treat the dashboard as the front door. The dashboard's "why this platform exists" framing is the right first impression for funders.

### Issue 1.2 — Reading order across pages is not the narrative order (a/b)
The nav order in FE-07-4 is Directory → Map → Dashboard → About. The PM spec even calls this "the logical flow: browse species → see where they are → understand the crisis." That ordering is wrong for a cold funder. The crisis is the hook; the directory is the evidence. A funder who clicks Directory first sees a filterable table of Latin names and bounces.

*Suggestion:* Reorder nav: **Dashboard → Map → Species Directory → About**, or keep nav order but make `/` the dashboard so the first landing is the crisis framing.

### Issue 1.3 — No cross-link from Dashboard → Directory or Map (b)
`/dashboard/` shows "31 of 49 threatened species have no known captive population." The obvious next user thought is "show me those 31 species" or "show me where they are." The spec doesn't specify that the stat is clickable or that the chart bars deep-link into the directory with pre-applied filters.

*Suggestion:* Make the coverage-gap number a link to `/species/?iucn_status=CR,EN,VU&has_captive_population=false`. Make each IUCN-chart bar link to `/species/?iucn_status={cat}`. Turns the dashboard from a dead-end poster into a navigation hub.

### Issue 1.4 — Species profile → Map is specified; Map → Dashboard is not (b)
FE-07-5 defines "View on Map" from profile → map. Good. But there's no return path from map popup → dashboard context, and no link from map legend categories back to filtered directory views.

*Suggestion:* In the map legend, each IUCN swatch links to `/species/?iucn_status={cat}`. Low effort, high payoff for navigation fluency.

### Issue 1.5 — `has_captive_population` filter missing from directory (b)
To make 1.3 work, `/species/` needs a filter for captive-population presence. Not in the spec's filter list (taxonomic status / IUCN / family / CARES).

*Suggestion:* Add a binary filter "Has captive population / No captive population" to the directory filter bar. This is also the filter that makes the coverage-gap story drillable, which is the whole point of the site.

### Issue 1.6 — Breadcrumbs absent on `/species/[id]/` (b)
A user arriving on a profile page from a Google result or a shared link has no obvious path back to the directory.

*Suggestion:* Add a small "← All species" link top-left of the profile page, preserving any filter state the user came from (via referrer or a `from` query param).

### Issue 1.7 — "About" page underdefined (c)
Spec says "static page or anchor on homepage — minimal content at MVP." For funders and journalists, the About page is where they check credibility.

*Suggestion:* Post-workshop, but before the workshop at least ensure About names the project owner, links the GitHub repo, and cites Leiss et al. 2022 and IUCN.

---

## 2. Empty / sparse / failure states

79–100 species crossed with 7 IUCN categories × ~4 families × 4 CARES categories makes most filter combinations return 0–2 species. This is the normal case, not an edge case.

### Issue 2.1 — Directory empty-state not specified (a)
What does `/species/?iucn_status=LC&family=Anchariidae` show when zero species match? A blank card list with "0 results" is a demo-killer.

*Suggestion:* Specify an explicit empty state: "No species match these filters. [Clear filters] or [Browse all 97 species]." Include the nearest relaxation suggestion if cheap ("Try removing the family filter — 3 species are LC.").

### Issue 2.2 — Map empty-viewport state (a)
Spec covers "zero locality records from API" and "API unreachable," but not the common case: user zooms/pans to a region with no localities in the current viewport. The map just looks broken.

*Suggestion:* Detect `visibleMarkers.length === 0 && totalMarkers > 0` and render a subtle floating notice: "No locality records in this area. X localities visible at lower zoom — [Reset view]." Reset-view button is important; zooming out manually is painful on touch.

### Issue 2.3 — `/dashboard/` when backend is down (a)
Spec does not specify what `/dashboard/` shows if `/api/v1/dashboard/` fails during SSR. Because it's SSR (not SSG), a backend outage during a live demo produces a full-page error.

*Suggestion:* Wrap dashboard data-fetch in a try/catch; on failure, render the page shell with a banner "Live statistics temporarily unavailable — last known values shown" and display the most recently cached `last_updated` values. Switch `/dashboard/` from pure SSR to ISR with 1h revalidate and `stale-while-revalidate` semantics, so the last-good render persists through a backend blip.

### Issue 2.4 — ESRI tile fallback is silent (a)
Architecture §10 pre-bakes a local tile pyramid for ESRI fallback and swaps on failure. Good. But the user is not told. If ESRI tiles fail mid-demo and swap to lower-zoom local pyramid, the visual change will be visible, and unexplained visual changes read as bugs.

*Suggestion:* When the fallback layer activates, show a small non-modal toast or map attribution change: "Using offline basemap — satellite imagery unavailable." Also clamp the satellite layer's max-zoom to 9 when using the fallback so tiles don't pixelate into broken-ness at zoom 11.

### Issue 2.5 — Loading skeletons not specified (b)
None of the pages specify loading states for client-side transitions. Next.js App Router gives you `loading.tsx` for free on server navigation, but `/map/` filter re-fetch is client-side and the markers-disappear-then-reappear pattern looks like a crash.

*Suggestion:* On map filter change, keep existing markers visible and dim them to 50% opacity until the new fetch resolves, then replace. On directory filter change, use a skeleton or a top-of-page progress bar.

### Issue 2.6 — Partial data on species profile (b)
A profile with only a scientific name, IUCN "Not Evaluated," zero common names, zero ecology text, and zero captive pops is realistic for an undescribed morphospecies. Reads as a broken page.

*Suggestion:* Define a "sparse profile" treatment: if fewer than N fields populated, show an explicit notice "Limited public data available for this undescribed taxon. See IUCN Red List [link] for the most recent assessment when available."

### Issue 2.7 — 404 on `/species/9999/` styling (c)
Spec says Next.js `notFound()`. Default is bare. A themed 404 with "This species ID doesn't exist — [browse all species]" is the polite version.

---

## 3. Map accessibility and mobile behavior

The map is the single biggest accessibility-regression risk in the spec.

### Issue 3.1 — Keyboard navigation through clustered markers is unspecified (a)
Leaflet markers are focusable with tab, but `leaflet.markercluster` disables focus on sub-markers inside a cluster until the cluster is expanded. There is no keyboard equivalent for "click cluster to expand" documented.

*Suggestion:* Verify and document: tab to cluster → Enter/Space triggers spiderfy or zoom-in → sub-markers become focusable. Test with actual keyboard-only navigation. If markercluster doesn't support this, add an accessible text-list alternative view as a toggle.

### Issue 3.2 — Screen reader: map content is invisible (a/b)
Leaflet maps are notoriously screen-reader-hostile. There is no `aria-label`, no live region, no text alternative for the color-coded IUCN distribution.

*Suggestion (a):* Add `aria-label="Interactive map of Madagascar freshwater fish localities"`; add a visually-hidden summary: "Map shows N localities across Y species. Use the species directory for a text-based view."
*Suggestion (b):* Build the list-view toggle from 3.1.

### Issue 3.3 — IUCN color-only coding fails colorblind users (a)
CR/EN/VU are red/orange/yellow — classic protanopia/deuteranopia trap. Spec says markers are color-coded by status and shape-coded by locality type, but *not* shape-coded by IUCN category.

*Suggestion:* Either (a) label markers with the IUCN letter code (CR/EN/VU) as a small centered glyph at zoom ≥ 9, or (b) ensure the popup always leads with the IUCN text label.

### Issue 3.4 — Touch target size for markers (a)
Leaflet's default circle marker radius is ~10px. On a 3x-density phone, that's a ~7pt touch target — well under WCAG guidance.

*Suggestion:* Set marker `radius: 8` with `weight: 2` border (effective hit area ~18px). Add a 44px-equivalent invisible hit pad. Test on an actual phone at workshop-typical zoom.

### Issue 3.5 — Popup overflow on mobile (b)
Spec requires "popups fit within the viewport" on tablet but doesn't specify the same for phone. Realistic popup height 200–300px; on a 375×667 phone with legend visible, that's most of the viewport.

*Suggestion:* On `< 768px`, popups should open as a bottom-sheet overlay (fixed position, full-width, dismissible with swipe-down or tap-outside) rather than Leaflet's default arrow-popup.

### Issue 3.6 — Legend collapsibility on mobile (a)
If collapsed-by-default, a user scanning colored dots has no key. If expanded-by-default, it covers half the map.

*Suggestion:* Collapse-by-default with a persistent "Legend" button top-right showing a colored-dots cluster icon so the legend's presence is obvious. When opened, make it a bottom-sheet.

### Issue 3.7 — Focus indicator on Leaflet controls (b)
Leaflet's default zoom and layer-switcher controls have poor visible-focus styling.

*Suggestion:* Add a global CSS rule: `.leaflet-control a:focus-visible { outline: 2px solid #0066cc; outline-offset: 2px; }`.

### Issue 3.8 — "View on Map" disabled-with-tooltip is a touch anti-pattern (b)
Tooltips don't fire on touch. A mobile user sees a greyed-out button with no explanation.

*Suggestion:* Prefer the "absent" branch for mobile; on desktop, inline the explanation next to the disabled button as plain text.

---

## 4. Workshop-demo UX risks (beyond Risk #3)

### Issue 4.1 — Day-1 cold-ISR perception (a)
Workshop-week revalidate=60s means the first hit on any species profile after deploy is a fresh SSR render — possibly 800ms–2s on Vercel free tier when DRF-on-Fly is waking up. During a live demo, the presenter clicks a profile and sees a blank-ish page for 1–2 seconds.

*Suggestion:* Pre-warm the cache before each demo session. Add a one-click "Warm caches" admin action (reuse `/api/revalidate` secret plumbing) that requests each species profile on a loop. Ensure the `loading.tsx` skeleton is visually convincing — a species-card-shaped skeleton, not a generic spinner.

### Issue 4.2 — URL state for bookmarkable demo and Q&A handoff (a)
Spec FE-07-1 says "Filters update URL query params." Good. But the spec does not require `/species/[id]/` to preserve incoming filter context, and dashboard chart bars need to land in the directory with the right filter state.

*Suggestion:* Confirm every filterable page supports full filter state in URL. Test three canonical "demo URLs" before the flight: (1) `/dashboard/`, (2) `/species/?iucn_status=CR,EN&family=Bedotiidae`, (3) `/map/?species_id={sakaramyi_id}`. Put these in a pre-demo checklist.

### Issue 4.3 — Print / PDF export for handouts (b)
Workshop attendees will want to hand a species profile to a colleague or print a dashboard page for a board meeting.

*Suggestion:* Add a minimal `@media print` stylesheet for `/species/[id]/` and `/dashboard/`: hide nav/footer, force single-column, show IUCN status as text + pattern not just color, convert the "View on Map" button to a printed URL. Skip the map page entirely for print.

### Issue 4.4 — Conference Wi-Fi and ISR revalidation storm (b)
When the revalidate-all admin action fires during the workshop, every ISR page becomes cold simultaneously. The next visitor hits an all-cold cache on conference Wi-Fi.

*Suggestion:* Run the cache-warming script immediately after the revalidate-all action, not just at session start. Document this as "revalidate → warm → verify" in the pre-demo runbook.

### Issue 4.5 — Shareable URL for "the site" needs a short form (b)
Architecture §10 plans `staging.<domain>` alias by mid-May. Attendees in hallway conversation need something shorter than that.

*Suggestion:* Decide the public-facing URL by May 1. If no real domain, a clean Vercel alias like `madagascarfish.vercel.app` is acceptable but less credible. Print it on any handouts.

### Issue 4.6 — Live-demo browser state (b)
Presenter's browser will have dev-tools open, aggressive cache, prior auth cookies. An auth cookie leaking could cause an admin-only button to appear on a profile page.

*Suggestion:* Keep a dedicated "clean" browser profile for demos — fresh Chrome profile, no extensions, no cookies.

---

## 5. IUCN badge semantics for non-IUCN-fluent viewers

The audience is explicitly mixed — conservation pros read CR/EN/VU instantly, but funders and policy attendees will see jargon.

### Issue 5.1 — No legend defined anywhere except on the map (a)
Spec shows IUCN badges on directory cards, profile headers, and dashboard chart. Only `/map/` has an explicit legend. A funder landing on `/species/` sees a column of "CR / EN / VU / LC" abbreviations with no key.

*Suggestion (a):* Add a persistent legend affordance on every page that renders IUCN badges. Cheapest: make every IUCN badge a `<span title="Critically Endangered">CR</span>` with a tooltip (hover + long-press), AND place an always-visible legend key at the bottom of the species directory filter panel and the top of the dashboard. On the profile page, spell out the category next to the badge on first appearance: "EN (Endangered)" not just "EN."

### Issue 5.2 — Reading order — badge before explanation (a)
The species profile shows the IUCN badge first, criteria string second. A screen reader and a left-to-right reading funder both see "EN B1ab(iii)" before any context. "B1ab(iii)" has no explanation anywhere.

*Suggestion:* Profile Conservation Status layout: "**Endangered** (EN) — assessed 2016. Criteria: B1ab(iii) [ⓘ]." Expanded word first, abbreviation second, criteria last with an info-tooltip explaining B1ab(iii) in plain English. Copy can be canned from IUCN's public glossary.

### Issue 5.3 — Dashboard chart axis label (a)
If axis labels are just "CR / EN / VU / ..." a funder doesn't know which is worse than which. And the red-to-green gradient reinforces color-only-coding.

*Suggestion:* Axis labels should be the full words or hybrid: "Critically Endangered (CR)" etc. Order bars by severity (CR → LC → DD → NE) left-to-right. Add a one-line caption: "Threat level decreases left to right. DD = Data Deficient, NE = Not Evaluated." Each bar should have a text count label visible (not hover-only).

### Issue 5.4 — "Not Evaluated" vs "Not yet assessed" consistency (b)
The `CLAUDE.md` mirror policy says unassessed species render "Not yet assessed" on profiles. The dashboard says "Not Evaluated / Not Assessed." The map legend has "NE." Three phrasings for one state.

*Suggestion:* Pick one public-facing phrase ("Not yet assessed") and use it everywhere long-form text is read; keep "NE" as the abbreviation in space-constrained contexts. Add to a glossary.

### Issue 5.5 — CARES status is doubly obscure (a)
CARES abbreviations CCR/CEN/CVU/CLC are even more jargon than IUCN. Spec treats them as equivalent to IUCN badges in filter UI.

*Suggestion:* On first appearance per page, spell out: "CARES Priority: CCR (Conservation Priority — Critically Endangered)" with a tooltip explaining what CARES is. Group the CARES filter under a collapsed "Conservation priority lists" section with one sentence of intro.

---

## Consolidated Top 10 (in rough order of leverage)

1. **Define `/` route** — redirect to `/dashboard/` or build a minimal hero. (1.1, a)
2. **IUCN badge tooltips + expanded labels on first appearance** — covers 5.1/5.2/5.3. (a)
3. **Directory and map empty-state copy + filter-reset affordances** — 2.1, 2.2. (a)
4. **Dashboard failure-mode: switch to ISR with stale-while-revalidate fallback** — 2.3. (a)
5. **Cache-warming script tied to the revalidate admin action** — 4.1, 4.4. (a)
6. **Keyboard + screen-reader minimums on map** — 3.1, 3.2, 3.7. (a)
7. **Marker touch target size bump + mobile bottom-sheet popup** — 3.4, 3.5. (a)
8. **Clickable coverage-gap stat and chart bars → deep-link into directory** — 1.3, 1.5. (b)
9. **Breadcrumb / "back to directory" on profile pages** — 1.6. (b)
10. **Print stylesheet** — 4.3. (b)

---

## Open Questions for the Team

1. **What is `/`?** Not specified. Blocker for any pre-workshop shareable URL. Needs a one-line decision.
2. **Is there a public-facing domain, or do we demo on `*.vercel.app`?** Affects 4.5 and handout design.
3. **Who writes the plain-English IUCN and CARES glossary copy?** Content task, not a dev task.
4. **Should the dashboard be the landing page?** Architecturally trivial, but changes SEO posture.
5. **Is there capacity for a list-view toggle on the map?** ~1–2 days, biggest accessibility payoff.
6. **Are IUCN criteria strings (e.g., "B1ab(iii)") intended for public display?** For a funder audience they are noise. Suggest tooltip-hide or cut from Tier 1.
7. **Pre-demo runbook owner?** Several risks converge on a checklist. Aleksei solo, or BA support?
