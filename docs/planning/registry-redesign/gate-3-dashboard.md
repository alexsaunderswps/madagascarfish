# Gate 3 — Ex-situ Coordinator Dashboard

**Status:** Spec kickoff (2026-04-21)
**Depends on:** Gate 1 shipped ✅ · Gate 2 closed by drift ✅
**Branch (when cut):** `feat/registry-redesign-gate-3-dashboard`
**Inputs:** `docs/design.md` §6 · `docs/planning/registry-redesign/README.md` (D1–D7) · current `backend/populations/models.py`
**Target audience:** ABQ BioPark workshop (June 1–5, 2026). The coordinator panels are the payload SHOAL will want to walk through.

---

## Why this gate exists

The current `/dashboard/` is a coarse Red-List category snapshot. It tells a public visitor "here's what's threatened"; it tells an ex-situ coordinator nothing actionable. Gate 3 rebuilds the page around the five panels a coordinator actually needs to triage breeding work — coverage gap first, Red List demoted to the bottom.

This is the conversation centerpiece for the SHOAL partnership discussion at ABQ. If Gate 3 doesn't ship, we walk into that meeting with a dashboard that doesn't demonstrate what the platform is for.

---

## Decisions locked

- **D3-1** — Public access to the coverage-gap panel. Tier 1 visitors see it. Single-institution-risk, studbook, and recently-updated panels are visible to Tier 1 but link-through to detail pages that may gate further at Tier 3+.
- **D3-2** — Red List snapshot stays, demoted. The existing `IucnChart` component moves to the bottom of the page; do not delete it. It still anchors the overall distribution narrative.
- **D3-3** — "Single-institution risk" threshold: species held by **≤ 2 distinct institutions**. Single-institution is the extreme; two-institution is still fragile. Cutoff is a constant in one place so we can tune it with one PR.
- **D3-4** — No new backend app. All panels live under existing apps: dashboard aggregates under `species/views_dashboard.py` or a sibling module; pure read queries.
- **D3-5** — Each panel fetches independently (one endpoint per panel). No monolithic `/dashboard-payload/` endpoint — that couples panels and makes per-panel revalidation harder.
- **D3-6** — Panels degrade gracefully. Empty states are styled, not blank. A panel with zero rows renders a short explanation, never a 500 or a loading-forever skeleton.

## Open questions (for BA pass)

1. **Coverage gap scope** — does "threatened with no captive population" mean `iucn_status ∈ {CR, EN, VU}` + zero `ExSituPopulation` rows, or do we include `DD` (data-deficient) and introduce a separate "needs assessment" bucket? UX review should weigh in.
2. **Single-institution risk sort** — by IUCN severity first, or by `institution_count` ascending first? Coordinators may want "most-imperiled-most-fragile" on top.
3. **Studbook status definition** — is "coordinated breeding" just `breeding_status = 'breeding'` across ≥ 1 population, or do we need a separate `coordinated_program` boolean / FK to `FieldProgram`? Start simple; escalate if coordinators push back.
4. **"Recently updated" window** — 30 days? 90 days? Tied to what event — any touch of the species row, or only conservation-relevant changes (assessments, populations, field programs)?
5. **Basin overlay on coverage gap?** Alex's idea (2026-04-21) of showing whether a species is covered by an existing Key Biological Area (KBA) overlay belongs in a future gate — but the *hook* (a `kba_coverage` annotation on the coverage-gap row) may be worth stubbing now. Flag for architecture review.

---

## Scope (initial panel definitions)

Each panel is a named section on `/dashboard/` with its own data endpoint and its own stop-ship story.

### Panel 1 — Coverage gap
**What:** Threatened Madagascar fish with no recorded captive population.
**Why:** The most actionable prompt for ex-situ coordinators — here are the species that need a program and don't have one.
**Data shape:** List of species rows with `scientific_name`, `family`, `iucn_status`, `primary_basin`, `endemic_status`. Sortable by IUCN severity (CR → EN → VU) then alphabetical.
**Backend:** `Species.objects.filter(iucn_status__in=['CR','EN','VU']).annotate(captive=Count('ex_situ_populations')).filter(captive=0)` — add dedicated endpoint `/api/v1/dashboard/coverage-gap/`.
**Empty state:** "No coverage gaps at the current threshold — every CR/EN/VU species has at least one captive population."

### Panel 2 — Single-institution risk
**What:** Species held at ≤ 2 distinct institutions.
**Why:** Even with a captive population, one-institution dependency is a fragility signal — a single incident wipes out the ex-situ safety net.
**Data shape:** Species rows with `institution_count`, `iucn_status`, `total_individuals` (sum across populations).
**Backend:** annotate `COUNT(DISTINCT institution)` per species, filter ≤ 2, exclude species with zero (those are in Panel 1).
**Empty state:** "No species are held at two or fewer institutions. Program redundancy looks healthy."

### Panel 3 — Studbook / coordinated breeding status
**What:** Roll-up of species by breeding coordination status.
**Why:** Distinguishes ad-hoc hobbyist holdings from coordinated conservation breeding. A species with 5 populations but no `breeding` status needs different work than one in a studbook.
**Data shape:** Three buckets — "coordinated breeding" (≥ 1 population with `breeding_status='breeding'`), "non-breeding holdings only," "no captive population." Click-through to filtered species list.
**Backend:** aggregate from `ExSituPopulation.breeding_status`.
**Empty state:** Each bucket can show a count of 0; no custom empty message needed.

### Panel 4 — Recently added / updated
**What:** Last 10–20 records touched across species, populations, or assessments, with a short description of what changed.
**Why:** Curator QA — catch stale-looking imports, recent contributor activity, and let a coordinator see "what's new since I last looked."
**Data shape:** Timeline-style rows: `{timestamp, entity_type, entity_label, change_summary, actor (tier-gated)}`.
**Backend:** union of `Species.updated_at`, `ConservationAssessment.updated_at`, `ExSituPopulation.updated_at` — or pull from the existing `AuditLog`. Architecture should advise.
**Empty state:** "Nothing has changed in the last 30 days." (Unlikely in practice but render cleanly.)

### Panel 5 — Red List snapshot (demoted)
**What:** The existing IUCN-category bar chart.
**Why:** Still valuable distribution context; loses its hero slot to the coverage gap.
**Data shape:** No change from current implementation.
**Backend:** existing `/api/v1/species/counts/` or whatever the current chart already hits.
**Empty state:** Existing behavior.

---

## Sequencing (working order)

1. **Arch review** — pick the "recently updated" data source (fresh endpoint vs. `AuditLog`), decide whether to stub the KBA hook, resolve open questions 1–4 above.
2. **Panel 1 (coverage gap)** — backend endpoint + frontend panel. This is the single highest-value surface for ABQ and should ship first so we have a coherent demo even if later panels slip.
3. **Panel 5 (demote Red List)** — trivial FE reshuffle; do early to free the hero slot for Panel 1.
4. **Panel 2 (single-institution risk)** — reuses Panel 1's frontend primitive (sortable species list); should be fast once Panel 1 exists.
5. **Panel 3 (studbook status)** — different primitive (three-bucket summary + click-through); can land in parallel with Panel 2.
6. **Panel 4 (recently updated)** — last, because the data source is the least-decided. Fallback: ship with just `Species.updated_at` and revisit.

Each panel gets its own PR. Every panel ships with an adversarial test that exercises its empty state and a happy-path fixture.

---

## Acceptance criteria

_To be written by @product-manager after BA pass._

Rough shape:
- Each panel renders on `/dashboard/` behind tokens (no raw slate/sky).
- Each panel has an empty-state copy approved by @conservation-writer.
- Each panel's endpoint is hit by one integration test and one empty-state test.
- Overall page pass: single `<h1>`, `#main-content` landmark, skip link reaches the first panel.
- Dashboard page still renders in <800ms server-render time for the logged-out case.

---

## Out of scope

- Write actions from the dashboard (creating populations, editing assessments). Read-only views only.
- Coordinator-to-coordinator messaging. That's a future gate.
- KBA / Key Biological Area overlay. Tracked as a follow-up idea (see `docs/planning/ideation/kba-overlay.md` — to be written).
- Small-range / narrow-distribution pill. See `docs/planning/ideation/narrow-range-pill.md` — under consideration, blocked on sampling-bias concerns.

---

## How to pick this up

1. Read this file.
2. Read `docs/planning/registry-redesign/README.md` (D1–D7).
3. Run an arch + BA pair-review on the five open questions above.
4. Cut `feat/registry-redesign-gate-3-dashboard` and start with Panel 1.
