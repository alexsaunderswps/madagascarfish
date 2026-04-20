# Developer Handoff — Madagascar Freshwater Fish Registry

**Audience:** the engineering team implementing the redesigned registry in the production codebase.
**Scope:** what the prototype shows, which parts are placeholder, and what must be wired to live data / real assets before shipping.

The prototype (`Madagascar Freshwater Fish redesign.html`) is a self-contained React + Babel app with dummy SVG silhouettes and a hand-drawn SVG island. **None of those visual assets ship.** This document tells the coding team which real data sources, tiles, and image libraries to point the page at instead.

---

## 1. Components that need real assets

| Prototype component | File | What it renders now | What to wire it to |
|---|---|---|---|
| `MadagascarOutline` | `prototype/primitives.jsx` | Hand-drawn SVG `<path>` approximating the island, with scattered `<circle>` locality dots | **Remove the component.** Replace with the existing site map (see §2). |
| `FamilySilhouette` | `prototype/primitives.jsx` | One generic silhouette per fish family (`Cichlidae`, `Bedotiidae`, `Aplocheilidae`, `Gobiidae`, `Eleotridae`, `Anchariidae`) hard-coded as inline SVG | Replace with genus- or species-level silhouette/illustration pulled from the CMS/media library. See §3. |
| `LogoMark` | `prototype/primitives.jsx` | Placeholder mark in the nav | Swap for the official WPS registry mark. |

Everything else (IUCN pills, tables, filters, profile layout, dashboard cards) is structural and works against the real data schema as-is.

---

## 2. Map: replace `MadagascarOutline` with the existing site map

The prototype draws a cartoon island and fakes dots. Production should use the same interactive map already embedded elsewhere on wildlifeprotectionsolutions.org.

### Where the outline is used

Search/replace these call sites in the port:

- `prototype/pages-home.jsx:115` — small map inside the hero's Red-List-breakdown block
- `prototype/pages-home.jsx:226` (`HeroLiveMap`) — large map in the "live map" hero variant
- `prototype/pages-home.jsx:369` — tiny map inside the home silhouette grid
- `prototype/pages-other.jsx:209` — large map on the `/map` page
- `prototype/pages-profile.jsx:136` — species-profile "where it lives" map

Each instance passes a `dots` prop (array of `{id, x, y, iucn}`) and sometimes `highlightId`. Replace the whole component with the same map widget used on the live site. Contract we need from it:

```ts
<RegistryMap
  height={number}                 // container height in px
  species={Species | null}        // optional — when set, filter to that species' localities
  highlightLocalityId={string?}   // for hover from the species list
  onLocalityClick={(loc) => void} // navigate to /species/:id
  visibleIucnCategories={Set<IucnCode>}  // legend toggles, map page only
/>
```

Data source for locality points must be the **canonical locality table** from the registry backend — not generated from basin centroids like the prototype does. If the site map currently reads from a GeoJSON endpoint (e.g. `/api/localities.geojson`), expose a filter param for species ID and IUCN category and use that.

### Size variants to support

- **Hero thumbnail:** ~160×320
- **Profile panel:** ~180×360
- **Full map page:** fills container, ~360×720 or larger
- **Silhouette-grid thumbnail:** ~64×124 (dots only, no interaction)

If the existing map widget can't easily render at thumbnail sizes, use a static PNG/SVG of the site's basemap for those and reserve the interactive widget for the map page + profile.

### Legend + dot styling

Use IUCN category colors from `prototype/primitives.jsx` → `window.IUCN_COLORS` (already aligned with the official IUCN palette). These must match the colored pills on species cards so the whole system reads as one chart.

---

## 3. Fish silhouettes: pull from the registry media library

### Current behavior

`FamilySilhouette({ family })` returns one of six inline SVGs keyed on `family`. Every cichlid renders the same silhouette. This is wrong for a taxonomy product.

### Required behavior

Create a `<SpeciesSilhouette />` component that resolves in this order:

1. **Species-level silhouette** — preferred. `species.silhouette_url` from the DB.
2. **Genus-level fallback** — e.g. all `Paretroplus` share one silhouette if species art is missing.
3. **Family-level fallback** — final backstop. Matches what the prototype currently does.

Schema addition on the `species` table / CMS model:

```
silhouette_url            text   -- /media/silhouettes/{genus}-{species}.svg
silhouette_credit         text   -- optional attribution
hero_photo_url            text   -- optional full-color photo for profile header
hero_photo_credit         text
```

And on the `genera` + `families` tables:

```
silhouette_url            text
```

### Component contract

```tsx
<SpeciesSilhouette
  species={Species}          // we read species.genus, species.family as fallback keys
  variant="line"|"fill"      // line-art on cards, filled silhouette on hero
  height={number}            // width auto from aspect ratio
/>
```

Render as an `<img>` (or inline `<svg>` if the asset is SVG and we need theming). Always include `alt={species.scientific_name}`.

### Call sites to update

Every `<FamilySilhouette family={sp.family} />` in the prototype becomes `<SpeciesSilhouette species={sp} variant="line" height={...} />`:

- `prototype/pages-directory.jsx:295` — species card thumb (roomy card)
- `prototype/pages-home.jsx:181, 211, 319, 357` — home page silhouette grid + hero
- `prototype/pages-other.jsx:257` — map page species list
- `prototype/pages-profile.jsx:64` — profile header scale indicator
- `prototype/chrome.jsx:87` — global search result row

### Asset pipeline

- Silhouettes live under `/media/silhouettes/` (or equivalent in the CMS).
- SVG preferred, monochrome, transparent background, stroke weight consistent across the set so the grid reads as a system. Target ~200px wide at 1x.
- Sourcing plan (confirm with curators):
  - Flagship ~20 species get custom illustration.
  - Remaining ~130 species fall back to genus silhouettes (~25 genera).
  - Every family must have a final fallback (6 families currently: Cichlidae, Bedotiidae, Aplocheilidae, Gobiidae, Eleotridae, Anchariidae, plus any added).
- Credit line stored per asset; surface it in the profile page and in a site-wide attributions page.

---

## 4. Data model the prototype assumes

The prototype's `prototype/data.js` is seeded with ~20 representative records. The production schema should cover every field referenced. Fields the UI reads:

```
Species {
  id                    int (primary key, stable for URLs)
  scientific_name       string                    -- "Paretroplus menarambo"
  provisional_name      string?                   -- for undescribed morphospecies
  common_names          string[]?                 -- currently missing; see §5
  family                string
  genus                 string
  authority             string?                   -- "Allgayer"
  year_described        int?
  taxonomic_status      "described" | "undescribed_morphospecies"
  endemic_status        "endemic" | "native" | "introduced"
  iucn_status           "CR"|"EN"|"VU"|"NT"|"LC"|"DD"|"NE" | null
  iucn_criteria         string?                   -- "B1ab(iii,v)"
  cares_status          "CCR" | "priority" | "monitored" | "" -- CARES Conservation Priority tiers
  shoal_priority        boolean                   -- SHOAL "priority species" flag
  max_length_cm         number?
  habitat               string                    -- free text, one line
  basin                 string                    -- canonical watershed name; join to basins table
  description           string                    -- short natural-language summary
  has_husbandry         boolean                   -- any captive breeding docs on file
  has_localities        boolean                   -- any geo records on file
  localities            int                       -- count of records
  ex_situ: {
    institutions        int                       -- # holding institutions
    individuals         int                       -- total individuals in program
    programs            int                       -- # coordinated breeding programs
  }
  silhouette_url        string?                   -- §3
  hero_photo_url        string?                   -- §3
}
```

Aggregate/derived values used by the dashboard and home hero:

- Red-list histogram: `count(species) group by iucn_status`
- **Coverage gap** (shown in stat hero): `count(species where iucn_status in ('CR','EN','VU') and ex_situ.institutions = 0)`, divided by `count(threatened species)`
- Family breakdown for silhouette grid

Expose as one JSON endpoint the registry page hydrates from, e.g. `GET /api/registry/species.json` returning the full list + precomputed aggregates.

---

## 5. Fields to restore on the Species Profile

The prototype currently hides a few fields we said we want back. Make sure the profile shows them:

- **Common names** (`species.common_names[]`) — currently not in the seed data; needs DB column + editor UI.
- **Husbandry notes** — link out to or inline a rich-text `husbandry_notes` field. Show only when `has_husbandry` is true.
- **Field programs** — join to a `field_programs` table: `{ id, species_id, partner, region, started_at, url }`. Display as a small list.
- **Full ex-situ roster** — when the user expands, show the per-institution table, not just the roll-up numbers. Join to `ex_situ_holdings { species_id, institution, individuals, started_at, studbook_url? }`.

Layout for these sections is already in `prototype/pages-profile.jsx`; the data bindings just need to replace placeholders.

---

## 6. Dashboard: reorient to ex-situ coordinator audience

The dashboard currently shows Red List counts. Restructure around what an ex-situ coordinator needs to triage work:

1. **Coverage gap panel** — threatened species with no captive population, sortable by IUCN category and by basin.
2. **Single-institution risk** — species where `ex_situ.institutions ≤ 2`. These are one-aquarium-fire from extinction.
3. **Studbook status** — species with a coordinated breeding program vs. ad-hoc holdings.
4. **Recently added / updated** — last N records touched, for curator QA.
5. **Red List snapshot** — demoted from hero; lives at the bottom as context.

Data for all of this is derivable from the Species + ex-situ tables in §4.

---

## 7. Visual treatment for CARES / SHOAL flags

The prototype shows CARES tier and SHOAL priority as colored badges. Soften these: they should be a quiet text label or a small outlined pill next to the IUCN pill — not competing with it for attention. IUCN status is the primary signal; CARES and SHOAL are secondary programmatic flags.

CSS-wise: use `border: 1px solid var(--rule-strong)` + `color: var(--ink-2)`, no background fill. Same type scale as the metadata eyebrow.

---

## 8. Theming / tweak surface

The prototype exposes a Tweaks panel (palette, density, type system, IUCN color treatment). **Do not ship this** — pick the default theme (Journal colors + Field Guide type + muted-pastel IUCN + roomy density) and bake it into production CSS tokens. The other combinations were exploration only.

Tokens to promote to the production stylesheet live in `prototype/themes.js` and `prototype/styles.css`.

---

## 9. Routing

Prototype is hash-routed for embedding. Production should use real paths:

| Prototype | Production |
|---|---|
| `#/home` | `/registry` |
| `#/species` | `/registry/species` |
| `#/species/:id` | `/registry/species/{slug-or-id}` |
| `#/map` | `/registry/map` |
| `#/map?species=:id` | `/registry/map?species={id}` |
| `#/dashboard` | `/registry/dashboard` |
| `#/about` | `/registry/about` |

Use species `scientific_name` slugified (`paretroplus-menarambo`) as the canonical URL key and keep numeric ID as an alias.

---

## 10. Accessibility checklist

- Every silhouette `<img>` needs `alt={species.scientific_name}`.
- Map dots need keyboard focus + screen-reader labels ("Paretroplus menarambo, Bemarivo basin, Critically Endangered").
- IUCN pills must not rely on color alone — the two-letter code is already in the pill, keep it visible.
- CARES / SHOAL softened pills: include `aria-label="CARES Conservation Research"` etc.
- Min 44px hit targets on the filter chips and map legend toggles.

---

## 11. What's in the prototype that is intentionally throwaway

- The hand-drawn island SVG and all basin centroid math in `localitiesForSpecies` / `allLocalityDots`.
- The six placeholder family silhouettes inside `FAMILY_SILHOUETTES` in `primitives.jsx`.
- The Tweaks panel and all of `prototype/themes.js`'s alternate palettes.
- The `LogoMark` placeholder.
- Lorem-ipsum-ish descriptions on undescribed morphospecies — real copy from curators required.

Everything else (layouts, filter logic, card hierarchy, profile sectioning, dashboard groupings, copy tone) is intended to carry over.

---

---

# Part 2 — Visual System

Everything above is data + plumbing. This section pins down the look: tokens, type, components, and page compositions. Pair this with the reference screenshots under `handoff-refs/`.

## 12. Design tokens (production CSS)

Promote these to your production CSS as custom properties on `:root`. The prototype explored three themes; the one below is the locked-in default ("Scientific Journal" palette + "Field Guide" type + muted pastel IUCN).

```css
:root {
  /* — Surfaces — */
  --bg:          #FAFAF7;   /* page */
  --bg-raised:  #FFFFFF;   /* cards, inputs, dropdowns */
  --bg-sunken:  #F0EEE6;   /* section bands, footer */

  /* — Ink — */
  --ink:        #0F1412;   /* primary text, headings */
  --ink-2:      #2E3834;   /* body, metadata */
  --ink-3:      #6B7670;   /* captions, eyebrows, placeholder */

  /* — Rules / borders — */
  --rule:         #DCD9CE; /* card borders, dividers */
  --rule-strong:  #A8A598; /* input borders, buttons */

  /* — Accent (conservation green) — */
  --accent:       #2B6E5F; /* primary actions, links */
  --accent-2:     #0F2A2E; /* hover */
  --accent-soft:  #D6E6E0; /* nav active pill background */

  /* — Supporting — */
  --terracotta:   #A84420; /* logo Madagascar fill */
  --highlight:    #D4A84B; /* lichen gold — rare call-outs */
  --focus:        #2B6E5F;

  /* — Type families — */
  --serif: 'Spectral', 'Charter', Georgia, serif;
  --sans:  'IBM Plex Sans', system-ui, sans-serif;
  --mono:  'IBM Plex Mono', ui-monospace, monospace;

  /* — Shape — */
  --radius:     2px;       /* buttons, pills, inputs */
  --radius-lg:  3px;       /* cards, panels */

  /* — Shadows — */
  --shadow-sm: 0 0 0 1px rgba(15,20,18,0.04);
  --shadow:    0 1px 2px rgba(15,20,18,0.04), 0 0 0 1px rgba(15,20,18,0.06);

  /* — Heading overrides — */
  --h1-weight:   500;
  --h1-tracking: -0.015em;

  /* — Eyebrow treatment — */
  --eyebrow-case:     uppercase;
  --eyebrow-tracking: 0.22em;
}
```

Small-caps eyebrow (nice touch, used site-wide):

```css
.eyebrow {
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-3);
  font-variant-caps: all-small-caps;  /* only if the chosen sans supports it */
  font-feature-settings: "smcp";
  text-transform: none;
  letter-spacing: 0.12em;
}
```

---

## 13. Typography spec

We use three families with strict roles:

| Role | Family | Weight | Size | Tracking | Notes |
|---|---|---|---|---|---|
| Display H1 | Spectral | 500 | 44–48px | -0.015em | Page hero heading |
| Section H2 | Spectral | 500 | 28px | -0.015em | Section openers |
| Subsection H3 | Spectral | 500 | 20px | -0.015em | Card / panel titles |
| H4 | Spectral | 500 | 16px | normal | Rare |
| Body | IBM Plex Sans | 400 | 15px / 1.55 | normal | Primary reading text |
| Body large | IBM Plex Sans | 400 | 18px / 1.55 | normal | Hero standfirsts |
| Text small | IBM Plex Sans | 400 | 13px / 1.5 | normal | Metadata rows, buttons |
| Text xs | IBM Plex Sans | 500 | 11px / 1.4 | normal | Pills, chip labels |
| Eyebrow | IBM Plex Sans small-caps | 600 | 11px | 0.12em | Section kickers |
| Caption | IBM Plex Sans | 400 | 12px / 1.5 | normal | Image + chart captions |
| Scientific name | Spectral italic | 400–500 | matches context | normal | Always italic; genus capitalized, species lowercase |
| Numerals (stats) | Spectral | 500 | 48–180px | -0.02 to -0.04em | `font-variant-numeric: tabular-nums` |
| Mono (codes, coords) | IBM Plex Mono | 400 | 11–13px | normal | IUCN codes in running text, lat/long |

Rules:

- **Headings are always the serif.** No bold; 500 weight reads as "medium" on Spectral.
- **Body is always the sans.**
- **Italic is reserved for scientific names.** Never italicize body copy.
- **Don't mix weights inside a line** (no bold emphasis on top of sans 400 except for a single `<strong>` per sentence at most).
- Numerals in stats and tables always tabular.

---

## 14. Color token usage rules

| Token | Use | Don't |
|---|---|---|
| `--accent` (#2B6E5F) | Primary CTAs, links, active nav, focus ring | Huge backgrounds; hover states (use `--accent-2`) |
| `--accent-soft` | Nav active pill, tag highlights | Card backgrounds |
| `--ink`, `--ink-2`, `--ink-3` | Strict 3-step hierarchy for all text | Inventing a 4th gray |
| `--rule`, `--rule-strong` | 1px borders (rule = cards, rule-strong = inputs + buttons) | Divider thickness >1px |
| `--terracotta` | Only the Madagascar silhouette in the logo mark | Anywhere else — it's brand only |
| `--highlight` (gold) | Rare "something to notice" accent (e.g. undescribed-morphospecies tag) | As a primary UI color |
| IUCN colors | Only on IUCN pills, Red-List-related charts, and map dots | Buttons, borders, or generic decoration |

**Never introduce new colors outside this set.** If something feels like it needs color, it's probably an IUCN category or a CARES flag — use the official palette below.

### IUCN Red List palette (official)

```css
--iucn-ex:  #000000; /* Extinct */
--iucn-ew:  #542344; /* Extinct in the Wild */
--iucn-cr:  #D81E05; /* Critically Endangered */
--iucn-en:  #FC7F3F; /* Endangered */
--iucn-vu:  #F9E814; /* Vulnerable (text goes dark on this) */
--iucn-nt:  #CCE226; /* Near Threatened */
--iucn-lc:  #60C659; /* Least Concern */
--iucn-dd:  #D1D1C6; /* Data Deficient */
--iucn-ne:  #FFFFFF; /* Not Evaluated (rendered as outlined) */
```

Each category also has a `soft` background and `line` border for pill use — see §15.

---

## 15. Component spec

### 15.1 IUCN pill

```
[●] CR          ← small size, on cards and inline
```

- Height 20px small / 26px large
- Inline-flex, gap 6px, font 11px bold, letter-spacing 0.05em
- Border-radius 999px
- Left dot 8px circle
- **Solid fill** for CR and EN (white text on `--iucn-cr` / `--iucn-en`)
- **Soft fill** for VU, NT, LC, DD (soft background, colored text, 1px colored border)
- **NE** is outlined only (transparent fill, `--rule` border)
- Always includes the two-letter code; full label only when `showLabel` prop is true (profile header)

### 15.2 Species card (roomy — default)

Structure left → right inside a `.card`:

1. **3px full-height color bar** on the left edge, colored by IUCN category
2. **Silhouette column** (72px wide) — `<SpeciesSilhouette variant="line" />`, vertically centered
3. **Main column** (flex 1):
   - Scientific name, Spectral italic, 19px
   - Primary common name (if any), 13px, ink-3
   - Metadata row, 11px ink-3: `Family · Endemic-status · Basin`
4. **Right column**: IUCN pill top-aligned, plus CARES/SHOAL soft labels below

Card chrome:

- Padding: `18px 20px` (roomy), `14px 16px` (default), `10px 12px` (compact)
- Border: 1px `--rule`, radius `--radius-lg` (3px)
- Hover: border shifts to `--ink-2`, subtle shadow `--shadow`
- Whole card is a `<button>` — entire surface clickable to the profile

Grid:

- Roomy → single column, 12px gap
- Default/compact → 2 columns, 14px gap

### 15.3 Filter chips

- `IBM Plex Sans` 11px, weight 500 inactive / 600 active
- Pill: `padding: 5px 10px`, `border-radius: 999px`
- Inactive: `--bg-raised` fill, `--rule-strong` border, `--ink-2` text
- Active: `--accent-soft` fill, `--accent` border, `--accent-2` text
- Gap 4px, wrap freely; group by filter type with 11px eyebrow label above each group

### 15.4 Segmented control (Red List category, endemic status)

Same visual as filter chips but grouped tightly in a single row with no gap between siblings — use when options are mutually exclusive.

### 15.5 Inputs

- 13px IBM Plex Sans, 32px total height, 1px `--rule-strong` border, `--radius` (2px)
- Focus: border `--accent`, 3px ring at 20% opacity accent
- Search input: 32px left padding to clear the magnifier icon (`--ink-3`, 14px)

### 15.6 Buttons

| Variant | Background | Border | Text | Hover |
|---|---|---|---|---|
| `btn` (default) | `--bg-raised` | `--rule-strong` | `--ink` | border → `--ink-2`, bg → `--bg` |
| `btn-primary` | `--accent` | `--accent` | white | `--accent-2` on both |
| `btn-ghost` | transparent | transparent | `--ink` | bg → `--bg-sunken` |

All buttons: `IBM Plex Sans` 13px weight 500, padding `7px 12px`, radius `--radius` (2px).

### 15.7 Basin pill (used on profile header + map hover)

- 11px uppercase, letter-spacing 0.06em
- `padding: 2px 8px`, 1px `--rule` border, `--bg` fill, `--ink-3` text
- Radius 999px

### 15.8 Coverage-gap stat treatment (hero headline numeral)

- Big numeral: Spectral 500, 180px, `letter-spacing: -0.04em`, `line-height: 0.9`, tabular
- "of 55" pair to the right, baseline-aligned: `of` at 13px in `--ink-3`, the 55 at 48px Spectral 500 in `--ink-2`
- Below: standfirst at 18px `--ink-2`, max-width 460px
- Eyebrow above in IUCN CR red: "Coverage gap"

---

## 16. Page compositions

### 16.1 Site header (sticky)

- Height 56px, sticky with `backdrop-filter: saturate(120%) blur(8px)`
- Background: `color-mix(in oklab, var(--bg) 90%, transparent)`
- Bottom border 1px `--rule`
- Layout: `[Logo] [Nav items] [flex] [Search 280px] [Tweaks button]`
- Max width 1280px, horizontal padding 28px, gap 20px
- Nav item active: `--accent-soft` background pill with `--accent` text, weight 600

### 16.2 Home / Welcome page

A single page, four sections top → bottom. **Use the "stat" hero (coverage gap) as the default** — it's the one the organization tested best against.

**Section A — Hero (stat variant)**

- Container padding `56px 28px 64px`
- Small eyebrow line: "Madagascar Freshwater Fish · Conservation Registry"
- H1 (Spectral 48px / 1.08 line-height / 500, max-width 680px): *"A shared record for Madagascar's endemic freshwater fish."*
- 2-column grid 56px gap, `1.1fr 0.9fr`:
  - **Left:** coverage-gap stat (§15.8) + standfirst + primary & secondary CTAs
  - **Right:** map thumbnail (160×320, from the real WPS map widget per §2) + Red List breakdown histogram (see §16.2a)
- Bottom border 1px `--rule`

**Section A histogram (right side of hero)**

- Eyebrow "Red List breakdown" above
- Stacked rows, each: `[two-letter pill][thin horizontal bar][count]`
  - Bar length proportional to count / total
  - Bar color = IUCN category color
  - Bar height 10px, background `--rule` behind for missing width
- 6px row gap

**Section B — "A shared record"**

- Container padding `56px 28px`
- Eyebrow "A shared record", H2 (28px Spectral, max-width 760px), short paragraph (15px, max-width 680px)
- Three-up card grid below, gap 20px:
  - 01 — Species directory
  - 02 — Distribution map
  - 03 — Conservation dashboard
- Each card: eyebrow number, H3, one-line body, visual preview (140px tall), CTA link at bottom

**Section C — Last-sync strip**

- 20px 28px padding, `--bg-sunken` background, top border `--rule`
- Row: `[pulsing dot + "Live"] [sync log sentence] [flex] [See sync log →]`
- Pulsing dot: 8px accent circle with a 4px rgba outer halo

### 16.3 Species Directory

- Two-column layout: `240px` filter rail, flexible content area, 32px gap
- Container padding `40px 28px`
- Top bar: H1 "Species directory" + result count + view-density segmented control ("Compact / Default / Roomy") + sort dropdown
- Left rail filter groups (each with 11px eyebrow label):
  - Red List category (segmented, 7 buttons: CR, EN, VU, NT, LC, DD, NE + "Any")
  - Endemic status (segmented: Endemic / Native / Introduced / Any)
  - Family (multi-select chips)
  - Basin (multi-select chips, alphabetical)
  - CARES status (segmented: CCR / Priority / Monitored / Any) — softened per §7
  - SHOAL priority (toggle: On / Any)
  - Captive coverage (segmented: Held / Not held / Any)
- Active filters render as a chip row at top of content area with a "Clear all" link
- Cards render in the grid (§15.2), roomy by default

### 16.4 Species Profile (`/registry/species/{slug}`)

- Full-bleed hero strip at top, 280px tall
  - Background: large species photo (`hero_photo_url`), or `--bg-sunken` stripe pattern if absent
  - Overlaid bottom-left: IUCN pill (large), scientific name in Spectral italic 56px, common name line, authority + year
- Body container `container-narrow` (max-width 920px), padding `40px 28px`
- **Three-up meta strip** directly below hero:
  - Col 1: Taxonomy (family, genus, authority)
  - Col 2: Distribution (basin chip, locality count, small inline map thumbnail 180×360)
  - Col 3: Ex-situ summary (3 stats: institutions / individuals / programs)
- **Sections**, each preceded by an eyebrow + H2:
  - *Overview* — description copy
  - *Distribution* — full map widget (§2) + locality list
  - *Ex-situ coverage* — full per-institution table
  - *Husbandry notes* — rich text
  - *Field programs* — list of partner projects with dates and links
  - *References* — citations list
- Sections separated by 48px vertical space and a 1px `--rule` horizontal line

### 16.5 Map page

- Full-viewport split: left rail 360px species list + filters, right fills with interactive map (§2)
- Top-right overlay legend: 7 IUCN category toggles (square 12px color + label)
- Hovering a species in the rail highlights its locality dot(s); clicking zooms + opens profile

### 16.6 Dashboard

- Container padding `40px 28px`, max width 1280px
- H1 "Conservation dashboard" + small subhead with last-updated timestamp
- 5 stacked sections per §6, each a `.card` with eyebrow + H2 + body content:
  1. Coverage gap panel (sortable table)
  2. Single-institution risk
  3. Studbook status
  4. Recently updated
  5. Red List snapshot (the histogram, demoted from hero)

### 16.7 Footer

- `--bg-sunken` background, top border `--rule`, 32px top / 48px bottom padding
- 4-column grid: brand + tagline / Explore links / About links / Colophon
- 12px caption type throughout

---

## 17. Spacing scale

Use only these step values. `mt-*` classes in the prototype CSS correspond 1:1.

```
4px · 8px · 12px · 16px · 24px · 32px · 48px · 64px · 80px · 120px
```

Section-to-section vertical rhythm: 56px (compact) or 80px (roomy). Inside cards: 12–16px between items.

---

## 18. Motion

- **Route transitions:** 200ms fade + 4px rise (`.route-fade` in prototype CSS). Apply to the main route container only.
- **Hover transitions:** 120ms on border + background + color. Never more than 200ms.
- **Focus ring:** instant.
- **Pulse dot** (live-sync indicator): 1.8s infinite ease-in-out opacity 0.4→1.0, no scale.
- No parallax, no scroll-driven animations, no entrance animations on page load beyond the route fade.

---

## 19. Accessibility additions to §10

- Color contrast: ink/bg is WCAG AAA (21:1), ink-2/bg AA large (7:1), ink-3 AA small (4.5:1 on --bg, fail on --bg-raised for body — reserve ink-3 for 12px+ captions).
- All IUCN pills must include the two-letter code as text.
- Focus ring 2px `--focus`, 2px offset.
- Never rely on color alone to indicate status.

---

## 20. Reference screenshots

Captures of the prototype at the locked-in default theme live in `handoff-refs/`. Use these as the visual source of truth when a spec detail is ambiguous.

- `handoff-refs/01-page.png` — Home / Overview (stat hero + three-up + sync strip)
- `handoff-refs/02-page.png` — Species Directory (filter rail + card grid)
- `handoff-refs/03-page.png` — Species Profile (Paretroplus menarambo)
- `handoff-refs/04-page.png` — Map page (split layout)
- `handoff-refs/05-page.png` — Dashboard

These are pixel-accurate to the prototype. Production should match layout, proportions, and density, but swap in the real map widget and real silhouettes per §2–§3.

---

## Quick prompt for the coding agent

> Port the prototype at `Madagascar Freshwater Fish redesign.html` (source in `prototype/`) into the WPS production codebase. Follow both parts of `Developer Handoff.md`.
>
> **Part 1 — data & plumbing:**
> 1. Replace the `MadagascarOutline` component everywhere it's used with the existing WPS site map widget. Locality dots must come from the canonical locality endpoint, filtered by species ID where the prototype passes a single-species context.
> 2. Replace `FamilySilhouette` with a new `SpeciesSilhouette` that resolves species → genus → family silhouette URLs from the registry media library. Add `silhouette_url`, `hero_photo_url`, and credit fields to the species / genus / family CMS models.
> 3. Wire all other components to the Species schema in §4 — no mock data. Hydrate from a single `/api/registry/species.json` endpoint.
> 4. Restore common names, husbandry notes, field programs, and full ex-situ roster on the species profile.
> 5. Restructure the dashboard around the five ex-situ coordinator sections in §6.
> 6. Soften CARES and SHOAL visual weight per §7.
> 7. Move to real paths under `/registry/*` (§9).
> 8. Pass the a11y checklist in §10 + §19.
>
> **Part 2 — visual system:**
> 9. Bake the design tokens in §12 into production CSS custom properties. Drop all other prototype themes and the Tweaks panel.
> 10. Load Spectral + IBM Plex Sans + IBM Plex Mono as web fonts. Apply the type roles in §13 strictly.
> 11. Build components per §15 (IUCN pill, species card, filter chips, segmented control, inputs, buttons, basin pill, coverage-gap stat). Match variant states exactly.
> 12. Compose pages per §16. Use the stat hero on the welcome page. Respect the 1280px max-width, the spacing scale in §17, and the motion rules in §18.
> 13. Compare every page visually against the reference screenshots in `handoff-refs/`. Flag any deviation for design review rather than resolving it unilaterally.
