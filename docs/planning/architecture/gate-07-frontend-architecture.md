# Gate 07 Frontend Architecture — MVP Public Site

**Status:** Proposed
**Target:** ECA Workshop demo, June 1–5, 2026 (hard deadline)
**Scope:** Next.js 14 App Router public read-only frontend consuming the existing `/api/v1/*` DRF surface. Tier 1 only, no auth UI.

The PM spec (`gate-07-mvp-public-frontend.md`) locks Next.js 14, TypeScript, Tailwind, Leaflet, and the four pages. This document decides everything else, biased toward boring choices a solo developer can ship in ~6 weeks.

---

## 1. Repo Layout

**Decision:** Monorepo. Add `frontend/` as a sibling of `backend/` in this repository.

Rationale: The frontend's contract is the DRF serializers. Keeping them in one repo means a serializer change and its TS type regeneration land in the same PR, and Gate 05/07 reviewers see both sides. A separate repo costs a second CI pipeline, a second issue tracker, and cross-repo PR choreography that a solo dev cannot afford.

CI structure: keep the existing `backend` job unchanged and add a second top-level job `frontend` that triggers only on changes under `frontend/**` (path filter). Not a matrix — two sibling jobs. Avoids running Python tests on a pure frontend PR and vice versa.

---

## 2. Package Manager

**Decision:** pnpm.

Rationale: Next.js 14 + Leaflet + recharts pulls a large dependency tree; pnpm's content-addressable store cuts cold `install` from minutes to seconds on CI and keeps the `frontend/node_modules/` out of the Docker build context cleanly via `.dockerignore`. npm works but wastes CI minutes we will want back in May. Bun is too new to trust for a June deadline with Leaflet's native-ish plugin ecosystem.

Commit `pnpm-lock.yaml`; pin pnpm version in `package.json` via `"packageManager"` field so CI and local agree.

---

## 3. Data Fetching Pattern

**Decision:** Raw `fetch()` inside Server Components, wrapped by a single thin module `frontend/lib/api.ts` that injects `NEXT_PUBLIC_API_URL`, sets `Accept: application/json`, and normalizes error handling (throws a typed `ApiError` that page-level `error.tsx` boundaries catch). No react-query. No tRPC. No SWR.

Rationale: Every page in the spec is either SSG-with-revalidate (`/species/`, `/species/[id]/`) or SSR (`/dashboard/`), where Next's built-in `fetch` with `{ next: { revalidate } }` already provides caching and deduplication. Client-side refetch is only needed on `/map/` when filters change, and there a single `useEffect` plus `AbortController` is simpler than adopting react-query for one use case. One pattern, one mental model.

---

## 4. Type Sharing with DRF

**Decision:** `openapi-typescript` generating `frontend/lib/api-types.ts` from the drf-spectacular schema.

Concrete generator:

```bash
# from repo root
pnpm --filter frontend exec openapi-typescript http://localhost:8000/api/v1/schema/ -o frontend/lib/api-types.ts
```

Wrapped as `pnpm gen:types` in `frontend/package.json`. Runs:
1. On demand by the developer after a serializer change (documented in `CLAUDE.md` conventions).
2. In CI as a check: regenerate, then `git diff --exit-code frontend/lib/api-types.ts`. If drift exists the PR fails with "run pnpm gen:types". This catches missed regenerations without auto-committing from CI.

Hand-written view-model types in `frontend/lib/types.ts` re-export and narrow from `api-types.ts` (`components['schemas']['Species']`) so page code imports from `lib/types` and never touches the generated file directly. This keeps generator churn isolated.

Not tRPC: DRF isn't a tRPC backend; fighting the ecosystem isn't worth it.

---

## 5. Map Stack

**Decision:** Leaflet + react-leaflet + leaflet.markercluster, per PM spec. Already locked — confirming the choice.

Eyes-open caveat: `leaflet.markercluster` has had sparse maintenance in recent years. It works and is widely deployed, but pin the version in `package.json` (no `^` range), don't expect upstream fixes during the workshop window, and be willing to fork-and-patch if a blocker surfaces. If the library becomes untenable post-workshop, Supercluster + a custom layer is the fallback.

Raster tiles:
- **Base (default):** OpenStreetMap tiles via `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with the OSM attribution string. Zero cost, no token. Acceptable for a conservation nonprofit demo; we are well under any reasonable tile-usage threshold.
- **Satellite:** ESRI World Imagery via `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` with ESRI attribution. Also token-free.

Do **not** introduce MapLibre GL or Mapbox for MVP. MapLibre is the right long-term call once we have vector watershed tiles, but Leaflet handles clustered points + two GeoJSON polygon layers + popups with zero WebGL debugging, and every UX requirement in the spec is achievable on Leaflet. Flag MapLibre migration as a post-MVP track.

Dynamic import the map module (`next/dynamic` with `ssr: false`) so Leaflet's `window` references don't break the build.

---

## 6. Styling Conventions

**Decision:** Tailwind + a minimal custom component set in `frontend/components/ui/`. **No shadcn/ui as a dependency at MVP.**

Rationale: The spec requires about a dozen UI primitives (Badge, Card, Button, StatBlock, LegendKey, LayerToggle). shadcn pulls in Radix primitives, cva, and a styling pattern that rewards an app with dropdowns/dialogs/toasts — we have none of those in the Tier 1 read-only MVP. Writing six custom components against Tailwind is faster than learning shadcn conventions under deadline. Leave a note in the architecture doc that shadcn becomes the right answer at Gate 08 (coordinator UI with forms, dialogs, auth).

**Acceptable shortcut:** crib the shadcn component source for Badge / Button / Card as a starting point and strip the Radix/cva dependencies. shadcn is MIT-licensed and explicitly designed to be copied, not installed. You get a battle-tested API shape and accessibility defaults without taking on the dependency. Note the provenance in a comment at the top of each cribbed file.

IUCN color tokens live in `frontend/lib/iucn.ts` as a single exported object keyed by category code (`CR`, `EN`, `VU`, `NT`, `LC`, `DD`, `NE`), each entry providing `{ bg, fg, border }` Tailwind class strings. Reused by badges on directory cards, profile header, dashboard chart, and map legend. Co-locating the IUCN palette with the category enum (rather than in `tailwind.config.js`) means the map page can import it for Leaflet marker styling where Tailwind classes don't apply.

---

## 7. Dev Loop

**Decision:** Native `pnpm dev` on the host, pointed at the dockerized API. No frontend service in docker-compose at MVP.

Rationale: Next.js dev-server HMR is noticeably slower inside Docker on macOS (the host's primary platform here) due to filesystem event translation. The API already runs in compose; the frontend only needs `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`. Configure `next.config.js` to rewrite `/api/*` → `http://localhost:8000/api/*` to sidestep CORS in dev. For the staging deployment, the frontend runs on Vercel (see §8), not in compose.

Trade-off acknowledged: contributors must run `pnpm install` locally. For a solo dev this is a non-issue; document in a new `frontend/README.md`.

**Revisit trigger:** once a second developer joins the frontend (likely Gate 08+ if Rashel or Jim picks up UI work), adding a `frontend` service to docker-compose with HMR via bind-mount becomes worth the macOS FS-event tax. Don't do it preemptively.

---

## 8. Staging Deploy

**Decision:** Vercel free tier, **deployed to the EU region (`fra1`)**, for the Next.js staging URL through the June 2026 workshop. Plan a migration to **an EU-domiciled host (Hetzner or Scaleway preferred; Fly.io EU region as fallback)** as a post-MVP track, targeted at Gate 09 or earlier if handover planning accelerates.

Rationale for EU region at MVP: data-governance trajectory points at a European partner handover. Even though Tier 1 MVP handles no user PII, visitor IP addresses in access logs and analytics are personal data under GDPR. Pinning the edge to `fra1` at MVP is free, buys compliance optics immediately, and avoids a regional-config change layered on top of the Gate 09 migration.

Rationale for EU-domiciled migration target (change from earlier Fly-only plan): if the platform is handed to a European conservation nonprofit post-workshop, running it on US-incorporated Vercel or Fly — even in EU regions — creates a Schrems II / cross-border-transfer story that the successor org has to explain. Hetzner Cloud (Germany, cheapest) or Scaleway (France) are the strongest candidates for a fully EU-domiciled deploy. Fly.io EU (`fra`) remains the fallback if self-hosting ops overhead bites during the Gate 09 window.

Rationale: Vercel is first-party for Next.js App Router — ISR, image optimization, and preview deploys per PR work out of the box with zero config. Preview-per-PR is genuinely useful while iterating with the BA/PM/UX agents before the workshop. Zero-config ISR removes a whole risk category five weeks before a hard deadline.

Why not Hetzner/Fly for MVP: both require a Dockerfile, persistent volumes for ISR cache, and manual preview-deploy plumbing. Hetzner additionally means managing our own Node runtime and TLS. Each is a May-timeline risk we don't need to demo four pages to workshop attendees.

Why migrate to EU-domiciled post-MVP: the governance model (Aleksei owns/hosts at launch, likely European partner handover) argues for minimizing vendor surface area *and* US-vendor exposure. A fully EU-domiciled host means one vendor, one jurisdiction, and a clean story for successor-portability. Vercel's on-demand ISR hooks are Vercel-shaped — the longer we lean on them, the more the migration costs. Doing it after the workshop but before Gate 08's coordinator UI ships is the right window, because Gate 08 adds real user PII (accounts, institutional data, breeding recommendations) which sharply raises the compliance stakes.

**Analytics policy at MVP:** no Google Analytics, no US-based behavioral analytics. If traffic measurement is needed pre-workshop, use Plausible or self-hosted Umami on the EU region. Simplest option: ship without analytics at MVP — add at Gate 09 post-migration when the privacy posture is settled.

Split deployment during MVP (Next on Vercel, DRF on Fly-or-current-host) is fine because `NEXT_PUBLIC_API_URL` is the only coupling.

Pre-workshop risk mitigation: set up Vercel in **April**, not May. Verify CORS headers on the DRF API allow the Vercel preview URL domain (`*.vercel.app`) — this is the one cross-service gotcha. Add a stable `staging.<domain>` alias by mid-May so the workshop attendees can bookmark a clean URL.

Migration-readiness constraints while on Vercel: keep the Next.js build output `standalone`-compatible (don't adopt Vercel-only APIs like `@vercel/og` or Edge Middleware for core flows), and document every `revalidatePath` call site so the Fly port knows what cache-invalidation surface needs re-implementing. If something has to be Vercel-specific to hit the June deadline, tag it `// VERCEL-ONLY` so the migration pass can find it.

GitHub Pages and static export are rejected — they cannot serve SSR/ISR, which the spec requires for `/species/[id]/` and `/dashboard/`.

---

## 9. Testing Strategy

**Decision:** Vitest for unit/component tests, Playwright for a single end-to-end smoke suite. CI's first JS job runs lint + typecheck + Vitest; Playwright runs in a second job on every PR against the Vercel preview URL, plus nightly against staging.

Initial test budget (what's in CI at gate close):
- Vitest: IUCN badge color mapping, undescribed-taxon badge rendering, dashboard coverage-gap number formatting, API error boundary renders friendly message. ~8-12 tests.
- Playwright: one spec that asserts each of the four pages returns 200 with expected key text ("Endemic Freshwater Fish Species", the coverage-gap sentence, the map legend). **Runs on every PR against the Vercel preview deployment.** Also runs nightly against the stable `staging.<domain>` alias as a canary against drift in long-lived cached state.

Per-PR signal is non-negotiable given the hard June deadline: nightly-only means a Friday-afternoon merge isn't caught until Saturday. Previews make this cheap.

**Preview-URL discovery gotcha (wire this right the first time):** Vercel's deployment-ready webhook sometimes lags the PR commit by 30–90 seconds. A naive Playwright job that reads the deployment URL immediately will race the build and flake. Use the `patrickedqvist/wait-for-vercel-preview` GitHub Action (or equivalent) to poll the deployment status with backoff, then pass the resolved URL into Playwright as `PLAYWRIGHT_BASE_URL`. Do not hand-roll the polling logic — this is the kind of thing that eats a Tuesday morning in May when a flake is "only intermittent."

Not React Testing Library + Jest — Vitest is faster, first-class with Vite/TS, and one tool covers both unit and component needs. Not Cypress — Playwright has better CI ergonomics and is already the industry default in 2026.

The adversarial test pass at gate close is the Test Writer agent's job per the PM spec; this section defines the starting framework, not the full suite.

---

## 10. Top Three Risks (2026-04-17 → 2026-06-01)

1. **Map polish eats the calendar.** The `/map/` page is the largest single surface area in the spec (Tier A alone has nine acceptance criteria plus mobile/tablet responsiveness). Leaflet + clustering + IUCN-coded markers + popup hierarchy is easy to ship ugly and hard to ship credibly. **Mitigation:** Build `/map/` Tier A first, in week 1–2, not last. **Tier B (advanced filter panel with server-side filter state + URL sync) is a stretch goal with an explicit cut-criterion:** if Tier A is not polished by end of week 3 (2026-05-08), Tier B is cut. **The map itself is never cut — this is the central demo artifact.** Tier A without Tier B still ships a fully usable map with markers, clustering, popups, basemap switching, and a basic legend.

2. **Type drift between DRF and frontend ships a broken demo.** A serializer field rename in a Gate 06 follow-up silently breaks `/species/[id]/` in production. **Mitigation:** The CI `openapi-typescript` diff-check described in §4 must be wired up in the first frontend PR, not later. Treat generated types as a blocking check.

3. **ISR + IUCN sync cache ghost.** `/species/` is SSG with 24h revalidate. If the weekly IUCN sync lands a status change but the page is still within its revalidation window, the public site shows stale badges and a funder asks why. In a live-workshop context this is worse: Claudia could push a CARES update at 9am on demo day and an hour-old cache would still serve the old badge at the 10am session. **Mitigation (tiered, all landing before workshop):**
   - **Baseline (always on):** revalidate = 3600s (1 hour) on `/species/` and `/species/[id]/`. Catches the weekly sync case without any infra.
   - **Workshop week override:** drop revalidate to 60s for the workshop week only via an env var (`NEXT_REVALIDATE_SECONDS`). Reverted automatically by date or manually post-workshop. Trivial to wire.
   - **Manual cache-bust (ship before workshop):** Django admin action "Revalidate public pages" that POSTs to a Next.js `/api/revalidate` route handler with a shared secret, which calls `revalidatePath('/species')` and `revalidatePath('/species/[id]')`. Realistic effort ~60–90 min including the shared-secret plumbing across Vercel env and Django settings. Not a Gate 08 deferral — this is pre-workshop hardening.
   - **Deferred to Gate 08:** a Django signal handler that auto-fires the same webhook on `ConservationAssessment` accept / `Species.iucn_status` change, removing the manual step.

**Secondary risk — ESRI tile failure on conference Wi-Fi (promoted from parenthetical).** Live-demo killer if ESRI throttles or the venue network drops. Concrete mitigation:
1. Pre-bake a Madagascar-bbox tile pyramid at zoom 5–9 into `frontend/public/tiles/{z}/{x}/{y}.png`. Total footprint ~20–40 MB (~1000 tiles); commit to the repo, served by Vercel's static edge.
2. Wire two Leaflet `TileLayer` instances — primary ESRI, fallback local — and swap on fetch failure or `!navigator.onLine`. `leaflet.offline` / IndexedDB is overkill for a known bbox.
3. **Test on a throttled network before the flight.** Chrome DevTools "Slow 3G" + offline toggle, replicate the failure mode, confirm the swap works. This is a pre-departure checklist item, not an "if time permits."

Other secondary risks worth logging: Leaflet SSR gotchas on Vercel build, and the 79–100 species count producing visually sparse filter states that make the directory feel empty.

---

## 11. UX Review Absorption (2026-04-17)

Post-architecture UX review (`docs/planning/ux-review/gate-07-ux-review.md`) surfaced items that change scope. Decisions from Aleksei on 2026-04-17:

- **`/` route = minimal hero page** (not a dashboard redirect). One-sentence mission, the coverage-gap headline stat, three large cards linking to Directory / Map / Dashboard. Rendering: Server Component, `revalidate: 3600`.
- **`/dashboard/` rendering: SSR → ISR with stale-while-revalidate.** Same `revalidate: 3600` as the other pages. Rationale: a backend hiccup during a live demo must not produce a full-page error. ISR serves the last-cached render instantly while regenerating in the background. "Updated N minutes ago" timestamp remains accurate because the `last_updated` field is re-fetched with the render.
- **Accessibility list-view toggle on `/map/`:** build. A "View as list" button that renders the same locality data as a screen-reader-friendly table. Addresses map-accessibility gap (UX 3.1/3.2). Estimated 1–2 days.
- **Clickable dashboard stats + chart bars → directory deep-links:** in scope for Gate 07. Requires adding a `has_captive_population` filter to the directory and `iucn_status` multi-select support (if not already present). Backend dependency: confirm DRF filter backend supports these on the species list endpoint; flag for Aleksei.
- **Data-governance trajectory:** Vercel EU region (`fra1`) at MVP; Gate 09 migration retargeted from Fly.io to EU-domiciled (Hetzner or Scaleway preferred). See §8.

## Decisions Locked vs. Decisions Deferred

**Locked for Gate 07 implementation:**
- Monorepo layout, `frontend/` sibling of `backend/`, path-filtered CI jobs
- pnpm with pinned `packageManager` field and committed lockfile
- Raw `fetch()` in Server Components via `lib/api.ts`; no client-side data lib
- `openapi-typescript` generation against drf-spectacular schema; CI diff-check enforcement
- Leaflet + react-leaflet + markercluster; OSM and ESRI raster base layers; no MapLibre
- Tailwind with a hand-rolled `components/ui/`; no shadcn at MVP
- IUCN color tokens in `frontend/lib/iucn.ts` (not `tailwind.config.js`)
- Native `pnpm dev` against dockerized API; no frontend container in compose
- Vercel free tier **EU region (`fra1`)** for staging, aliased to a stable subdomain by mid-May
- **`/` = minimal hero page** with mission + coverage-gap stat + three nav cards; `revalidate: 3600`
- **`/dashboard/` = ISR (not SSR)** with `revalidate: 3600` and stale-while-revalidate fallback on backend failure
- **Map list-view toggle** built for accessibility; same data as map markers, rendered as a screen-reader-friendly table
- **Dashboard deep-links:** coverage-gap stat and IUCN chart bars link into `/species/` with pre-applied filters; requires `has_captive_population` filter in DRF (backend dep)
- **No analytics at MVP.** Add EU-hosted Plausible/Umami post-Gate-09 if needed.
- Vitest for unit/component, Playwright smoke suite on every PR against Vercel preview + nightly against staging
- **Revalidate = 3600s baseline** on `/species/` and `/species/[id]/` (overrides the PM spec's 24h default); overridable via `NEXT_REVALIDATE_SECONDS` env var for workshop-week 60s
- `/map/` Tier A built first; Tier B is a stretch goal

**Deferred, needs input before Gate 08 or post-MVP:**
- **Vercel → Fly.io migration** for the frontend, targeted post-workshop (Gate 09 window). Driven by governance/handover, not by hitting Vercel limits. Keep the build `standalone`-compatible in the meantime.
- Production deploy target and domain strategy (who owns `madagascarfish.org`-equivalent DNS)
- shadcn/ui adoption at Gate 08 when forms, dialogs, and auth UI arrive
- MapLibre GL migration once vector watershed tiles exist
- On-demand ISR invalidation webhook from Django → Next.js (Gate 08)
- Image hosting and display strategy (S3/MinIO assets are out of scope per spec but will be needed for a real product)
- **i18n — UI chrome in English, French, and German at launch.** Right-to-left support not needed at this stage. Separate from per-species common-name data (Malagasy and French common names already live in the data model; the UI would surface whichever matches the selected language, falling back to English).
  - **Target:** Gate 09, post-workshop. The audience for the June 2026 ECA Workshop is anglophone conservation professionals; adding language switching pre-June trades deadline risk for an audience that doesn't need it.
  - **Implementation note for scoping later:** `next-intl` is the current best fit for App Router (server-component-first, type-safe messages). Avoid `next-i18next` (Pages-Router-era).
  - **Concrete trigger (so it doesn't drift to September):** add "Gate 09 i18n scoping" as a required agenda item on the Gate 08 kickoff, scheduled within two weeks of return from Albuquerque (target 2026-06-19). Owner: Aleksei. If Gate 08 kickoff slips, this trigger slips with it but stays tethered to a real meeting rather than a vibe.

**Backend dependencies flagged (no new Gate 07 backend work) — all owned by Aleksei, all due by 2026-04-30 unless noted:**
- **CORS on DRF allows the Vercel preview-URL domain (`*.vercel.app`) and the stable staging alias.** Owner: Aleksei. Due: 2026-04-30.
- **`/api/revalidate` shared-secret plumbing** (Risk 3 mitigation): Django setting + Vercel env var + the Next.js route handler. Due: 2026-05-08.
- Confirm `/api/v1/dashboard/` returns `last_updated` in ISO-8601 (Dashboard story FE-07-3 depends on it). Owner: Aleksei. Due: first `/dashboard/` PR.
- **Confirm DRF species list filter supports `has_captive_population` (boolean) and multi-select `iucn_status`** for the dashboard deep-links (§11). Owner: Aleksei. Due: first `/species/` directory PR. If unsupported, add as a small backend story.
- **Confirm `Species` serializer exposes `has_localities` (or a locality count field)** for the "View on Map" button visibility (spec FE-07-5). Owner: Aleksei. Due: first `/species/[id]/` PR.
- Confirm `/api/v1/schema/` is reachable in dev for `openapi-typescript` (already verified in `config/api_urls.py`).
