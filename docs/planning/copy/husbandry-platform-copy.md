# Husbandry Platform Copy

**Status:** Draft for review
**Author:** conservation-writer
**Date:** 2026-04-18
**Related:** Gate 09 AC-3, AC-7; BA locked decisions 2026-04-18 (Q3).
**Surfaces covered:** Platform husbandry disclaimer, CARES/SHOAL-emphasized
teaser variants (three sizes). Sourcing-ethics component reviewed separately
(see bottom of this document).

---

## 1. Platform husbandry disclaimer

**Surface:** Every `/species/[id]/husbandry/` page, rendered by
`frontend/components/HusbandryDisclaimer.tsx`. Appears directly beneath the
page title, above the at-a-glance panel.
**Budget:** 2–4 sentences, one short paragraph.
**Voice notes:** Factual, not a legal screen. Trusts the reader's judgment.
No "always," "never," "warning." Source attribution (keepers + published
sources) is the load-bearing phrase — it tells the reader what this content
is and is not.

### Copy

> This guidance reflects practices reported by keepers and drawn from
> published sources. It is not a protocol, and conditions vary between
> systems, regions, and individual fish. Use it as a starting point, compare
> it against other references, and consult a qualified aquatic veterinarian
> for health concerns.

**Citations:** Phrasing anchored in BA §5 (docs/planning/business-analysis/
species-profile-husbandry.md, 2026-04-18, locked). No quantitative claims.

---

## 2. CARES / SHOAL-emphasized teaser — three variants

**Surface:** `frontend/components/HusbandryTeaser.tsx`, rendered on
`/species/[id]/` between Captive Population Summary and Field Programs, only
when `has_husbandry` is true. Emphasized visual treatment applies when
`cares_status` is populated or `shoal_priority` is true (AC-09.8).
**Link target:** `/species/[id]/husbandry/`.
**Voice notes:** Invitational, not promotional. Assumes the reader knows
CARES and SHOAL, or will click through to learn. Name the organizations;
do not add adjectives. No "must-read," no "essential," no exclamation marks.
Present tense. Third person (the species), not second person (the reader).

### Variant A — short (≤12 words)

> A CARES / SHOAL priority species. See husbandry guidance →

_Word count: 8._

### Variant B — medium (≤25 words)

> A CARES / SHOAL priority species with active breeder interest. See what
> keepers have reported about water, diet, and breeding →

_Word count: 21._

### Variant C — long (≤45 words)

> Listed by CARES and prioritized by SHOAL, this species is actively kept
> and bred by a small network of institutions and hobbyists. The husbandry
> page collects what those keepers have reported — water parameters, tank
> setup, diet, behavior, and breeding triggers →

_Word count: 41._

**Notes for implementation:**
- When only one of `cares_status` / `shoal_priority` is set, swap the
  combined phrase accordingly: "A CARES priority species" or "A SHOAL
  priority species." The variants above assume both; single-flag rewrites
  follow the same pattern and stay within budget.
- The link text "See husbandry guidance →" (Variant A) is consistent with
  the non-emphasized teaser link text used elsewhere, so the CTA phrasing
  is stable across treatments and only the framing sentence changes.
- Do not add a priority badge *and* spell out "CARES / SHOAL priority" in
  the body — that is redundant. Pick one surface for the signal (badge or
  prose) and let the other carry context.

**Citations:**
- CARES program — Conservation, Awareness, Recognition, and Encouragement
  for Species (hobby-sector priority list; see CLAUDE.md project glossary).
- SHOAL — freshwater-fish conservation initiative; 1,000 Fishes Blueprint
  referenced in CLAUDE.md external integrations.
- "Active breeder interest" framing anchored in BA §1 (audience: CARES
  hobbyist and institutional aquarist; husbandry page is the acquisition
  surface for both).

---

## 3. Sourcing-ethics component review

**File:** `frontend/components/HusbandrySourcingEthics.tsx`
**Verdict:** **Confirmed voice-aligned. No rewrite.**

Checklist:
- Acknowledges permitted wild-collection under permit (BA Q3 locked) —
  covered in paragraph 2 ("Responsible wild collection happens under
  permit…").
- Distinguishes conservation collection from aquarium-trade collection —
  covered ("This is conservation work, not the aquarium trade.").
- Directs hobbyists to CARES / Citizen Conservation / partner institutions
  as the default source — covered in paragraph 3.
- Voice is factual, non-judgmental, present tense; no alarmist language;
  no second-person broadcast.
- Cross-links to `/about/data/` for data-handling context — present.

No changes made to the file.

---

## Summary of TODOs

None. All claims above are sourced to the BA doc (locked 2026-04-18),
Gate 09 spec, and CLAUDE.md terminology conventions.
