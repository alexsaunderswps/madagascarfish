# Gate 07 v2 — MVP Public Frontend (Reconciled)

**Status:** Active. Supersedes `gate-07-mvp-public-frontend.md` for planning purposes.
**Reconciled:** 2026-04-17 against locked architecture (`docs/planning/architecture/gate-07-frontend-architecture.md`), BA memo (`docs/planning/business-analysis/gate-07-reconciliation.md`), UX review (`docs/planning/ux-review/gate-07-ux-review.md`).
**Target:** ECA Workshop demo, June 1–5 2026. Hard deadline.
**Scope:** Public, read-only Tier 1. Next.js 14 App Router + TS + Tailwind + Leaflet + raw `fetch` against DRF. No auth UI.

Copy work (glossary, About, microcopy, empty-state text, IUCN/CARES plain-English labels) is delegated to `@conservation-writer` from inside the relevant tickets — not drafted here.

Architecture risks (map calendar pressure, type drift, ISR cache ghost, ESRI tile failure) are owned in architecture §10; this spec references them, does not re-litigate.

**On FE-07-0 kickoff: snapshot this file as `gate-07-v2-locked-<YYYY-MM-DD>.md` in the same directory and treat all subsequent changes as amendments appended to the bottom of *this* file rather than in-place edits.** The snapshot preserves the contract as of implementation start; the amendment log tells the story of what reality forced us to adjust in W3+.

---

## 1. Stories

Rendering conventions: every page is a Server Component with `fetch(..., { next: { revalidate: Number(process.env.NEXT_REVALIDATE_SECONDS ?? 3600) } })` unless otherwise noted. Map is client-only (`next/dynamic`, `ssr:false`).

Estimates: XS ≤ 0.5d, S = 1d, M = 2–3d, L = 4–6d, XL > 1 week. Solo-dev days.

---

### FE-07-0 — Project scaffold, `lib/api.ts`, CI type-gen wiring

**As** the solo developer, **I want** a working Next.js 14 skeleton with typed fetch, CI typecheck, and openapi-typescript drift-check **so that** every subsequent story has a stable foundation.

**Rendering:** N/A (tooling).
**Estimate:** M.
**Dependencies:** BE confirmation that `/api/v1/schema/` is reachable.

**Acceptance:**
- **Given** a fresh checkout, **when** a dev runs `pnpm install && pnpm dev`, **then** Next.js 14 App Router boots against `NEXT_PUBLIC_API_URL`.
- **Given** a serializer field is renamed on the backend, **when** CI runs on the frontend PR, **then** the `openapi-typescript` diff-check fails with "run pnpm gen:types".
- **Given** any page throws an `ApiError`, **when** the error boundary (`app/error.tsx`) catches it, **then** a friendly "Data temporarily unavailable" message renders — no stack trace.
- **Given** `lib/api.ts` is the only fetch wrapper, **when** it is read, **then** it accepts an optional `headers` injection point (forward-compat with Gate 08 auth). See Handoff notes.
- **Given** Playwright is wired, **when** a PR opens, **then** `patrickedqvist/wait-for-vercel-preview` resolves the preview URL and Playwright runs against it.

---

### FE-07-1 — Hero landing page `/`

**As** a funder clicking a staging URL from an email, **I want** a 3-second "what is this" above the fold **so that** I click further instead of bouncing.

**Rendering:** Server Component, `revalidate: 3600`.
**Estimate:** S.
**Dependencies:** FE-07-0. Dashboard coverage-gap stat comes from `/api/v1/dashboard/`.

UI:
- One-sentence mission (copy: `@conservation-writer`).
- Coverage-gap headline stat ("31 of 49 threatened species have no known captive population").
- Three nav cards: Directory, Map, Dashboard.
- Minimal footer via shared site shell.

**Acceptance:**
- **Given** a cold visitor lands on `/`, **when** the page renders, **then** the mission sentence, the coverage-gap stat, and three cards are visible without scroll on a 1024×768 viewport.
- **Given** the coverage-gap stat is clicked, **when** navigation completes, **then** the user lands on `/species/?iucn_status=CR,EN,VU&has_captive_population=false`.
- **Given** `/api/v1/dashboard/` is unreachable at build/revalidate time, **when** `/` renders, **then** the mission sentence and nav cards still render; the stat shows a graceful fallback ("Loading current statistics…") — never a 500.
- **Given** `NEXT_REVALIDATE_SECONDS=60`, **when** the page is requested ≥60s after a data change, **then** the next render reflects the new stat.

---

### FE-07-2 — Species Directory `/species/` (with new filters)

**As** a researcher or coordinator, **I want** to browse and filter the species list, **so that** I can find a species or drill into a subset (e.g., threatened + no captive pop).

**Rendering:** Server Component, `revalidate: 3600`.
**Estimate:** L.
**Dependencies:** FE-07-0. **BE:** `has_captive_population` boolean filter + `iucn_status` multi-select on `/api/v1/species/`.

UI: header "X Endemic Freshwater Fish Species (Y described, Z undescribed)"; filter bar (taxonomic status, IUCN multi-select, family multi-select, CARES, search, `has_captive_population`); paginated cards (50/page). Filters serialize to URL query params. IUCN badges tooltipped with plain-English label (copy: `@conservation-writer`). Persistent legend key at bottom of filter panel.

**Acceptance:**
- **Given** `/species/`, **when** the page loads, **then** count header + default list (all species) + pagination render; filter controls reflect URL state.
- **Given** URL `?iucn_status=CR,EN&family=Bedotiidae`, **when** the page loads, **then** only matching species appear; the filter controls pre-populate with those selections.
- **Given** URL `?iucn_status=CR,EN,VU&has_captive_population=false`, **when** the page loads, **then** only threatened species with zero tracked captive populations appear; count header reflects the filtered set.
- **Given** a search for "sakaramy", **when** submitted, **then** *Pachypanchax sakaramyi* appears and matches are highlighted.
- **Given** a filter combination returns 0 species, **when** the page renders, **then** the empty-state copy renders with [Clear filters] and [Browse all species] actions (copy: `@conservation-writer`, see FE-07-10).
- **Given** a card click, **when** navigation fires, **then** user lands on `/species/{id}/`.

---

### FE-07-3 — Species Profile `/species/[id]/`

**As** a conservation stakeholder, **I want** a detailed single-species page, **so that** I can understand its taxonomy, status, ecology, captive population, and field programs.

**Rendering:** **Server Component with `fetch(..., { next: { revalidate: 3600 } })`** — semantically replaces the v1 spec's Pages-Router `getServerSideProps`. Not SSR-on-every-request; SSG+revalidate to match architecture §3.
**Estimate:** L.
**Dependencies:** FE-07-0, FE-07-2 (for breadcrumb back-link). **BE:** confirm/expose `has_localities` boolean (or locality count) on species detail serializer.

UI sections per v1 spec (header, Conservation Status, Common Names, Description & Ecology, Captive Population Summary, Field Programs, External Links) plus:
- Breadcrumb "← All species" top-left (preserves referrer filter state via `from` query param best-effort).
- IUCN badge: "Endangered (EN)" on first appearance; criteria string e.g. `B1ab(iii)` in an info-tooltip (copy: `@conservation-writer`).
- "View on Map" button visible iff `has_localities === true`; hidden otherwise (not a disabled-with-tooltip — per UX 3.8 touch-anti-pattern).
- Sparse-profile treatment: if < N populated fields, render "Limited public data available…" notice (copy: `@conservation-writer`).

**Acceptance:**
- **Given** `/species/{id}/` for a described species, **when** it renders, **then** header + full IUCN section + ecology + captive-pop summary + external links render; "View on Map" is present.
- **Given** an undescribed morphospecies, **when** it renders, **then** no authority/year is shown; "Undescribed taxon" notice renders; "Provisional Name" badge is visible.
- **Given** `ex_situ_summary.institutions_holding === 0`, **when** it renders, **then** captive-pop section reads "No captive population is currently tracked" — not an error.
- **Given** `has_localities === false`, **when** page renders, **then** "View on Map" is absent (not disabled).
- **Given** `/species/9999/`, **when** requested, **then** themed 404 with "This species ID doesn't exist — browse all species" link.
- **Given** the breadcrumb is clicked from a filter-originated view, **when** navigation fires, **then** the user returns to `/species/` with prior filter state where preserved.
- **Given** DRF unreachable at revalidate time, **when** a cached render exists, **then** the stale render serves; **when** no cache exists, **then** error boundary renders friendly fallback.

---

### FE-07-4 — Conservation Map `/map/` Tier A

**As** any visitor, **I want** to see where Madagascar's freshwater fish have been recorded, **so that** I can grasp the geography at a glance.

**Rendering:** Client-only (`next/dynamic`, `ssr:false`).
**Estimate:** L (week 1–2 per arch Risk 1).
**Dependencies:** FE-07-0. Static base tile pyramid from FE-07-9.

UI per v1 spec Tier A: full-viewport Leaflet, OSM + ESRI base switcher, IUCN-color-coded markers, shape/fill encoding for locality type + presence, markercluster, popups with full field set, legend. **Plus UX-review must-haves:**
- Marker `radius: 8`, `weight: 2`; 44px-equivalent invisible hit pad.
- IUCN letter glyph centered in marker at zoom ≥ 9 (addresses colorblind).
- Bottom-sheet popup on `< 768px` viewports (not Leaflet arrow-popup).
- Legend collapsed by default on mobile, accessible via "Legend" button.
- `aria-label` on map container; visually-hidden summary "Map shows N localities across Y species. Use the species directory for a text-based view."
- `.leaflet-control a:focus-visible` focus outline.
- Legend IUCN swatches link to `/species/?iucn_status={cat}` (cross-link back to directory).
- Empty-viewport notice: "No locality records in this area. X localities visible at lower zoom — [Reset view]."
- Loading state on filter re-fetch: existing markers dim to 50% until new data resolves.

**Acceptance:** (v1 Tier A ACs carry forward; additions:)
- **Given** a keyboard user tabs to a cluster, **when** they press Enter/Space, **then** the cluster spiderfies/zooms and sub-markers become focusable.
- **Given** a screen-reader user lands on `/map/`, **when** the map container receives focus, **then** the aria-label and hidden summary are announced.
- **Given** colorblind user views markers at zoom 9, **when** they inspect a marker, **then** the IUCN letter glyph is visible inside the marker.
- **Given** a mobile user taps a marker, **when** the popup opens, **then** it renders as a bottom-sheet, dismissible by tap-outside or swipe-down.
- **Given** the current viewport has 0 visible markers but totalMarkers > 0, **when** this condition is detected, **then** the "no records in this area — Reset view" notice renders.
- **Given** a filter change re-fetches localities, **when** the request is pending, **then** existing markers render at 50% opacity; on resolve they are replaced.

---

### FE-07-5 — Map list-view toggle (accessibility)

**As** a screen-reader user or a user who prefers text, **I want** a list view of the map's locality data, **so that** I can access the same information without spatial interaction.

**Rendering:** Client component nested in `/map/`.
**Estimate:** S (1–2d).
**Dependencies:** FE-07-4.

UI: "View as list" toggle button (persistent, top-right of map shell). When toggled, the map is replaced (or overlaid, dev choice) by a semantic `<table>` rendering the same locality data as markers: scientific name (linked), IUCN status, locality name, type, presence, water body, year, source. Respects current filter state.

**Acceptance:**
- **Given** toggle is activated, **when** the list renders, **then** it contains one row per currently visible marker.
- **Given** a filter is applied in either mode, **when** the view is toggled, **then** both views show the same filtered subset.
- **Given** a screen reader is active, **when** the list renders, **then** the table has caption + `<th scope="col">` headers + rows navigable by standard table shortcuts.
- **Given** URL state, **when** `?view=list` is present, **then** the page loads directly into list view.

---

### FE-07-6 — Map Tier B (STRETCH)

**STRETCH GOAL.** Cut-criterion: Tier A passes the cut-line on 2026-05-08 EOD only if **all three** of the following hold. Any fail = Tier B is cut.

1. All FE-07-4 acceptance criteria demonstrably pass on staging.
2. `@ux-reviewer` pass on Tier A returns no outstanding severity-(a) items. (Invoke the agent against the live staging URL; log the memo alongside this spec.)
3. Keyboard + screen-reader walkthrough from the pre-departure checklist passes on Tier A.

Architecture Risk 1. The map itself is never cut — only the Tier B filter panel / overlays / stats bar.

**As** a power user, **I want** watershed/PA overlays, a filter panel, and a statistics bar, **so that** I can answer geographic/taxonomic questions directly on the map.

**Rendering:** Client-only.
**Estimate:** L–XL.
**Dependencies:** FE-07-4 complete + reviewed. No query cache: each filter change fires a fresh `fetch` with `AbortController` to cancel in-flight.

UI per v1 Tier B: watershed overlay, PA overlay (lazy), filter panel (family, IUCN, locality type, presence, watershed, coord precision), URL sync, statistics bar, mobile drawer.

**Acceptance:** v1 Tier B ACs apply unchanged. Additions:
- **Given** filter state is in URL, **when** the page loads, **then** filters + markers reflect URL state on first paint.
- **Given** a filter change fires mid-flight of the previous request, **when** the second change occurs, **then** the in-flight request is aborted.

---

### FE-07-7 — Dashboard `/dashboard/` (ISR + stale-while-revalidate + deep-links)

**As** a funder/journalist, **I want** a one-glance view of the conservation crisis, **so that** I understand why the platform exists.

**Rendering:** **ISR, `revalidate: 3600`, stale-while-revalidate.** Replaces v1 spec's pure SSR. A backend hiccup during live demo serves the last-cached render; the re-render happens in the background.
**Estimate:** M.
**Dependencies:** FE-07-0, FE-07-2 (directory must accept the filter params the deep-links use). **BE:** `last_updated` in ISO-8601 on `/api/v1/dashboard/`.

UI per v1 FE-07-3 spec, **plus:**
- Coverage-gap stat is a clickable link → `/species/?iucn_status=CR,EN,VU&has_captive_population=false`.
- Each IUCN chart bar is a clickable link → `/species/?iucn_status={cat}`.
- Chart axis labels use expanded form: "Critically Endangered (CR)" etc. Bars ordered CR→LC→DD→NE.
- Each bar has a visible count label (not hover-only).
- One-line chart caption (copy: `@conservation-writer`).
- "Updated N minutes ago" derived from `last_updated`.
- Page wrapped so backend failure at revalidate time does not produce 500 — stale render persists; freshness banner copy: "Live statistics temporarily unavailable — last known values shown" when staleness exceeds threshold (copy: `@conservation-writer`).

**Acceptance:**
- **Given** `/dashboard/` loads, **when** it renders, **then** coverage-gap stat, IUCN chart with expanded labels + count labels, three summary stats, field-programs count, and `last_updated` render.
- **Given** the coverage-gap stat is clicked, **when** navigation fires, **then** directory opens at `/species/?iucn_status=CR,EN,VU&has_captive_population=false`.
- **Given** a user clicks the "EN" chart bar, **when** navigation fires, **then** directory opens at `/species/?iucn_status=EN`.
- **Given** `/api/v1/dashboard/` fails at revalidate time, **when** the page is requested, **then** the last-successful cached render serves; background revalidation is retried next request.
- **Given** the page renders in the stale-while-failing state, **when** the freshness banner logic evaluates, **then** the banner renders with the fallback message.
- **Given** mobile viewport < 768px, **when** the page renders, **then** vertical stack, no horizontal scroll.

---

### FE-07-8 — Nav + footer + site shell + About stub

**As** any visitor, **I want** consistent navigation and footer on every page, **so that** I can move through the site and know who owns it.

**Rendering:** Layout (Server Component).
**Estimate:** S.
**Dependencies:** FE-07-0.

UI: Header links ordered **Dashboard → Map → Species Directory → About** (per UX 1.2 reordering; the reordered sequence leads with the crisis). Active-link indication. Footer: platform name, Apache-2.0 notice, GitHub link, data-source citation. About page = stub route with project owner, repo link, Leiss et al. 2022 + IUCN citations. Full copy by `@conservation-writer`.

**Acceptance:**
- **Given** any page, **when** nav is rendered, **then** links appear in order Dashboard → Map → Directory → About; current page is visually active.
- **Given** the About page loads, **when** it renders, **then** owner name, GitHub link, and citations are present.
- **Given** JS is disabled, **when** `/species/`, `/species/[id]/`, `/dashboard/`, `/` render, **then** core content is visible (dashboard chart may degrade).

---

### FE-07-9 — ESRI tile fallback pyramid

**As** a presenter on conference Wi-Fi, **I want** the satellite basemap to keep working if ESRI throttles or the venue drops, **so that** the live demo doesn't embarrass us.

**Rendering:** Static assets + client logic.
**Estimate:** S.
**Dependencies:** FE-07-4.

Work: pre-bake Madagascar-bbox z5–9 tile pyramid to `frontend/public/tiles/{z}/{x}/{y}.png` (~20–40 MB, ~1000 tiles, committed). Two Leaflet `TileLayer` instances (primary ESRI, fallback local); swap on fetch failure or `!navigator.onLine`. Clamp satellite max-zoom to 9 when on fallback. User notice on swap: toast or attribution change "Using offline basemap — satellite imagery unavailable" (copy: `@conservation-writer`).

**Acceptance:**
- **Given** ESRI tiles fail (5xx, timeout, or offline), **when** satellite layer is active, **then** Leaflet swaps to `/tiles/*` within one failed-tile cycle; attribution updates; max-zoom clamps to 9.
- **Given** the swap occurs, **when** the user sees the map, **then** the offline-basemap notice is visible.
- **Given** network recovers, **when** the user toggles satellite off/on, **then** ESRI resumes as primary.
- **Pre-departure test (not a ticket AC; checklist item):** Chrome DevTools "Slow 3G" + offline toggle reproduces the swap.

---

### FE-07-10 — Error boundaries + empty-state pattern

**As** any visitor, **I want** graceful copy on errors and empty filter results, **so that** I see helpful next steps, not blank pages or stack traces.

**Rendering:** `app/error.tsx` + `app/not-found.tsx` + shared `<EmptyState />` component.
**Estimate:** S.
**Dependencies:** FE-07-0.

Work: global error boundary, route-level `not-found.tsx` (themed 404), reusable `<EmptyState />` (title + body + primary action + secondary action). Every page that can render zero results (directory, map list, field-programs section on profile) uses `<EmptyState />`. Copy for each instance supplied by `@conservation-writer`.

**Acceptance:**
- **Given** any page throws, **when** `error.tsx` catches, **then** friendly message + "Try again" action render.
- **Given** `/species/9999/`, **when** it loads, **then** themed 404 renders with "browse all species" link.
- **Given** a filter combo returns 0 species, **when** directory renders, **then** `<EmptyState />` renders with [Clear filters] + [Browse all].
- **Given** a species has zero linked field programs, **when** profile renders, **then** the Field Programs section shows an `<EmptyState />`, not a broken or hidden section.

---

### FE-07-11 — Manual cache-bust admin action (spans FE + BE)

**CROSS-CUTTING: ships as a single story with FE and BE halves. Both must land by 2026-05-08 per architecture Risk 3.**

**As** an admin about to demo, **I want** a one-click "Revalidate public pages" action in Django Admin, **so that** a CARES update pushed at 9am is visible on the public site by the 10am session.

**FE half:** Next.js `/api/revalidate` route handler. Verifies shared secret (header or body). Accepts a `paths: string[]` in POST body (not a hardcoded list — arch handoff requirement). Calls `revalidatePath` for each. Returns 200/401/400 JSON. **Estimate FE:** XS.

**BE half:** Django admin action "Revalidate public pages" on relevant admin views; posts to the Next.js handler with the shared secret. Shared secret in Django settings (env) + Vercel env. **Estimate BE:** XS.

**Dependencies:** FE-07-0. Shared-secret plumbing on both sides — owner Aleksei, due 2026-05-08.

**Acceptance:**
- **Given** an admin clicks "Revalidate public pages" in Django admin, **when** the action fires, **then** a POST with the shared secret and `paths: ["/species", "/species/[id]", "/dashboard", "/"]` hits `/api/revalidate`.
- **Given** the handler receives a valid secret and path list, **when** it runs, **then** each path is revalidated; 200 returned.
- **Given** the handler receives an invalid/missing secret, **when** it runs, **then** 401 returned; no revalidation occurs.
- **Given** the handler receives a malformed body, **when** it runs, **then** 400 returned.
- **Given** revalidate completes, **when** a fresh request hits the revalidated path, **then** the render reflects latest backend state.
- **Given** the body supports an arbitrary `paths` list, **when** Gate 08's automatic webhook reuses the same endpoint, **then** no code change is required in the route handler (forward-compat check).
- **Given** `/api/revalidate` returns non-2xx or the request times out, **when** the Django admin action fires, **then** the admin sees a clear error message (status code for non-2xx, "timeout after Ns" for timeouts) — not a silent success — and the action can be re-triggered from the same admin page without a reload.

**Cache-warm companion script** (FE half of this story, not a separate ticket):

- Deliverable: `frontend/scripts/warm-cache.sh` (bash; keep dependency-free).
- Invocation: `BASE_URL=https://staging.<domain> ./scripts/warm-cache.sh`.
- Rehearsed against staging per pre-departure checklist.

Additional ACs:

- **Given** `frontend/scripts/warm-cache.sh` exists, **when** run with `BASE_URL` set, **then** it fetches `/`, `/dashboard/`, `/species/`, and N (≥5) representative `/species/[id]/` URLs and logs HTTP status + response time per URL.
- **Given** any warmed URL returns non-2xx, **when** the script completes, **then** it exits non-zero so the runbook's "warm → verify" step fails loud.

---

### BE-07-A — Directory filter backend support

**Backend story.** Add `has_captive_population` (boolean) filter and multi-select `iucn_status` on `/api/v1/species/`. Confirm `has_localities` (boolean) on species detail serializer.

**Owner:** Aleksei. **Due:** before first `/species/` directory PR (FE-07-2 start).
**Estimate:** S.

**Acceptance:**
- `GET /api/v1/species/?has_captive_population=false` returns only species with no tracked captive populations.
- `GET /api/v1/species/?iucn_status=CR,EN,VU` returns union of those categories.
- `GET /api/v1/species/{id}/` response includes `has_localities: boolean`.

---

### BE-07-B — `/api/v1/dashboard/` `last_updated` in ISO-8601

**Backend story.** Confirm / add `last_updated` field as ISO-8601 UTC string on dashboard endpoint.

**Owner:** Aleksei. **Due:** before first `/dashboard/` PR (FE-07-7 start).
**Estimate:** XS.

---

## 2. Sequencing (2026-04-17 → 2026-06-01)

Week numbers relative to 2026-04-17 (Fri).

| Week | Dates | Work |
|---|---|---|
| W1 | 04-17 → 04-24 | FE-07-0 scaffold + CI type-gen + Playwright + Vercel EU setup. BE-07-A + BE-07-B. Kick off FE-07-4 Tier A. BE dep: CORS for `*.vercel.app` due 04-30. *Note: FE-07-4 Tier A meaningful start realistically slips to W2 Monday — FE-07-0 scaffold and Playwright-against-preview plumbing must land first. Calendar absorbs the slip; Risk 1's week-1–2 window still holds.* |
| W2 | 04-25 → 05-01 | FE-07-4 Tier A finish. FE-07-9 ESRI fallback pyramid. FE-07-8 nav/footer/About stub. Begin FE-07-2 directory. |
| W3 | 05-02 → 05-08 | FE-07-2 directory finish (incl. new filters). FE-07-3 species profile. FE-07-1 hero. FE-07-11 (cache-bust, both halves). **05-08 EOD: Tier A review + Tier B cut/go decision.** Shared-secret plumbing due. |
| W4 | 05-09 → 05-15 | FE-07-7 dashboard (ISR + deep-links). FE-07-5 map list-view. FE-07-10 empty states / error boundaries pass across all pages. If Tier B go: start FE-07-6. |
| W5 | 05-16 → 05-22 | Stretch window: FE-07-6 Tier B (if go). Copy pass by `@conservation-writer` across glossary, About, empty states, microcopy. Staging alias `staging.<domain>` live. Polish + accessibility audit. **Dry-run the pre-departure checklist end-to-end (target 2026-05-22) — so 2026-05-29 is the second rehearsal, not the first.** |
| W6 | 05-23 → 05-29 | Freeze for polish. **Workshop-week cache-warm script tested.** Test-writer + reviewers. Pre-departure checklist (see §3). Revert `NEXT_REVALIDATE_SECONDS` default; set 60s only at workshop start. |
| Workshop | 06-01 → 06-05 | `NEXT_REVALIDATE_SECONDS=60` applied. Runbook: revalidate → warm → verify. |

**Pre-departure checklist (Fri 2026-05-29 or earlier):**
- Throttled-network test: DevTools "Slow 3G" + offline toggle; ESRI fallback swap verified.
- Four canonical demo URLs loaded on clean Chrome profile: `/`, `/dashboard/`, `/species/?iucn_status=CR,EN&family=Bedotiidae`, `/map/?species_id={sakaramyi_id}`.
- Verify `NEXT_REVALIDATE_SECONDS` is set correctly in Vercel env: `curl -sI https://staging.<domain>/ | grep -i cache-control` (or equivalent page-age probe) and assert the effective revalidate window is < 120s during workshop week. Document the expected header string in the runbook.
- Cache-warm script rehearsed against staging.
- Manual revalidate admin action rehearsed by Aleksei + one backup (per BA comms action #3).
- Keyboard-only navigation walkthrough of `/map/` and `/species/`.
- Print preview for `/species/[id]/` and `/dashboard/`.

**Workshop-week cache procedure:**
1. Set `NEXT_REVALIDATE_SECONDS=60` in Vercel env (Project → Settings → Environment Variables → Production; value entered as the string `60`, not `"60"`, not `60s`). Redeploy is required for the env change to take effect — trigger a deploy by pushing a noop commit or clicking "Redeploy" on the latest deployment. Verify via the pre-departure curl probe.
2. On each data push: run Django admin "Revalidate public pages" → run `frontend/scripts/warm-cache.*` → spot-check a profile.
3. Post-workshop: unset env var; revert to 3600s baseline.

---

## 3. Gate Exit Criteria

Gate 07 is shipped when all the following can be demonstrated on the staging URL to a non-technical observer:

1. `/` hero loads in < 2s on a warm cache; mission + coverage-gap stat + three nav cards visible without scroll; stat is clickable and lands on the filtered directory.
2. `/species/` renders all species with the new filter bar; `has_captive_population=false` and multi-select `iucn_status` work; URL state round-trips; empty state renders with clear copy.
3. `/species/[id]/` renders for a described species, an undescribed morphospecies, and a species with zero captive populations. 404 page is themed. "View on Map" appears iff `has_localities`.
4. `/map/` Tier A renders with IUCN-colored markers, clustering, popups, OSM + ESRI base layers, legend, and a working list-view toggle. Keyboard and screen-reader minimums verified. Mobile bottom-sheet popups work on a real phone.
5. ESRI tile fallback demonstrably swaps on simulated failure; satellite max-zoom clamps to 9; offline-basemap notice appears.
6. `/dashboard/` renders even when `/api/v1/dashboard/` is temporarily down (stale-while-revalidate); chart labels are full English words with count labels; coverage-gap stat and each chart bar deep-link into the directory with correct filters.
7. Manual cache-bust: Aleksei (or a second trained admin) clicks the Django admin action and within ~10 seconds the public pages reflect the change. Cache-warm script run afterward; conference-wifi storm avoided.
8. Nav order Dashboard → Map → Directory → About; About page present with owner + repo + citations.
9. CI: typecheck + openapi-typescript diff-check + Vitest + Playwright-against-preview all green on the main branch.
10. Throttled-network pre-departure test passed; four canonical demo URLs bookmarked; runbook printed.
11. Staging alias `staging.<domain>` (or a final agreed alias) live and shared with SHOAL/ECA organizers per BA comms action #1.
12. **If Tier B shipped:** filter panel, watershed/PA overlays, statistics bar, URL sync, AbortController cancel — all demoable.

Gate 07 is _not_ gated on analytics, auth UI, shadcn adoption, or any Gate 08 concern.

---

## 4. Backend Dependencies

Consolidated from architecture §"Backend dependencies flagged" + new items from reconciliation.

| # | Dependency | Owner | Due | Blocks |
|---|---|---|---|---|
| 1 | CORS on DRF allows `*.vercel.app` + staging alias | Aleksei | 2026-04-30 | All Playwright-against-preview runs |
| 2 | `/api/v1/schema/` reachable for openapi-typescript | Aleksei | 2026-04-24 | FE-07-0 CI wiring |
| 3 | `has_captive_population` filter + multi-select `iucn_status` on `/api/v1/species/` | Aleksei | before FE-07-2 start (~2026-04-28) | FE-07-2, FE-07-1 link, FE-07-7 deep-links |
| 4 | `has_localities` boolean on species detail serializer | Aleksei | before FE-07-3 start (~2026-05-02) | FE-07-3 "View on Map" visibility |
| 5 | `last_updated` ISO-8601 on `/api/v1/dashboard/` | Aleksei | before FE-07-7 start (~2026-05-09) | FE-07-7 freshness banner |
| 6 | `/api/revalidate` shared secret plumbed (Django settings + Vercel env) | Aleksei | 2026-05-08 | FE-07-11, workshop runbook |
| 7 | Django admin "Revalidate public pages" action (BE half of FE-07-11) | Aleksei | 2026-05-08 | FE-07-11 end-to-end |

---

## 5. Gate 07 → Gate 08 Handoff Notes

Implementation choices to preserve in Gate 07 so Gate 08 doesn't need a rewrite (BA memo §4):

1. **shadcn-compatible component shapes.** Hand-rolled `components/ui/` primitives (Badge, Button, Card) should use shadcn's API shape (props, variant names). Crib from shadcn MIT source; comment provenance at top of each file. Gate 08 adds `pnpm add shadcn` without refactor.
2. **Auth-header injection point in `lib/api.ts`.** `fetch` wrapper accepts an optional `headers` object (or callback) so Gate 08 auth can inject `Authorization: Token ...` without rewriting the fetch wrapper. Do this in FE-07-0, not retroactively.
3. **Flexible path list in `/api/revalidate`.** Route handler accepts `paths: string[]` in POST body (FE-07-11 AC). Gate 08's automatic `ConservationAssessment`/`Species.iucn_status` signal handler reuses the endpoint without code change.

Other Gate 08 boundary notes carried from BA memo (not implementation items, just calendar items):
- Introduce react-query or Server Actions at Gate 08 kickoff as a first-class decision.
- Institution-scoping will require a `lib/session.ts` companion.
- On-demand ISR webhook (Django signal → `/api/revalidate`) is Gate 08.
- Gate 09 i18n scoping agenda item for Gate 08 kickoff (target 2026-06-19, owner Aleksei).
- Post-workshop Vercel → EU-domiciled migration (Hetzner/Scaleway preferred).

---

## 6. Out of Scope for Gate 07

Explicit, do-not-build:

- Analytics (GA, Plausible, Umami — none at MVP).
- Error tracking (Sentry, LogRocket, Highlight, etc.). At MVP, frontend errors are visible only in Vercel logs and the client's browser console; backend errors in Django logs. Error tracking lands at Gate 08 alongside auth.
- Auth UI (login, logout, registration, session mgmt, token refresh).
- shadcn/ui adoption (`pnpm add` or Radix primitives).
- MapLibre GL, vector tiles.
- i18n / language switching (EN/FR/DE deferred to Gate 09 via `next-intl`).
- Coordinator-facing features (breeding recommendations, transfer records, per-institution data entry).
- Species images (S3/MinIO display).
- Per-institution captive-population detail (public aggregates only).
- On-demand ISR webhook from Django signals (Gate 08 — manual admin action is Gate 07).
- IUCN range polygons, survey-gap overlays, habitat suitability (post-MVP).
- Dashboard embedded mini-map; species profile embedded mini-map.
- Map-based data entry / user-contributed localities via frontend.
- Occurrence-data public pages, Darwin Core downloads via frontend.

---

## 7. Scope Summary Table

| Story | FE | BE | Full-stack | Complexity |
|---|---|---|---|---|
| FE-07-0 scaffold + CI | ✓ | | | M |
| FE-07-1 hero `/` | ✓ | | | S |
| FE-07-2 directory | ✓ | (dep on BE-07-A) | | L |
| FE-07-3 species profile | ✓ | (dep on BE-07-A item 4) | | L |
| FE-07-4 map Tier A | ✓ | | | L |
| FE-07-5 map list-view | ✓ | | | S |
| FE-07-6 map Tier B (STRETCH) | ✓ | | | L–XL |
| FE-07-7 dashboard ISR + deep-links | ✓ | (dep on BE-07-B) | | M |
| FE-07-8 nav/footer/About stub | ✓ | | | S |
| FE-07-9 ESRI fallback pyramid | ✓ | | | S |
| FE-07-10 error + empty-state pattern | ✓ | | | S |
| FE-07-11 manual cache-bust | | | ✓ | S (sum of halves) |
| BE-07-A directory filter support | | ✓ | | S |
| BE-07-B dashboard `last_updated` | | ✓ | | XS |

---

## 8. Risks and Open Questions

Reference architecture §10 for the canonical risk register (map calendar, type drift, ISR ghost, ESRI failure). This spec does not duplicate them.

Open items tracked elsewhere, flagged here for visibility:
- Stakeholder comms (6 items) — BA memo §3, owner Aleksei.
- Second-admin trained on cache-bust runbook — BA memo §3 item 3.
- Public-facing domain decision — UX 4.5, target 2026-05-01.
- Copy ownership (IUCN/CARES glossary, About, empty states, microcopy) — delegated to `@conservation-writer` from inside each ticket.
