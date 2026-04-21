# Gate 3 Dashboard — BA Review

**Date:** 2026-04-21
**Reviewer:** @business-analyst
**Paired with:** `docs/planning/architecture/gate-3-dashboard-arch-review.md`
**Inputs:** `docs/planning/registry-redesign/gate-3-dashboard.md` · `docs/planning/registry-redesign/README.md` · `backend/populations/models.py` · `backend/audit/models.py` · `CLAUDE.md`

---

## Recommendations (one-line each)

1. **Coverage gap:** CR/EN/VU only for Panel 1. DD gets a separate small "Needs assessment" sub-panel or sibling card. Do not punt entirely — DD is a real coordinator signal and the sibling card is cheap.
2. **Single-institution risk:** Sort by `institution_count` ascending, then IUCN severity. Fragility is the panel's premise; severity is the tiebreaker.
3. **Studbook status:** Use the existing `ExSituPopulation.studbook_managed` boolean. Four buckets, not three. Workshop feedback decides Gate 4 enrichment.
4. **Recently updated:** 30-day window, conservation-relevant events only, sourced from `AuditEntry`. Not any `updated_at` touch.
5. **KBA stub:** Stub the column (nullable), do not stub the logic. Five minutes of schema, zero speculative code.

Missing panel to flag: **Transfer / movement activity** (or at minimum a cross-institution holdings count on Panel 3). A coordinator triaging breeding work asks "who has moved fish where recently" and the five-panel spec doesn't answer it.

---

## Q1 — Coverage gap scope (DD handling)

**Recommendation:** Panel 1 filters `iucn_status ∈ {CR, EN, VU}` as specced. Add a small **companion card** (not a full panel) titled "Data Deficient — assessment needed" showing DD species count + top N by endemism, linking through to a filtered species list.

**Rationale:**
- A coordinator scanning Panel 1 is asking "which confirmed-threatened species have no ex-situ backstop?" Mixing DD collapses two decisions (breeding triage vs. assessment triage) into one list and measurably degrades signal — DD for Malagasy freshwater fish is large enough to drown CR rows.
- But DD is *not* nothing. For Madagascar endemics, DD often = "probably threatened, nobody surveyed recently." Hiding it entirely makes the dashboard feel blind to a real coordinator problem, and it's the exact category SHOAL's "1,000 Fishes" work is trying to resolve — high demo value at ABQ.
- A companion card is cheap: same endpoint pattern, different filter. Not a full panel, so it doesn't compete for hero real estate.

**Scope call:** Companion card is Gate 3 scope. It's one query + one small component, and the ABQ conversation benefits directly. Full "Needs assessment" panel with assessment-status breakdowns (last-assessed date, assessor, etc.) is Gate 4.

**Acceptance criterion sketch:**
> Given a coordinator on `/dashboard/`, when Panel 1 renders, then only species with `iucn_status in (CR, EN, VU)` AND `ex_situ_populations count = 0` appear. And the companion "Data Deficient" card shows a count of species with `iucn_status = DD` with a link to `/species/?iucn_status=DD`.

---

## Q2 — Single-institution risk sort order

**Recommendation:** Sort by `institution_count` ascending, then by IUCN severity descending (CR → EN → VU → NT → LC), then scientific name.

**Rationale:** The panel's premise is *fragility*, not *severity* — Panel 1 and Panel 5 already cover severity. A VU species at 1 institution is one bad week from losing the only captive population on Earth; a CR species at 2 institutions is demonstrably more resilient than that VU. Coordinators triaging "what's most fragile right now" want the count-of-one on top regardless of category.

Severity as secondary tiebreaker preserves the "most-imperiled-most-fragile" instinct inside each fragility bucket: within `institution_count = 1`, CR surfaces first; within `institution_count = 2`, same.

**Counter-position considered and rejected:** IUCN-first sorting duplicates Panel 1's ordering logic and produces a panel where CR species at 2 institutions out-rank VU species at 1, which is the inverse of what the panel claims to measure.

**Acceptance criterion sketch:**
> Given Panel 2 renders, when results are returned, then rows are ordered by (institution_count ASC, iucn_severity_rank DESC, scientific_name ASC). And `institution_count = 0` species are excluded (they belong to Panel 1).

---

## Q3 — Studbook status definition

**Recommendation:** Use the **existing `ExSituPopulation.studbook_managed` boolean** (already on the model, line 66 of `backend/populations/models.py`). Do not add a `FieldProgram` FK for Gate 3.

Four buckets, not three:

| Bucket | Definition |
|---|---|
| Studbook-managed | ≥ 1 population with `studbook_managed = True` |
| Breeding, not studbook-managed | ≥ 1 population with `breeding_status = 'breeding'` AND none `studbook_managed` |
| Holdings only | ≥ 1 population, none breeding, none studbook-managed |
| No captive population | zero populations (links to Panel 1) |

**Rationale:** The original spec question ("is it just `breeding_status`?") was written before anyone checked that `studbook_managed` already exists. It does. That field *is* the MVP answer to "coordinated program with a studbook keeper." The four-bucket view also cleanly separates the two decisions a coordinator actually makes: "is this species in a program?" (studbook) vs. "is it reproducing?" (breeding_status). Collapsing them into three buckets loses the most interesting row — "breeding but not coordinated," which is exactly the ad-hoc hobbyist holding the spec's "Why" blurb calls out.

**Workshop follow-up plan:** If ABQ coordinators push back that `studbook_managed` is too coarse (e.g., "studbook with approved breeding plan" vs. "studbook keeper assigned but plan pending"), Gate 4 adds a `CoordinatedProgram` model with FK to `Species` and `Institution`, studbook keeper user, plan status enum. That is a real model, not a boolean hack — don't pre-build it blind.

**Open question for PM:** The spec calls the panel "Studbook / coordinated breeding status." With four buckets, the "Breeding, not studbook-managed" row is load-bearing. Confirm copy with conservation-writer — "Ad-hoc breeding" carries a negative connotation coordinators may object to.

---

## Q4 — "Recently updated" window + what counts

**Recommendation:** **30-day window**, **conservation-relevant events only**, sourced from the existing `AuditEntry` model (`backend/audit/models.py`).

**What counts as signal (include):**
- New `ConservationAssessment` created
- New `ExSituPopulation` created, or `breeding_status` / `studbook_managed` / `count_total` changed
- New `BreedingEvent`
- New `Transfer`
- New `FieldProgram` or `Survey`
- `Species` row created (new species added to registry)

**What counts as noise (exclude):**
- `Species.updated_at` touches from admin edits to description, silhouette, photo slots, common names — visually meaningful for Gate 1/2 audiences, not for a coordinator asking "what changed in the breeding picture?"
- `HoldingRecord` census snapshots (would flood the panel — these are routine)
- System-actor re-syncs from IUCN that result in no category change (no-op syncs)

**Rationale:**
- 30 days matches typical coordinator check-in cadence (monthly working-group calls). 90 is too stale for "what's new since I last looked"; 60 is defensible but splits the difference poorly. If the list is too short at 30, the empty-state copy is informative rather than misleading.
- `AuditEntry` already exists with `actor_type`, `action`, target FK pointers, timestamp. A `Species.updated_at` union is simpler to query but fundamentally wrong — it conflates "someone fixed a typo in the description" with "a new CR population was established." The spec's "change_summary" field basically *requires* audit-level granularity; `updated_at` can't tell you what changed.
- Tier gating on `actor` field: Tier 1 sees action + entity + timestamp; Tier 3+ sees the actor's name/institution. This is consistent with D3-1 (public-visible panels with tier-gated deep links).

**Fallback plan matches the spec's existing fallback:** if `AuditEntry` coverage gaps surface during implementation (e.g., no audit writes for `BreedingEvent` yet), ship Panel 4 with the subset that has audit coverage and file a gap ticket — do not fall back to `updated_at` unions, because the fallback changes the semantics.

**Note on arch/BA divergence:** The arch review recommends deferring `AuditEntry` due to unverified write-coverage and using `updated_at` unions in the interim (requires migrations on `ExSituPopulation` and `ConservationAssessment`). BA position: audit-coverage gaps are a discoverable, fixable problem; semantic conflation from `updated_at` unions is not. Flagging for PM to arbitrate.

**Acceptance criterion sketch:**
> Given a coordinator views Panel 4, when the panel renders, then it shows up to 20 `AuditEntry` rows from the last 30 days whose `action` is in the conservation-relevant event whitelist, ordered by timestamp descending. And for Tier 1 users the `actor` column is hidden; for Tier 3+ users the actor display name is shown.

---

## Q5 — KBA overlay stub on coverage gap

**Recommendation:** **Stub the column, skip the logic.** Add a nullable `kba_coverage` annotation (or a placeholder field that serializes as `null`) on the Panel 1 row schema now. Do not build any logic to populate it. Do not render it in the frontend until KBA data lands.

**Rationale:**
- Cost of stubbing: ~5 lines. API contract forward-compatibility is the only real win, but it's a real win — when KBA data arrives post-ABQ, Panel 1 can surface it without a contract version bump, which matters because this endpoint is likely to be consumed by external SHOAL-facing tooling after the workshop.
- Cost of speculative implementation: significant. KBA overlay needs spatial source data (BirdLife / IBAT), a licensing conversation, a PostGIS overlay layer, and a decision on "covered" threshold (any intersection? ≥50% range overlap?). None of that is settled. Building it blind produces throwaway code.
- Alternative considered (don't stub at all): rejected because post-ABQ momentum to ship KBA is exactly when you don't want to be arguing about API shape changes.

**Scope call:** Field stub is Gate 3. Populate logic is explicitly Gate 4+, tracked in the KBA ideation doc.

**Note on arch/BA divergence:** Arch review recommends not stubbing (one-line TODO comment only), citing unresolved WDPA-vs-KBA semantics from the ideation doc. BA position: a nullable field costs nothing and removes one friction point from the post-ABQ KBA PR. Flagging for PM.

---

## Missing panels / missed signals (flag for PM)

Not inventing scope — raising these for PM to accept or defer:

1. **Transfer activity / cross-institution movement.** A coordinator triaging breeding work asks "who moved fish where in the last quarter, and is anything stuck?" The five-panel spec has no surface for `Transfer` records. Given that inter-institution transfer coordination is a core platform value prop (see `CLAUDE.md` ex-situ description), its absence from a coordinator dashboard is notable. **Minimum:** a count + most-recent-5 rows card alongside Panel 4. **Maximum:** its own Panel 6. Recommend the minimum; leave the maximum for Gate 4.

2. **Sex-ratio / demographic imbalance signal.** `ExSituPopulation` has `count_male`, `count_female`. A species with 20 individuals all one sex is functionally extinct in captivity. Neither Panel 2 nor Panel 3 catches this. Candidate: a small "Demographic risk" card — species where any managed population has a sex ratio worse than 1:4 or unknown-sex >50%. Low implementation cost; high coordinator relevance.

3. **Stale census.** `HoldingRecord` is time-series — a population with no `HoldingRecord` in >12 months is a data-hygiene problem and also a trust problem for aggregated public counts. Could be a companion to Panel 4 ("Populations overdue for census") rather than its own panel.

4. **Outstanding `BreedingRecommendation` items.** Per the domain model, `BreedingRecommendation` has `status ∈ {open, in_progress, completed}`. A coordinator dashboard that doesn't surface open recommendations is conspicuously missing its own to-do list. Possibly out of scope because D3-1 restricts write actions, but *read* of open items is not a write. Flag to PM.

5. **Endemic-status dimension on Panel 1.** Spec includes `endemic_status` in the row shape but not in any filter/sort. For a Madagascar-specific platform, surfacing "endemic, threatened, no program" vs. "introduced, threatened, no program" is probably the single highest-signal cut of Panel 1 for an ABQ audience. Recommend adding endemic status as a visible badge on each row and a default filter of `endemic_status = endemic` with a toggle to show all.

---

## Cross-feature impact

- **Tier gating on Panel 4 actor column** needs to be enforced backend-side, not just hidden in frontend. Consistent with existing tier-gating patterns; flag for security-reviewer at gate.
- **`studbook_managed` authority:** if Gate 3 surfaces this field prominently, expect Tier 3/4 coordinators to want to edit it during/after ABQ. Population Management UI may need an edit affordance added in parallel — check with PM whether that's in-scope for Gate 3 or a fast-follow.
- **Panel 1 endpoint as external contract:** once SHOAL sees the coverage-gap endpoint, expect requests to consume it programmatically. Document it as a v1 API surface, not an internal dashboard helper.

---

## Open questions for PM

1. Is the DD "companion card" in Gate 3 scope, or does PM punt it to Gate 4?
2. Accept four-bucket studbook panel vs. the three-bucket version in the current spec?
3. Accept `AuditEntry` as Panel 4 source (BA position) or `updated_at` unions with new migrations (arch position)?
4. Stub the `kba_coverage` field now (BA) or hold off entirely (arch)?
5. Any of the five "missing panel" items (Transfer, sex-ratio, stale census, open recommendations, endemic filter on Panel 1) make it into Gate 3, or all deferred?
