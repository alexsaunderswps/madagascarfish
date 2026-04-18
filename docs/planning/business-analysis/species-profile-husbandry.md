# BA Analysis: Species Profile — Husbandry & Breeding Guidance

**Date:** 2026-04-18
**Status:** Draft — pre-PM, pre-architecture
**Analyst:** Business Analyst Agent
**Related:** `frontend/app/species/[id]/page.tsx` (current profile shape); Gate 07 v2 locked spec; BA Assessment v1 (value proposition); `docs/planning/business-analysis/conservation-status-governance.md` (governance precedent).

---

## Problem Statement

The current species profile is clean but narrowly scoped to conservation and identity (IUCN status, taxonomy, ex-situ counts, field programs). Aleksei wants to add husbandry and breeding guidance so the platform becomes useful to the people who actually keep these fish alive in captivity — institutional aquarists **and** hobbyist breeders (CARES, Citizen Conservation) — without cluttering the conservation narrative and without positioning content as SOP. ZIMS is not a viable source (institutional-only, restricted, not generalizable).

## Current Behavior

`/species/[id]` renders: name + authority, IUCN badge + criteria, family/genus/endemic status, common names, description/ecology/morphology/max_length/habitat, ex-situ aggregate summary (institutions, individuals, breeding programs), linked field programs, IUCN + FishBase external links. No husbandry content exists anywhere. No contribution flow exists for community content.

## Proposed Behavior (recommendation)

### 1. Audience & Job-to-be-Done

Primary audience: **Tier 1 public** — specifically the hobbyist breeder and the institutional aquarist evaluating whether to take on a species. Their JTBD is *"Can I keep this fish, and if so, what has worked for others?"* Secondary audience: Tier 3+ coordinators using the page as a shared reference when drafting breeding recommendations or onboarding a partner institution.

Access implication: husbandry guidance should be **public (Tier 1)**. Gating it would defeat the point — the CARES hobbyist network is exactly the audience Aleksei wants to reach, and they do not have Tier 2+ accounts. Sensitive items (exact source locations, genetic lineage, studbook details) stay in their existing tiered surfaces; husbandry guidance itself is generic-enough to be public.

No separate "hobbyist path" at MVP — one canonical species profile, with husbandry reachable from it.

### 2. Scope of Husbandry Guidance

**In-scope for MVP (generalizable fields):**
- Water parameters: temperature range, pH range, hardness (dGH/dKH), flow preference
- Tank/system: minimum volume, aquascape notes (substrate, cover, current), conspecific/community compatibility
- Diet: accepted foods, live-food dependence, feeding notes
- Behavior & social structure: recommended sex ratio, aggression notes, schooling
- Breeding: triggers (seasonal/temperature/rainfall), spawning mode (substrate-spawner, mouthbrooder, annual), fry care basics, known survival bottlenecks
- Sourcing ethics: "do not collect from the wild; obtain from CARES/Citizen Conservation/partner institutions"
- Known pitfalls / difficulty rating (qualitative: beginner / intermediate / advanced / expert-only)

**Out of scope for MVP:**
- Medication dosing, disease protocols (liability + requires veterinary review)
- Pedigree/genetic management (Tier 4 studbook territory, not generalizable)
- Full SOP-style step-by-step breeding protocols
- Per-institution variants

### 3. Sourcing Model — recommendation: **Hybrid, admin-curated at MVP**

Evaluated options:
- **Admin-curated only** — slow, but trustworthy and legally simple. Good for MVP.
- **Tier 3+ contributions** — right long-term model, but requires a review/moderation workflow and attribution UX that does not exist today.
- **Aggregated external refs (FishBase "culture", CARES sheets, SHOAL)** — FishBase culture data is thin for Malagasy endemics; CARES care-sheets exist for a subset but licensing varies; good as *references*, not as the primary payload.

**Recommendation:** MVP is **admin-curated narrative + structured fields, with a "References" list linking FishBase/CARES/primary literature, and a "Contribute" CTA that currently opens an email/form (not a live Tier 3 write path).** Post-MVP, graduate the contribute flow to a Tier 3+ submission with moderation. This matches the governance pattern already used for `ConservationAssessment` (human-reviewed, attributed).

### 4. Information Architecture — recommendation: **(c) separate route `/species/{id}/husbandry/` with a prominent link from the profile, plus a short "Keeping this species" teaser block on the profile**

Tradeoffs:
- **(a) tabbed sub-page** — tabs hide content and are bad for deep-linking and SEO. Reject.
- **(b) accordion at bottom** — keeps one URL but buries content, and balloons the DOM for species with rich guidance. Acceptable fallback only.
- **(c) separate route** — keeps the conservation narrative as the primary artifact of the profile, gives husbandry its own URL (linkable from SHOAL/CARES forums — a real acquisition channel), and lets the page grow without cluttering. Main tradeoff: one extra click for the hobbyist who lands on the profile. Mitigation: a 2-3 line teaser block ("Kept by hobbyists under CARES — see husbandry guidance →") on the profile when content exists, and nothing at all when it does not (avoids empty-state clutter on under-documented species).

Recommended route: `/species/[id]/husbandry/`. Backend: new `SpeciesHusbandry` model with one-to-one to Species, nullable, so absence renders "No published husbandry guidance yet" and the profile simply omits the teaser.

### 5. Data Integrity & Liability — MVP minimum

- **Platform-wide disclaimer** on every husbandry page: "Guidance reflects practices reported by keepers and published sources. Not a protocol. Conditions vary; consult a qualified aquatic veterinarian for health issues."
- **Attribution:** `contributors` (free text at MVP; structured in post-MVP), `sources` (list of {label, url}), `last_reviewed_by` (User FK, Tier 4+ or admin), `last_reviewed_at` (date).
- **Content provenance:** require at least one source citation to publish; enforced in Django admin.
- **No wild-collection encouragement:** platform policy — every husbandry page includes a sourcing-ethics block.
- **Review cadence:** target 24-month review window; surface a "reviewed [date]" stamp; over 24 months renders a subtle "review pending" note (not an alarm).
- **Out of scope for MVP:** public edit history, version diffs, community comments, ratings. These are post-MVP.

### 6. MVP vs Post-MVP (June 1 ECA Workshop)

**Smallest credible demo for SHOAL:**
1. `SpeciesHusbandry` model + admin (Aleksei enters content).
2. `/species/[id]/husbandry/` route rendering structured fields + narrative + references + disclaimer + reviewed-by stamp.
3. Teaser block on profile when husbandry record exists.
4. **3–5 exemplar profiles hand-written** by Aleksei (candidates: *Paretroplus menarambo*, *Pachypanchax sakaramyi*, a Bedotiid, a Ptychochromis). Workshop demo shows one species end-to-end.
5. "Contribute" button opens a mailto or static form — no live submission pipeline.

**Post-MVP (after June 1):**
- Tier 3+ contribution flow with moderation queue.
- Version history + audit log integration.
- Photo/image attachment for husbandry (tanks, fry, setups).
- Structured difficulty filter on the species directory ("show me beginner-appropriate CARES species").
- FishBase "culture" field auto-pull where available.

This is demonstrable to SHOAL as "here is the shape — we have the frame, we are inviting the community to fill it." That framing actually helps the SHOAL partnership conversation (invitation to collaborate, not a finished product).

## Acceptance Criteria (draft — PM to refine)

- **AC-1** — **Given** a species has a published `SpeciesHusbandry` record, **when** any user visits `/species/[id]/`, **then** a "Keeping this species" teaser block renders with a link to `/species/[id]/husbandry/`.
- **AC-2** — **Given** a species has no published husbandry record, **when** any user visits the profile, **then** no husbandry teaser or empty-state appears on the profile.
- **AC-3** — **Given** a published husbandry record, **when** a Tier 1 (anonymous) user visits `/species/[id]/husbandry/`, **then** the page renders structured fields (water, tank, diet, behavior, breeding, difficulty, sourcing), narrative, references, contributors, last-reviewed-by + date, and a visible disclaimer.
- **AC-4** — **Given** a husbandry record has no `last_reviewed_at` within 24 months, **when** the page renders, **then** a "review pending" note appears near the reviewed-by stamp.
- **AC-5** — **Given** a Django admin user attempts to save a `SpeciesHusbandry` with zero source citations, **when** they submit, **then** the save is rejected with a validation message.
- **AC-6** — **Given** any user lands on the husbandry page, **when** they click "Contribute updates," **then** they are directed to a mailto/static form (MVP) with species context pre-filled.
- **AC-7** — **Given** a species is marked `shoal_priority` or `cares_status` is populated, **when** a user visits the profile, **then** the husbandry teaser (if content exists) is visually emphasized as high-interest for breeders.

## Cross-Feature Impact

- **Species profile layout** — teaser insertion point; must not break existing Gate 07 locked spec behaviors.
- **Ex-situ summary** — husbandry page should cross-link to institutions currently holding the species (Tier-appropriate: public sees "held at N institutions," Tier 3+ sees the list). Keep cross-link one-way at MVP to avoid scope creep.
- **Field programs** — husbandry page should link back to linked field programs for in-situ context ("where this species lives in the wild").
- **Species directory filters** — post-MVP, "has husbandry guidance" and "difficulty" become filter facets. Out of scope for MVP filter UI but the data model should support it (index on `difficulty`, boolean derived from presence of record).
- **CARES / SHOAL external alignment** — references field should accept structured CARES sheet URLs; coordinate with conservation-writer on voice.
- **Governance precedent** — mirrors the `ConservationAssessment` pattern (human-reviewed, attributed, sourced). Reuse that mental model in UX and admin.
- **Contribute flow** — precedes and should inform the eventual Tier 3+ community contribution system (occurrence records, breeding recommendations). Design the mailto/form MVP so it does not paint us into a corner for the real submission pipeline.

## Open Questions for Aleksei (blocks PM breakdown)

1. **Authoring capacity before June 1.** How many exemplar species can you realistically hand-write husbandry for before the workshop? 3? 5? 10? This sets the scope of the demo and whether we need a "content is rolling out" empty-state for most species.
2. **Difficulty rating — do you want it?** A single qualitative field (beginner/intermediate/advanced/expert-only) is cheap to add and very useful for hobbyists, but it is also the most opinionated piece of content. Comfortable owning those calls, or should we defer?
3. **Sourcing-ethics boilerplate.** Is there existing SHOAL/CARES language you want to reuse verbatim for the "do not wild-collect" block, or should conservation-writer draft this?
4. **Contribute CTA destination at MVP.** Mailto to you, a Google Form, or a Django-backed contact form that writes to admin? All three are cheap; pick based on how much inbound volume you want to handle manually pre-workshop.
5. **Review-by identity.** For MVP, is the "reviewed by" a platform user (linked to a `User` record, visible with ORCID if present), or a free-text attribution ("Reviewed by A. Saunders, 2026-04")? Free-text is faster; structured aligns with the rest of the platform.

---

**Next steps for orchestrator:** After Aleksei answers Q1–Q5, route to `@product-manager` for gate breakdown. Consider routing to `@conservation-writer` in parallel for voice guidance on the disclaimer, sourcing-ethics block, and difficulty-rating language.
