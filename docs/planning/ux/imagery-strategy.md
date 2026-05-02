# Imagery Strategy — Malagasy Freshwater Fishes Conservation Platform

**Date:** 2026-04-18
**Reviewer:** ux-reviewer agent
**Scope:** Where images belong on the platform, how to source them, and how to ship the MVP without a media subsystem.

## 1. Where images are needed vs. nice-to-have vs. harmful

**Needed (ship with MVP):**
- **Species profile** (`frontend/app/species/[id]/page.tsx`) — for 3–5 SHOAL exemplar species. A profile page with no image looks incomplete to funders and journalists, and a species directory is the one surface where readers genuinely need visual identification. Without at least a hero image on a handful of species, the June 1 ECA Workshop demo will feel like a database, not a platform.

**Nice-to-have:**
- **Species directory cards** (`species/page.tsx`) — thumbnail per card helps scanning, but only if *most* species have one. A half-populated grid with silhouette placeholders next to real photos looks broken. Better to omit until coverage is ≥70%, then add all at once.
- **About pages** — one editorial photograph (habitat, not specimen) at the top of `/about` would ground the mission. Low priority.
- **Husbandry page** (per `gate-09-husbandry-frontend.md`) — a single representative tank/system photo per protocol would clarify setup expectations, but diagrams beat photos here.

**Harmful:**
- **Homepage hero imagery.** The current coverage-gap stat is the strongest opening on the site — a striking number. Wrapping it in a stock-ish fish photo would dilute the editorial tone and invite "which species is that?" confusion. Keep the homepage text-forward.
- **Map markers with photos.** Photo pins on the distribution map create visual noise, performance cost, and misleading precision (the photo isn't of that locality). Keep IUCN color-coded pins.
- **Inconsistent imagery across species cards.** A tank photo next to a museum specimen next to a field photo reads as amateur. Worse than none.

## 2. Species profile image types ranked by value-per-effort

| Rank | Type | Rationale |
|---|---|---|
| 1 | **Live specimen, lateral view, neutral background** | The single most useful image. Matches FishBase/field-guide convention. Works at any crop. Sourceable from aquarist communities and ABQ BioPark. |
| 2 | **Size-comparison silhouette** (species outline with a scale bar or hand/coin) | Cheap to produce (one SVG template, scaled per `max_length_cm`). Valuable for non-specialists. Works as a fallback when no photo exists. High value-per-effort for species with measurements but no photos. |
| 3 | **Habitat photograph** (stream, lake, wetland) | Tells the conservation story more than the fish does. One generic Madagascar habitat photo can serve many species on a watershed basis. Not species-specific alt-text problem. |
| 4 | **Range map thumbnail** | Already covered by the map page; a static thumbnail on the profile linking to `/map?species_id=…` is useful but the "View on Map" button already handles this. Defer. |
| 5 | **Preserved/museum specimen** | Low appeal to public readers; useful for taxonomic verification but signals "this fish is dead/gone" — wrong tone for a conservation platform. Use only when nothing else exists and label explicitly. |
| 6 | **Distribution illustration / scientific drawing** | High quality when available (e.g., Loiselle plates), but licensing is fraught and sourcing is per-species artisanal. Defer to post-MVP. |

## 3. Sourcing and licensing

**Realistic sources, in order of practicality:**

1. **Aleksei's own ABQ BioPark photos (June 1–5)** — all-rights-reserved, you control attribution. Best option for the 3–5 exemplars. Shoot lateral views against a plain background where feasible; this alone could carry the MVP.
2. **iNaturalist CC-BY / CC-BY-SA observations** — filter by license in the API. Best second source. Research-grade observations of Malagasy endemics exist but are sparse.
3. **CalPhotos** — licensing is per-image (often CC-BY-NC); attribution strings are well-structured. Useful for older documentation.
4. **GBIF media** — aggregates many of the above; attribution chains are reliable.
5. **SHOAL / CARES / partner institutions** — direct ask, all-rights-reserved with written permission. Highest quality but slowest. Start the ask now for the 3–5 exemplars.
6. **FishBase / IUCN** — avoid hot-linking; their terms generally require copying with attribution, and many photos are "all rights reserved" by individual photographers.

**Licensing rules for the platform:**
- **CC-BY / CC-BY-SA:** allowed. Display: `Photo: <Name> / <Source>, CC BY 4.0`.
- **CC-BY-NC:** allowed since the platform is non-commercial; document non-commercial status in About. Display same format.
- **CC-BY-ND:** avoid — we may want to crop/resize.
- **All-rights-reserved:** only with written permission logged in a file (`docs/image-permissions/`). Display: `Photo © <Name>, used with permission`.
- **No unlicensed reuse.** A science-credibility site cannot tolerate takedown requests.

**Storage at MVP:** filesystem under `frontend/public/species/<slug>.jpg` with a parallel `frontend/public/species/credits.json` mapping slug → `{photographer, license, source_url}`. No CMS. Post-MVP moves to a Django `SpeciesImage` model.

## 4. Placement and sizing

**Species profile:**
- Hero image slot at top of the right column (or full-width above the grid on mobile). **3:2 landscape**, rendered at 800×533 on desktop, responsive down. Fish are landscape-shaped; portrait crops waste pixels on water.
- Use `next/image` with explicit `width`/`height`, `priority` only on the profile page hero, `sizes="(max-width: 768px) 100vw, 50vw"`.
- JPEG at ~85% quality, target ≤120KB per hero. Let Next.js emit AVIF/WebP.

**Species directory cards** (when ready):
- Square crop 1:1 at 200×200, above the card text. Lazy-load (default). Consistent crop — run all through a short processing script; don't rely on CSS `object-fit` alone to hide bad aspect ratios.

**In-body figures (habitat, size comparison):**
- Inline, max-width matching text column (672px at `max-w-4xl`). Caption below image in `text-xs text-slate-500`.

**Map:** no photos in markers. A small thumbnail in the popup is acceptable post-MVP.

## 5. Empty-state handling

Most species will lack a photo at launch. Four tiers, decided per species:

1. **Has approved photo** — show it.
2. **Has measurement but no photo** — render a **monochrome silhouette** (generic fish shape, scaled to `max_length_cm` against a 10 cm scale bar). One SVG template, CSS-scaled. Communicates "we have data, photo pending" without looking broken.
3. **No photo, no measurement** — render nothing in the image slot; the header and data grid remain. Do **not** show a grey box with a camera icon — it reads as a broken image.
4. **All cases** — a subtle caption line under the header area on the profile: *"Have a photo of this species? [Contribute →]"* linking to a `/contribute/photo` page (stub for MVP, routes to a mailto or form). This ties into the eventual Tier 3+ submission pipeline without requiring it to exist.

The silhouette approach is the single highest-leverage move: it gives every profile a consistent visual anchor at near-zero per-species cost.

## 6. Attribution and licensing UX

- Caption directly beneath the image, `text-xs text-slate-500`, one line: `Photo: Jane Doe / iNaturalist, CC BY 4.0`.
- Photographer name and license link are both hyperlinks (photographer → their source profile; license → deed page at creativecommons.org). Link styling is the standard sky-700 underline-on-hover already used on the site.
- Do **not** render a legal-boilerplate block. Do **not** overlay attribution on the image.
- An image-sources summary lives at `/about/data` ("Image credits" section) with full provenance for every photo on the site. This satisfies attribution requirements even when a specific image's caption is terse.
- **Alt text strategy:** never "fish." Template: *"{scientific name}, {life stage if known}, {view}, photographed {context}."* Example: *"Paretroplus menarambo, adult male in breeding coloration, lateral view, photographed at ABQ BioPark."* Store alt text alongside credits in `credits.json` — the photographer often has the best context and we only need to write it once. For silhouettes: *"Silhouette of {scientific name}, approximately {n} cm in length."* For decorative habitat photos: short descriptive alt.

## 7. MVP vs post-MVP

**MVP (ship before June 1):**
- **Primary sourcing: CARES / Citizen Conservation hobbyist sprint.** Aleksei requests loans of 3–5 hero images from keepers of the SHOAL exemplar species, with written-permission logged under `docs/image-permissions/`. Permissions requested by 2026-04-25; heroes installed by 2026-05-22. See `docs/planning/business-analysis/abq-biopark-imagery-timing-2026-04-18.md` for full rationale. ABQ BioPark shooting (June 1–5) produces *upgrades*, not the initial set — a content-upgrade narrative the SHOAL partner watches happen. Fallback if keeper correspondence slips: iNaturalist CC-BY + on-site shooting per Option 1 of the BA doc.
- Build the silhouette SVG component and apply to all other species profiles.
- Build `credits.json` + a typed loader, `next/image` integration, caption component with license rendering.
- Write alt text for each exemplar.
- Stub `/contribute/photo` as a mailto link.
- One habitat photo on `/about`.

**Explicitly deferred:**
- Directory-card thumbnails (wait for coverage).
- Map popup thumbnails.
- Range-map thumbnails on profiles.
- Scientific illustrations.
- CMS / `SpeciesImage` model and upload flow.
- Per-institution photos on the husbandry page (diagrams first).
- User-submitted photos through the Tier 3+ pipeline.

**Success criterion for the ECA Workshop:** a SHOAL partner can land on any of 3–5 exemplar profiles and see a credibly sourced, properly attributed photograph; landing on any other profile sees a silhouette-based page that looks intentional rather than incomplete.
