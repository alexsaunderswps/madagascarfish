# Paretroplus menarambo profile review — 2026-04-19

**Reviewer:** UX reviewer agent
**Target:** First published species profile + husbandry page (*Paretroplus menarambo*)
**Related:** `docs/planning/ux/imagery-strategy.md`, `docs/planning/specs/gate-09-husbandry-frontend.md`, `docs/planning/copy/husbandry-platform-copy.md`

## Top-line verdict

**Demos as-is with two small fixes.** The profile and husbandry page are
honest, legible, and voice-aligned. A SHOAL partner skimming either page
at ABQ will not see anything embarrassing. Two items genuinely fight the
reader and should land before June 1: (1) the profile has no image
anchor (silhouette fallback from imagery-strategy.md hasn't shipped yet
— called out as the highest-leverage move and every critic at the
workshop will notice its absence), and (2) Difficulty Factors runs seven
labeled rows on a page that already asks the reader to parse twelve
sections. Everything else in this review is polish.

## Profile page findings (`frontend/app/species/[id]/page.tsx`)

**Cold-curator 15-second skim.** Header carries italic binomial,
authority, family/genus, endemism, IUCN badge, "View on Map". Good
density. Below the fold: a two-column Conservation Status / Common Names
grid, then Description & Ecology, then Captive Population Summary, then
HusbandryTeaser, then Field Programs, then External References. Reading
order is sensible.

**What fights the reader:**

1. **No visual anchor above the fold.** (Critical — imagery)
   `page.tsx:109-147`. Header is pure type. For *menarambo*, a
   CARES/SHOAL priority species Aleksei personally photographed at ABQ
   BioPark, the absence reads as "database, not platform" — the exact
   failure mode imagery-strategy.md §1 names. Silhouette SVG is the
   agreed empty-state; even the silhouette + "Have a photo? Contribute
   →" caption is a better first impression than blank type.
   *Ship-before-workshop.*

2. **"View on Map →" is the only right-rail affordance and it floats
   next to the IUCN badge.** (Minor) `page.tsx:137-144`. The button
   competes with the badge for attention. Consider moving it to the end
   of the header row, or below the taxonomic line, so the badge stays
   the single visual emphasis in the header.

3. **Captive Population Summary renders numeric zero-state as three
   bold zeros when `institutions_holding === 0`.** (Minor)
   `page.tsx:256-281`. The guard at line 256 already handles the zero
   case with a sentence, which is good. Double-check that
   `total_individuals > 0` with `institutions_holding === 0` can't
   happen in data — currently the guard keys only on the institutions
   count.

4. **External References heading sits below Field Programs
   empty-state.** (Minor) `page.tsx:318-350`. On a sparse profile the
   last thing the funder reads is "No linked field programs," which is
   a bad closing beat. Consider promoting External References above
   Field Programs when Field Programs is empty, so the page closes on
   an outbound signal (IUCN / FishBase) rather than an absence.

5. **Funder 60-second read: no prioritization score, no "why this
   species matters" beat.** (Important) The BA/PM flows mention a
   prioritization score; the profile doesn't surface one. For
   *menarambo* the CARES + SHOAL signals live only on the husbandry
   teaser chip — they should also render near the header or in
   Conservation Status so a funder who doesn't scroll to the teaser
   still sees them. *Post-workshop* unless a chip can be added to the
   header cheaply.

6. **"Sparse data" amber bar and the HusbandryTeaser accent border
   both use colored left treatments.** (Minor) `page.tsx:149-154` vs.
   `HusbandryTeaser.tsx:35-40`. On a sparse-data husbandry species both
   could render; check one renders above the other cleanly and they
   don't compete.

## Husbandry page findings (`frontend/app/species/[id]/husbandry/page.tsx`)

1. **Breadcrumb reads "← *Paretroplus menarambo*" with no "Species" or
   "Back to profile" label.** (Minor) `page.tsx:207-212`. A reader
   arriving via shared link may not realize the italic binomial is a
   back-link to the profile. Consider "← Back to *Paretroplus
   menarambo*" — four extra words, unambiguous affordance.

2. **Section headings are all the same weight and rhythm — twelve
   h2s.** (Important) The page reads as a long vertical checklist.
   At-a-glance helps; Difficulty Factors (see below) hurts. A sticky
   in-page TOC on wide screens (`position: sticky` right-rail with
   Water / Tank / Diet / Behavior / Breeding / Narrative / References
   anchors) would let a curator jump to breeding without scrolling
   past six sections. *Post-workshop.*

3. **Disclaimer slab is fine but dense.** `HusbandryDisclaimer.tsx`.
   Four sentences in one paragraph. Voice-aligned. Consider line-break
   after "conditions vary between systems, regions, and individual
   fish." to let the eye rest — same copy, better scannability.

4. **"Contribute updates →" CTA sits between governance footer and
   cross-links nav** `page.tsx:568-575`. Reading order lands on the
   CTA after the reviewed-by stamp, which is correct. Verify on mobile
   the CTA doesn't get mistaken for a breadcrumb.

5. **`narrative` renders as a single `<p>` with
   `whitespace-pre-line`.** `page.tsx:476-479`. Fine for MVP. For
   *menarambo* specifically, if the narrative is more than ~400 words,
   consider a first-paragraph lede with visual break before the rest —
   currently one wall of text.

6. **No phone check against real data.** At `max-w-3xl` with
   `grid-cols-2 sm:grid-cols-3` at-a-glance, confirm the labels don't
   wrap awkwardly at 375px. "CARES registered breeders" is the likely
   wrap offender.

## Difficulty Factors redesign — 3 options, ranked by effort

Currently `HusbandryDifficultyFactors.tsx` renders up to seven
`<dt>/<dd>` pairs, each ~2 lines of free text. On a profile that
already elides blanks this is restrained but still pushes body copy
down on species with thorough documentation. The component already
elides blanks (AC-09.5 / the `collectDifficultyFactors` guard in
`lib/husbandry.ts:160-169`), so "hide blanks" is done — the problem is
the shape, not the nulls.

### Option A — "Callout band + collapsed factors" (S, ~½ day)

- On the **profile page**, add a one-line amber/sky callout above
  HusbandryTeaser: "Husbandry has N specialized considerations for this
  species. [See details →]" anchored to `#difficulty-heading` on the
  husbandry page. Only render when
  `collectDifficultyFactors(h).length >= 3` (the "this is a lot"
  threshold).
- On the **husbandry page**, keep the current descriptive list but
  wrap it in a `<details>` / disclosure that shows the first 2 factors
  and collapses the rest behind "Show N more factors." Preserves
  AC-09.5 (no aggregate label) — it's still factor text, just
  progressively disclosed.
- **Tradeoff:** cheap, voice-aligned, no new iconography to source.
  Callout duplicates teaser real estate a little. No hover affordance
  needed, so works on touch.
- **Recommendation: ship this before workshop.**

### Option B — "Right-rail factor sidebar on wide screens" (M, ~1–1.5 days)

- On screens ≥ lg breakpoint, change husbandry page from `max-w-3xl`
  single column to a `grid-cols-[1fr_16rem]` layout with Difficulty
  Factors pinned `position: sticky top-8` in the right rail. On narrow
  screens, factors collapse to the current inline section.
- Factor labels become short chips ("Space", "Temperament", "Water",
  "Diet", "Breeding"); the descriptive value shows on expand (click/tap
  to reveal — not hover, for touch parity).
- **Tradeoff:** fixes the "pushes body copy down" complaint directly;
  readers see water parameters and difficulty factors simultaneously.
  Costs layout rework and a disclosure interaction. Sidebar creates a
  second reading column that changes the page's editorial character.
- **Recommendation: post-workshop.** Good direction but too much
  surface area for the remaining 6 weeks.

### Option C — "Iconography with tap-for-detail" (L, ~2–3 days + icon sourcing)

- Replace the descriptive list with a horizontal strip of 7 icons
  (fish size, tank, thermometer, droplet, fork, fish-school, egg).
  Each icon is a button; tap/click expands a popover with the factor's
  descriptive text. Icons that have no data render grayed out or are
  omitted.
- Same component appears as a compact strip on the profile-page teaser
  ("Quick glance at husbandry demands") and at full size on the
  husbandry page.
- **Tradeoff:** most scannable at a glance; visually distinctive; good
  demo beat. But: icons must be designed or licensed (outside scope
  per role split); icons read as "marketing" per imagery-strategy.md §4
  if not done well; icon-without-label risks violating AC-09.5's spirit
  ("let the reader draw their own conclusion") by implying a rubric.
  Accessibility burden: every icon needs a label and a
  keyboard-expandable popover.
- **Recommendation: post-workshop, and only if a designer is
  available.** Not worth rolling solo before June 1.

**On the "banner at top of profile" idea:** covered by Option A's
callout. A full-width warning banner ("⚠ This species has husbandry
considerations") would miscalibrate — *menarambo* isn't dangerous to
keep, it's demanding. Warning chrome reads as hazard. The neutral
prose callout does the job without crying wolf.

## Ship-before-workshop list (5 items max)

1. **Silhouette SVG empty-state on the profile image slot** —
   imagery-strategy.md §5 already committed to this; it's the single
   highest-leverage visual fix. If Aleksei's ABQ photo of *menarambo*
   lands in time, that replaces the silhouette for the demo species.
2. **Difficulty Factors Option A** — profile callout + husbandry-page
   progressive disclosure. ½ day.
3. **Promote External References above Field Programs when Field
   Programs is empty** on the profile. 10-minute reorder in
   `page.tsx:295-350`.
4. **Breadcrumb copy on husbandry page** — "← Back to *Paretroplus
   menarambo*" instead of just the italic name. 5 minutes.
5. **Mobile pass on husbandry at 375px** — verify at-a-glance labels
   and governance footer don't wrap ugly. Fix whatever breaks.

## Post-workshop backlog

- Sticky in-page TOC on husbandry wide-screens.
- Right-rail Difficulty Factors sidebar (Option B) if the inline list
  still feels heavy after real users test the page.
- Iconography (Option C) with a designer.
- Prioritization score + CARES/SHOAL chips surfaced in the profile
  header (not only on the husbandry teaser).
- Narrative first-paragraph lede treatment when narrative > ~400
  words.
- Double-check the sparse-data amber bar + emphasized-teaser accent
  border don't both render on the same profile.
