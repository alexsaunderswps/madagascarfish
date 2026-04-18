# ABQ BioPark Imagery Timing — BA Assessment

**Date:** 2026-04-18
**Analyst:** Business Analyst Agent
**Context:** Imagery strategy §7 conflict — SHOAL demo needs polished exemplars by June 1; Aleksei's shoot window *is* June 1–5.

## Problem

The imagery strategy assumes Aleksei's ABQ photos are the backbone of the 3–5 polished exemplars, but his camera and the SHOAL partner are in the same room on the same days. A SHOAL partner who pulls up the site cold on day 1 sees either silhouettes-only or partner-sourced photos he cannot personally speak to.

## Evaluation of the two framings

**Option 1 — pre-source 2–3 before trip, shoot the rest on-site as a "live update."**
SHOAL reads this as a working platform with a credible sourcing pipeline (iNat, CC-BY, partner asks already executed). Gives Aleksei a concrete in-person artifact: "watch this species go live tonight." Strong narrative. Risk: pre-sourced images may be mediocre (Malagasy endemic coverage on iNat is thin); a half-polished hero undercuts the polish goal more than a silhouette does.

**Option 2 — slip polish to day 2/3.**
Day 1 demo is silhouettes + data. Honest, but a SHOAL partner's first impression of the site is "database, not platform" — exactly what §7 warns against. Recovery on day 2 is great if the partner stays engaged; risky if the first 30 seconds decide the relationship.

## Third option (recommended)

**Option 3 — CARES / Citizen Conservation hobbyist sourcing sprint, now.** The CARES network and Citizen Conservation keepers already hold and photograph the exact SHOAL exemplars (*Paretroplus menarambo*, *P. maculatus*, *Ptychochromis insolitus*, *Pachypanchax* spp.). Aleksei emails 5–10 keepers this week with a written-permission template (per strategy §3, all-rights-reserved with logged permission under `docs/image-permissions/`). These are lateral-view, neutral-background tank shots — the highest-ranked image type in strategy §2. Expected yield in two weeks: 3–5 usable heroes. This is strictly additive to Option 1: on-site shooting still happens, but now as *upgrade*, not *rescue*.

**Loiselle plates** are a distant fallback — licensing is fraught (§2 rank 6, §3 note 6) and the timeline doesn't accommodate rights clearance.

## Recommendation

**Option 3 as primary, Option 1 as fallback, Option 2 rejected.** Launch June 1 with 3–5 CARES-sourced heroes; frame on-site ABQ shooting as "these replace the hobbyist loans over the week" — a content-upgrade story the SHOAL partner watches happen. This gives Aleksei authentic material for the in-person conversation (he is meeting the network that sourced the photos) and avoids the "database, not platform" first impression.

**Main tradeoff:** Option 3 front-loads 1–2 weeks of relationship-management work (permissions, attribution logging) onto Aleksei *now*, during the Gate 09 implementation window. If that correspondence slips, fall back cleanly to Option 1.

## Impact on locked docs

- **`gate-09-husbandry-frontend.md` AC-09.3 — no change.** AC-09.3 enumerates sections explicitly, and images are explicitly out of scope ("Photos, image galleries, or tank setup visuals (post-MVP per BA §6)"). Husbandry page is imagery-independent.
- **Species profile (not Gate 09's surface) — no AC change, but integration work needed:** the `credits.json` + `next/image` hero slot (imagery strategy §4, §7 MVP list) is a separate deliverable; track it as its own gate (suggest Gate 11) sequenced to land by **2026-05-22** alongside Gate 09's merge target.
- **`docs/planning/ux/imagery-strategy.md` §7 — amended** in the same PR that lands this doc, replacing the "either pre-source 2–3 or slip to day 2" sentence with the Option 3 plan.

## Open questions

1. Does Aleksei already have keeper contacts in CARES / Citizen Conservation for the 3–5 target species, or is this cold outreach? (Affects whether Option 3 is 1 week or 3 weeks of work.)
2. Which 3–5 species are the locked SHOAL exemplars? Imagery strategy refers to them abstractly; Gate 09 also depends on this list for husbandry authoring. One list should serve both.
3. Is there budget/appetite to pay a modest image-use honorarium to keepers? Accelerates permission turnaround and strengthens the CARES relationship for the post-MVP contribution pipeline.
