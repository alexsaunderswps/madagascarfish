# Ideation — Narrow-range / microendemic pill

**Raised by:** Alex, 2026-04-21 (post-Gate-1)
**Status:** Under consideration — **blocked on sampling-bias concern**

## The idea

Surface a visual tag on species cards and profiles when a species is only known from a very small geographic area. Something like a "Microendemic" or "Narrow range" pill that reads as a flag for conservation fragility — a species known from one basin is categorically more vulnerable than one distributed across the island.

## Why it's attractive

- Microendemism is a real and important signal for Madagascar fish — many species are known from a single spring, a single karst system, or a single basin tributary. A coordinator scanning the directory benefits from seeing that signal at a glance.
- It pairs naturally with the existing IUCN pill rhythm on cards. The pill would live alongside `CR`/`EN`/`VU` without disrupting the layout.
- The data is already in-hand: locality records + drainage basin assignment per locality row. "Known from one basin" is a simple aggregate.

## Why we haven't shipped it

**Sampling bias.** A species appearing in one basin in our data may genuinely be microendemic — or may simply reflect that it's never been surveyed elsewhere. With ~79 species and highly uneven sampling effort across the island (some basins have decades of surveys, others essentially none), a "narrow range" pill risks flagging species as fragile when they're actually under-surveyed.

This is a **false-flag risk**, not a false-negative risk: species truly microendemic will correctly get flagged; species with incomplete records will get flagged even though they may be widespread. The downstream effect of false positives is benign-ish (a coordinator checks and finds there's no real risk) but erodes the platform's credibility if it happens often.

## Possible mitigations

1. **Require ≥ N locality records in the database before the pill fires.** If a species has only 1 locality, we don't know enough to flag it as narrow-range. The pill only appears when we've seen ≥ 3 records (say) AND all are in the same basin. Low-data species get no pill either way.
2. **Source the claim from IUCN / expert assessment, not from our own locality data.** IUCN assessments often note microendemism explicitly in the range narrative. A structured field on `Species` — `is_microendemic: bool` populated from manual expert review — sidesteps the sampling-bias problem entirely, at the cost of manual curation.
3. **Show the distribution *claim* and let the user judge.** Instead of a categorical pill, render the existing "Found in N basin(s)" count on the card. A card that says "Found in 1 basin" communicates the signal without the platform *asserting* microendemism.

## Recommendation

Option (3) is the cheapest and safest. We already compute `primary_basin` + `locality_count` and render basin breakdowns on the profile. Adding a "basins: 1" or "Known from Sofia" micro-fact to the card costs nothing and communicates the same signal as a pill, without the platform claiming microendemism on evidence we don't have.

Option (2) is the right long-term answer — `Species.is_microendemic` populated via expert review, same pattern as `shoal_priority`. Defer until a curator flags that they want the categorical pill.

Option (1) is a footgun: we'd still be making the claim on the basis of our own incomplete data, just with a veneer of defensibility.

## Decision point

Pick (3) for Gate 3 or 4 polish (add `locality_count` / basin count to the card), and park (2) as a future schema addition if curators ask for it. **Do not ship a range-based pill computed from locality records alone.**
