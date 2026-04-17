# Gate 07 Reconciliation Memo

**Date:** 2026-04-17
**Scope:** Reconcile locked Gate 07 architecture against pre-architecture PM spec. Not a rewrite.
**Inputs:**
- `docs/planning/architecture/gate-07-frontend-architecture.md` (locked 2026-04-17)
- `docs/planning/specs/gate-07-mvp-public-frontend.md` (pre-architecture)
- `docs/planning/business-analysis/ba-assessment-v1.md`

---

## 1. Architecture-driven changes the PM spec needs to absorb

| Architecture decision | Spec impact | Classification |
|---|---|---|
| **Revalidate = 3600s baseline** (arch §10 Risk 3) | Spec FE-07-1 says "SSG with revalidation every 24 hours." PM must change the rendering note on `/species/` and `/species/[id]/` to `revalidate = 3600` (1h), configurable via `NEXT_REVALIDATE_SECONDS`. Also: spec FE-07-2 currently says `/species/[id]/` is SSR — architecture treats it as SSG-with-revalidate. **Reconcile to SSG+revalidate** (matches arch §3 and the cache-bust story). | **Clarifies + shrinks** FE-07-1, FE-07-2. One-line AC change, not a new story. |
| **Workshop-week 60s override** via `NEXT_REVALIDATE_SECONDS` env var | Not in spec at all. Add a single operational AC to Gate Exit Criteria (or to FE-07-1/2): "Given workshop week, when `NEXT_REVALIDATE_SECONDS=60` is set in Vercel env, then `/species/` and `/species/[id]/` revalidate within 60s of a backend change." | **Expands** — new, small operational AC. Not a new user story. |
| **Manual `/api/revalidate` admin action** (arch §10 Risk 3, due 2026-05-08) | Not in spec. Needs a new story — but note it spans frontend (route handler + shared-secret check) **and backend** (Django admin action + shared secret). Owner flagged as Aleksei, due 2026-05-08, so it must appear in Gate 07 sequencing. | **Expands** — one new story with BE + FE halves. Recommend PM write it as "FE-07-6: Manual cache-bust admin action" with a backend dependency callout. |
| **ESRI tile fallback pyramid** (arch §10 Secondary risk): pre-baked z5–9 Madagascar tiles in `frontend/public/tiles/`, automatic swap on fetch failure or offline | Spec FE-07-5 Tier A lists "ESRI World Imagery (satellite) as switchable base layers" but assumes network availability. The fallback is new scope. | **Expands** FE-07-5 Tier A. Add AC: "Given ESRI tiles fail to load or `navigator.onLine === false`, when the satellite layer is active, then Leaflet swaps to the locally-bundled tile pyramid and the map remains usable at z5–9." Also add a pre-departure checklist item to Gate Exit Criteria. |
| **EN/FR/DE i18n deferral to Gate 09** (arch §"Deferred") | Spec "Out of Scope" already says "Multilingual UI (English only at MVP)". Architecture is consistent; it just names the target gate (09) and the library (`next-intl`). | **Clarifies, no change needed** — confirms existing spec language. PM should note Gate 09 i18n scoping as an agenda item on Gate 08 kickoff (owner Aleksei, target 2026-06-19), but that's a planning-calendar artifact, not a spec change. |

**Net:** one genuinely new story (manual revalidate), one expanded AC set (ESRI fallback), two clarifications (revalidate cadence + rendering mode for species profile), one confirmation (i18n deferral).

---

## 2. PM spec requirements that can't be delivered under the locked architecture

- **FE-07-2 Species Profile rendering = "SSR with `getServerSideProps`"** — `getServerSideProps` is a Pages Router API; the architecture locks App Router. SSR in App Router is the default for Server Components without `revalidate`. Architecture §3 and §10-Risk-3 explicitly treat `/species/[id]/` as SSG+revalidate, not pure SSR. PM should rewrite the rendering note to "Server Component with `fetch(..., { next: { revalidate: 3600 } })`" to match both the App Router lock and the caching strategy.
- **No react-query / no SWR / no tRPC** — spec doesn't require any of these, so no conflict. The one possible snag is **Tier B filter panel on `/map/`** (FE-07-5 Tier B): the spec implies client-side refetch when filters change. Architecture §3 endorses this via `useEffect` + `AbortController`. Confirm PM doesn't assume a query cache; acceptable as-is but worth a note in the Tier B story: "No query cache; each filter change fires a fresh request with AbortController."
- **No shadcn at MVP** — spec doesn't name shadcn, so no conflict. PM should not introduce component names that assume shadcn primitives (Dialog, Dropdown, Toast). None currently appear in the spec.
- **No MapLibre, no vector tiles** — spec is Leaflet + raster only; matches architecture. No conflict.
- **24h revalidate** — already addressed in §1; not deliverable as written, needs change to 3600s.
- **Chart library** — spec allows recharts or chart.js. Architecture is silent; PM should pick recharts in the ticket. No blocking conflict.
- **Deployment target** — spec says "Fly.io or Vercel staging." Architecture locks **Vercel** for MVP with Fly.io as post-workshop migration. PM should strike "Fly.io or" from the deliverables and exit criteria, and add the post-workshop Fly migration as a deferred work item (not a Gate 07 task).

Nothing else in the spec is undeliverable under the locked architecture.

---

## 3. Business-side signoffs and communications triggered by the architecture

These are not PM tickets — they are stakeholder/comms actions Aleksei needs to own.

1. **Vercel staging URL — brand and attribution signoff.** The platform will be publicly reachable at a `*.vercel.app` (then `staging.<domain>`) URL weeks before the workshop. Confirm with co-stakeholders (SHOAL/Georgie Bull contact, future CARES 2.0 contacts, any ABQ BioPark liaison) that a pre-release staging URL carrying the platform's name is acceptable. **Action:** short email to SHOAL and ECA Workshop organizers by 2026-05-15 giving them the staging URL and framing it as "preview; final URL TBD."
2. **OSM + ESRI attribution strings.** Both tile sources require attribution. This is a legal/license matter. **Action:** confirm the exact attribution strings are rendered in the Leaflet map control, match OSM's and ESRI's current required wording, and appear legibly at workshop-demo zoom levels. Cheap to check, expensive to miss — OSM's policy is the more strictly enforced of the two.
3. **Workshop-week cache-bust procedure — who pushes the button.** The manual `/api/revalidate` admin action is an admin-authenticated Django action with a shared secret. If Aleksei is mid-presentation when Claudia pushes a CARES update, someone else may need to trigger the revalidate. **Action:** decide whether a second person (e.g., Rashel or Jim, if they're registered admins by June) has access, and document the procedure in a one-page runbook for the workshop.
4. **Fly.io migration commitment post-workshop.** Architecture §8 commits the platform to moving off Vercel "targeted at Gate 09 or earlier." This is a real cost/time commitment (Dockerfile, ISR cache volume, preview-deploy re-plumbing). **Action:** log this as a post-workshop obligation in the governance doc alongside the handover plan. Affects hosting cost, vendor footprint, and successor-portability, which are governance-adjacent.
5. **OSM usage-policy compliance.** OSM's tile usage policy forbids "heavy use" without running your own tile server. A Madagascar-only public demo is well under their threshold, but if the platform gains traction post-workshop, this becomes a real constraint. **Action:** flag for post-workshop review — not a pre-June blocker, but should be on the Gate 09 agenda.
6. **Vercel Terms of Service and data residency.** Vercel's free tier ToS permits commercial use; there is no sensitive data served at Tier 1, so this is low-risk. Worth a one-line note in the governance doc that MVP public-tier data runs on a US vendor. Not a signoff, a disclosure.

---

## 4. Gate 07 → Gate 08 handoff risks for the PM

Things Gate 07 is deliberately not building that Gate 08 (coordinator UI) will need. Flagging now so PM can keep the boundaries clean.

1. **shadcn/ui adoption is a Gate 08 prerequisite, not a Gate 08 story.** Gate 08 introduces forms, dialogs, and auth UI — all shadcn's sweet spot. The handoff risk is that the hand-rolled `components/ui/` Badge/Button/Card set in Gate 07 will diverge from shadcn's API shape, forcing a rewrite at Gate 08. **Mitigation:** the architecture already recommends "crib shadcn source" for Button/Badge/Card, which keeps API shapes aligned. PM should make this explicit in the Gate 07 tickets ("use shadcn-compatible component shapes; provenance comment at file top") so Gate 08 can `pnpm add` shadcn and swap without a refactor.

2. **Auth UI is not in Gate 07 at all.** Spec is explicit (coordinators use Django Admin). Gate 08 will need session handling, token refresh, login/logout flows, and tier-aware client-side routing — none of this has a stub in Gate 07. Boundary is clean **provided** `lib/api.ts` is written without auth-header support assumptions baked in; it should accept an optional header injection point so Gate 08 can add `Authorization: Token ...` without rewriting the fetch wrapper.

3. **On-demand ISR webhook (Django → Next.js auto-revalidate).** Architecture §10 Risk 3 defers the Django signal handler to Gate 08. Gate 07 ships the manual admin action; Gate 08 must wire a signal on `ConservationAssessment` accept and `Species.iucn_status` change. **Risk:** if Gate 07's `/api/revalidate` route handler is written to revalidate only a fixed list of paths (`/species`, `/species/[id]`), Gate 08 will need to either extend it or add a second handler. PM should write the Gate 07 handler to accept a path list in the POST body from day one — trivial to do, saves a Gate 08 rewrite.

4. **Coordinator features need client-side state that Gate 07 doesn't install.** Forms with optimistic updates, dialogs with local state, breeding-recommendation editors — these benefit from a client cache (react-query or equivalent). Gate 07 architecture explicitly rejects react-query. **Risk:** Gate 08 inherits a "no client fetch library" baseline and has to justify introducing one. Boundary is clean if PM notes in Gate 08 planning that introducing react-query (or Server Actions + `useFormState`) is an expected Gate 08 decision, not a deviation from Gate 07.

5. **Institution-scoping in the UI.** Tier 3/4 users see data scoped to their institution. Gate 07 is Tier 1 only, so none of this exists. But the API client in `lib/api.ts` will need to surface the authenticated user's tier and institution to page components — Gate 07 has no mechanism for this. **Boundary note:** fine to defer, but PM should flag in the Gate 08 spec that `lib/api.ts` will need a companion `lib/session.ts` or equivalent, and that some Gate 07 types (e.g., Species) will gain tier-gated fields at Gate 08 requiring the openapi-typescript regeneration pipeline to handle additive schema changes gracefully.

6. **Map page filter state in URL params** (Tier B, FE-07-5) — if built, this pattern is reused at Gate 08 for coordinator filters. If Tier B is cut for time (per architecture §10 Risk 1), Gate 08 inherits a greenfield URL-param-filter pattern to design. Not a risk per se, just a consequence of Tier B cut.

7. **Species profile "View on Map" cross-link** (spec FE-07-5) — the button is only shown when the species has ≥1 locality record. This requires the `/api/v1/species/{id}/` endpoint to return either a locality count or a boolean `has_localities` field. Spec doesn't explicitly list this field in the API dependency table. **Action for PM:** confirm with Aleksei that the species serializer exposes this; if not, add it to the "Backend dependencies flagged" list in the architecture doc (due before first `/species/[id]/` PR).

---

## Summary

- **One new story needed** (manual revalidate admin action) plus **one expanded AC set** (ESRI fallback pyramid) plus **two clarifying edits** (revalidate cadence, species profile rendering mode from SSR-with-getServerSideProps to App Router Server Component).
- **One undeliverable requirement** in the spec as written: `getServerSideProps` on FE-07-2. Needs rewrite to App Router semantics. Every other spec requirement is deliverable.
- **Six stakeholder/comms actions** for Aleksei, none requiring code: attribution signoff, workshop runbook for revalidate, Fly.io migration commitment documentation, OSM usage disclosure, staging-URL heads-up email to SHOAL/ECA, and a governance-doc note on Vercel.
- **Seven Gate 08 handoff notes** for the PM, three of which require small Gate 07 implementation choices (shadcn-compatible component shapes, auth-header injection point in `lib/api.ts`, flexible path list in `/api/revalidate` handler) to keep the Gate 07/08 seam clean.

No fundamental conflicts between the architecture and the spec. The reconciliation surface is small and tractable within the 6-week window.
