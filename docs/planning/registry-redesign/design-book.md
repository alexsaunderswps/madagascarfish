# Registry Redesign — Design Book

**Status:** Living reference. Gate 1 patterns, as shipped on the Species Profile.
**Audience:** engineers building new pages (About, Husbandry, Ex-situ dashboard, etc.).
**Rule of thumb:** if a pattern is in this doc, reuse it. If it isn't, extract a shared component rather than invent one.

Canonical implementation to copy from: `frontend/app/species/[id]/page.tsx`.
Canonical token source: `frontend/app/globals.css`.

---

## 1. Tokens & palette

All colors, type families, and radii come from CSS custom properties defined on `:root` in `globals.css`. **Do not use Tailwind color utilities (`bg-slate-*`, `text-sky-*`, `border-gray-*`) on new registry pages.** They exist in legacy components (`HusbandryTeaser.tsx`) and should be replaced, not copied.

### Surfaces
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAFAF7` | Page background (warm off-white). The default canvas. |
| `--bg-raised` | `#FFFFFF` | Cards, panels, tiles, summary boxes — anything sitting on top of `--bg`. |
| `--bg-sunken` | `#F0EEE6` | Hero strips, section dividers, sunken-well regions. Also the base of `.bg-stripe-fallback`. |

### Ink (text colors)
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1412` | Primary text. Headings, stat values, strong emphasis. |
| `--ink-2` | `#2E3834` | Body copy. The default paragraph color. |
| `--ink-3` | `#6B7670` | Muted text. Eyebrows, captions, secondary metadata, disabled/empty states. |

### Rules / borders
| Token | Hex | Use |
|---|---|---|
| `--rule` | `#DCD9CE` | Default 1px borders on cards, tiles, dividers. |
| `--rule-strong` | `#A8A598` | Form inputs, buttons, emphatic dividers. |

### Accent (conservation green)
| Token | Hex | Use |
|---|---|---|
| `--accent` | `#2B6E5F` | Primary action color. Buttons, map clusters, focus ring. |
| `--accent-2` | `#0F2A2E` | Link color, primary-button hover, high-contrast text accent. |
| `--accent-soft` | `#D6E6E0` | Chip/tag backgrounds (e.g., "Provisional Name"). |

### Supporting
| Token | Hex | Use |
|---|---|---|
| `--terracotta` | `#A84420` | Reserved. Use sparingly for warnings / decline signals. |
| `--highlight` | `#D4A84B` | "Attention" color — CARES pill tone, sparse-data banner. Warm amber. |
| `--focus` | `#2B6E5F` | Focus ring. Same as `--accent`. |

### IUCN Red List palette (official)
Use these **only** for conservation status signaling. Do not co-opt them for other meanings.

| Token | Status |
|---|---|
| `--iucn-cr` | Critically Endangered (`#D81E05`) |
| `--iucn-en` | Endangered (`#FC7F3F`) |
| `--iucn-vu` | Vulnerable (`#F9E814`) |
| `--iucn-nt` | Near Threatened (`#CCE226`) |
| `--iucn-lc` | Least Concern (`#60C659`) |
| `--iucn-dd` | Data Deficient (`#D1D1C6`) |
| `--iucn-ne` | Not Evaluated (`#FFFFFF`) |
| `--iucn-ew` | Extinct in the Wild (`#542344`) |
| `--iucn-ex` | Extinct (`#000000`) |

### Type families
| Token | Font |
|---|---|
| `--serif` | Spectral → Charter → Georgia. Headings, scientific names, lead paragraphs, stat values. |
| `--sans` | IBM Plex Sans → system-ui. Body, UI chrome, eyebrows, buttons. |
| `--mono` | IBM Plex Mono → ui-monospace. Language codes, coordinates, IDs. |

### Shape
| Token | Value | Use |
|---|---|---|
| `--radius` | `2px` | Buttons, inputs, small chips. |
| `--radius-lg` | `3px` | Cards, panels, tiles, figures. |

**Known gotcha:** `--radius-md` is referenced in several files (`EmptyState.tsx`, species profile page) but **is not currently defined** in `globals.css`. It resolves to the CSS default and reads fine because the values we want are small anyway. When you reach for a medium radius, use `--radius` (2px) to be explicit, or add `--radius-md: 2px` to `:root` and migrate.

### Shadows
- `--shadow-sm` — 1px ring-style shadow. Rarely needed; prefer a real `--rule` border.
- `--shadow` — card drop shadow. Use only for floating / popover UI.

**Rule:** if you find yourself writing `#hexvalue`, `rgb(...)`, or a Tailwind color class in a new registry page, stop. Pick a token above.

---

## 2. Typography scale

These are the patterns that run through the profile. Copy the style objects verbatim.

### Eyebrow (section kicker)
```ts
const eyebrowStyle = {
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: "var(--ink-3)",
  margin: 0,
};
```
Used above every section H2. In the hero, the eyebrow is tinted with the status color (`color: var(--iucn-cr)` etc.) and reads as the IUCN category label.

### H1 — hero title (italic serif)
```ts
{
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: "clamp(36px, 6vw, 56px)",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  lineHeight: 1.05,
  margin: "8px 0 0",
}
```
Italic is reserved for scientific names. For non-species H1 (About, dashboard titles), keep everything else but drop `fontStyle: "italic"`.

### H2 — section heading (upright serif)
```ts
const h2Style = {
  marginTop: 8,
  fontFamily: "var(--serif)",
  fontSize: 28,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  lineHeight: 1.15,
  marginBottom: 0,
};
```
Always preceded by an eyebrow. Never appears alone.

### Body paragraph
```ts
const paragraphStyle = {
  marginTop: 12,
  fontSize: 14,
  color: "var(--ink-2)",
  lineHeight: 1.55,
};
```
Constrain to `maxWidth: 640` for readable measure.

### Lead paragraph (serif, first paragraph of a content section)
```ts
{
  marginTop: 12,
  fontFamily: "var(--serif)",
  fontSize: 19,
  lineHeight: 1.55,
  color: "var(--ink)",
  maxWidth: 640,
}
```
Use once per section, on the first paragraph of Description/About-style content. Subsequent paragraphs use the sans body style.

### Summary value (serif, in a summary box)
```ts
const summaryValueStyle = {
  margin: "8px 0 0",
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  color: "var(--ink)",
  lineHeight: 1.15,
};
```

### Stat numeral (big number in a tile)
```ts
{
  fontFamily: "var(--serif)",
  fontSize: 28,
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
  color: "var(--ink)",
  lineHeight: 1.1,
}
```
Always add `font-variant-numeric: tabular-nums` for stats so columns align.

### Caption / metadata
```ts
{ fontSize: 12, color: "var(--ink-3)" }
```
For figcaptions, locality counts, secondary metadata.

### Mono usage
Use `fontFamily: "var(--mono)"` at 12–13px for: language codes next to common names, coordinates, IDs, CSV field names in import UI. Not for body text.

---

## 3. Section anatomy

Every content section on the profile follows the same rhythm:

1. **Eyebrow** (`eyebrowStyle`) — one or two words, uppercase, muted.
2. **H2** (`h2Style`) — sentence-case serif, 28px.
3. **Content** — paragraphs, cards, grids, tiles.
4. 48px top margin separating sections (`marginTop: 48`).

Canonical pattern:

```tsx
<section id="distribution" style={{ marginTop: 48 }}>
  <p style={eyebrowStyle}>Distribution</p>
  <h2 style={h2Style}>Where it's found</h2>
  {/* ...content... */}
</section>
```

**Do not invent new heading patterns.** If a page has a hierarchy deeper than H2, use the H2 for top-level sections and a smaller serif treatment (18–20px, weight 600) for sub-sections — but prefer to flatten the hierarchy first.

---

## 4. Card / panel patterns

All cards sit on `--bg-raised`, use `--rule` for their border, and use `--radius-lg` for corners. Three variants in active use:

### 4.1 Plain card
```ts
{
  padding: "20px 22px",
  border: "1px solid var(--rule)",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "var(--bg-raised)",
}
```
Used for the Common Names / Keeping this species pair in the profile.

### 4.2 SummaryBox (top-of-page quick-facts)
Smaller padding, used in a responsive grid of three. See `SummaryBox` inline in `page.tsx`:
```ts
{
  padding: "16px 18px",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--rule)",
  backgroundColor: "var(--bg-raised)",
}
```
Content shape: eyebrow label, then a serif value (`summaryValueStyle`) or muted fallback (`summaryMutedStyle`), plus an optional inline link (`summaryLinkStyle`).

### 4.3 StatTile
Single-stat tile, used in rows of 3 (equal columns). See `StatTile` inline:
- 20px padding
- `--rule` border, `--radius-lg`
- `--bg-raised` background
- Eyebrow label on top, tabular-nums serif numeral below

### 4.4 Colored-left-accent panel
For a panel that carries a semantic signal (status, priority, warning):
```ts
{
  padding: "20px 22px",
  border: "1px solid var(--rule)",
  borderLeft: "3px solid var(--iucn-cr)", // or var(--iucn-nt), etc.
  borderRadius: "var(--radius-lg)",
  backgroundColor: "var(--bg-raised)",
}
```

For the Conservation Status panel specifically, the background is tinted with the status color at 7%:
```ts
backgroundColor: `color-mix(in oklab, var(${colorVar}) 7%, var(--bg-raised))`
```
Use this sparingly — it's reserved for status-carrying panels, not every section.

**Spacing:** card padding is `20px 22px` for full panels, `16px 18px` for summary boxes. Don't split the difference with one-off values.

---

## 5. Pills & badges

### 5.1 `IucnBadge` — conservation status pill
File: `frontend/components/IucnBadge.tsx`.
Use whenever rendering a species' IUCN status inline. Three variants chosen automatically by status:
- **solid** (CR, EN) — filled with the IUCN color, white text.
- **soft** (VU, NT, LC, DD) — 20% color on `--bg-raised`, ink text.
- **outline** (NE / null) — transparent, `--ink-2` text, `--rule` border.

Props:
- `status: IucnStatus | null`
- `showLabel` — if true, renders `CR · Critically Endangered`; else just `CR`.
- `criteria` — optional, surfaces in `title` and `aria-label`.
- `compactUnassessed` — directory-card mode: unassessed renders as `NE` instead of `Not yet assessed`.

**Never roll a second status pill.** If you need a new variant (e.g., regional status), extend `IucnBadge`.

### 5.2 `BasinPill` — neutral / highlight / accent pills
Currently inlined in `page.tsx`. Use it for taxonomic or programmatic tags (family name, basin, endemism, CARES, SHOAL priority). Three tones:

| Tone | Color | Use |
|---|---|---|
| `default` | `--ink-3` text, `--rule` border | Taxonomic facts: family, basin, endemic status. |
| `highlight` | `--highlight` text + border | CARES priority. |
| `accent` | `--accent` text + border | SHOAL priority. |

Shape: `3px 10px` padding, `borderRadius: 999`, 11px uppercase with `0.06em` tracking, `--bg` background. Whitespace no-wrap.

**If you need a fourth tone, extract `BasinPill` into a shared component first**, add the variant there, and then use it. Don't inline a new pill.

### 5.3 When to use which pill
- IUCN status → `IucnBadge`.
- Programmatic priority (CARES, SHOAL) → `BasinPill tone="highlight"` / `tone="accent"`.
- Factual metadata (family, basin, endemic) → `BasinPill tone="default"`.
- Provisional / beta flags → `accent-soft` background chip (see the "Provisional Name" treatment in the hero). Only when the flag is rare and needs to stand out.

---

## 6. Hero patterns

### 6.1 Full-bleed hero
The hero is a `<section>` spanning the full viewport width (no container), with the tinted gradient overlay and inner 1280px container for content.

```tsx
<section
  style={{
    background: "var(--bg-sunken)",
    borderBottom: "1px solid var(--rule)",
    position: "relative",
    overflow: "hidden",
  }}
>
  <div aria-hidden="true" style={{
    position: "absolute", inset: 0,
    background: `linear-gradient(90deg, color-mix(in oklab, var(${colorVar}) 14%, transparent) 0%, transparent 60%)`,
    pointerEvents: "none",
  }} />
  <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 28px 40px", position: "relative" }}>
    {/* breadcrumb + title + pills */}
  </div>
</section>
```

The `14%` gradient alpha is the profile tuning. For non-IUCN heroes, either drop the overlay or use `--accent` at the same 14% tint.

### 6.2 Page body container
Everything below the hero wraps in:
```ts
const containerStyle = {
  maxWidth: 1280,
  marginLeft: "auto",
  marginRight: "auto",
} as const;
```
with `padding: "32px 28px 48px"`. Reuse verbatim.

### 6.3 Breadcrumb
Small (13px) `--ink-3` text, with the back-link styled as a subtle pill (4px/8px padding, `--radius-md`). Separators are plain `/` spans.

---

## 7. Empty states

Use `frontend/components/EmptyState.tsx`. Two variants:

- `variant="card"` (default) — center-aligned, 32/24 padding. Standalone empty block (a whole page or tab is empty).
- `variant="inline"` — left-aligned, 16/20 padding. Inside an existing section where content would go.

```tsx
<EmptyState
  variant="inline"
  title="No linked field programs"
  body="No field programs are currently linked to this species."
/>
```

Optional `primaryAction` and `secondaryAction` render buttons (Link-wrapped). Primary uses `--accent-2` filled; secondary uses `--bg` with `--rule-strong` border.

**Do not write inline empty-state divs on new pages.** If `EmptyState` doesn't fit the need, extend it — don't branch around it.

### Mini-pattern: inline empty copy inside a SummaryBox
When the empty state is a single muted sentence inside a summary box (e.g., "No captive population tracked."), use `summaryMutedStyle` — don't reach for `<EmptyState>`. It's too much chrome for a two-line box.

### Warning banner (sparse-data callout)
For a light "limited data" warning above content, use the highlight-tinted strip:
```ts
{
  padding: "8px 14px",
  fontSize: 13,
  color: "var(--highlight)",
  backgroundColor: "color-mix(in oklab, var(--highlight) 10%, var(--bg-raised))",
  border: "1px solid color-mix(in oklab, var(--highlight) 40%, var(--rule))",
  borderRadius: "var(--radius-md)",
}
```

---

## 8. Links

Body / reference link:
```ts
const refLinkStyle = {
  color: "var(--accent-2)",
  textDecoration: "none",
  borderBottom: "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
};
```
35%-alpha underline gives a quiet but clearly-clickable affordance. Use for inline links in copy, external references ("View Red List assessment →"), and CTAs within cards.

For navigational links where the arrow does the affordance work (breadcrumbs, back-links), drop the border and use `--ink-2`.

Directional arrows: always render as plain `→` (not `>` or an icon). Use `<span aria-hidden="true">→</span>` if screen readers should skip it.

---

## 9. Buttons

Defined in `globals.css` as plain utility classes. Use them.

- `.btn` — default (ghost-ish, `--bg-raised` + `--rule-strong`)
- `.btn-primary` — `--accent` filled, white text
- `.btn-ghost` — transparent, hovers to `--bg-sunken`

Padding is `7px 12px`, font is 13px/500 sans, radius `--radius`. **Do not build new button styles.** If you need an icon-only or destructive button, extend these classes in `globals.css` rather than inlining styles.

For form inputs, use `.input` and `.input-search` classes (same file).

---

## 10. Grids & spacing rhythm

- Section separator: `marginTop: 48` between sections.
- Inner spacing: `marginTop: 12` between eyebrow and heading is handled by `h2Style`; `marginTop: 12` between heading and first paragraph.
- Responsive card row: `gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12` for summary boxes; `minmax(280px, 1fr), gap: 40` for paired full panels.
- Stat row: fixed `repeat(3, minmax(0, 1fr)), gap: 16` — stats read as a balanced triptych, not a flexible grid.
- Definition list (4-col metadata): `repeat(4, minmax(0, 1fr)), gap: 20`. Each cell is an eyebrow-label + value via the `DtDd` component.

Horizontal padding on the page container is always `28px`. Don't vary it by page.

---

## 11. Motion

- Global focus ring: 2px solid `--focus` with 2px offset. Inherited from `*:focus-visible`.
- Hover transitions on buttons: `120ms ease` on background/border/color.
- Pulse dot (`.pulse-dot`): 2.4s opacity-only loop, suppressed under `prefers-reduced-motion`.

No other animations. No slide-ins, no shimmer skeletons, no accordion motion. Content resolves synchronously on the server (per the `no loading.tsx on fetch routes` memo).

---

## 12. Fallback textures

`.bg-stripe-fallback` — subtle 135° repeating gradient over `--bg-sunken`. Used when an asset slot is empty but the layout needs a textured block so the absence reads as intentional. Prefer hiding the element entirely over showing a stripe fallback (per the 2026-04-20 Distribution panel review), but the class is available when needed.

---

## 13. What to avoid

These have come up as review friction; don't ship them on new pages.

1. **Tailwind color utilities on token-based pages.** `bg-slate-50`, `text-slate-600`, `border-gray-200`, `text-sky-700`, `bg-sky-50`, `ring-sky-200` — all out. `HusbandryTeaser.tsx` is the cautionary example; it predates the token system and needs to migrate. Do not copy its structure into a new page.
2. **New typographic scales.** If your type size isn't in §2, you're inventing a scale. Pick the nearest match.
3. **Dashed borders.** They read as "placeholder" and collide with the empty-state convention of solid `--rule` borders. Use `--rule` solid or no border at all.
4. **One-off button styles.** If you find yourself writing `padding`, `borderRadius`, and `backgroundColor` on a `<button>` inline, use `.btn` / `.btn-primary` / `.btn-ghost` instead.
5. **Hex values in new components.** Every color should resolve through a token. Exception: pure white (`#FFFFFF`) on solid-colored buttons/badges is acceptable and matches `IucnBadge`.
6. **Divergent radii.** Only `--radius` (2px) and `--radius-lg` (3px) exist. `999` is fine for pills. Don't introduce 8px or 12px rounded corners.
7. **Shadows as primary separation.** Use a `--rule` border. Shadows are floating-UI-only.
8. **Bright colored section backgrounds.** The page is quiet. Tints cap at ~7–14% (see Conservation Status panel). Anything louder reads as an ad.
9. **Duplicating IUCN-color semantics.** Don't use `--iucn-cr` for an error state or `--iucn-lc` for a success state. Those colors mean conservation status. For UI state, use `--terracotta` / `--highlight` / `--accent`.
10. **New pill shapes.** Extend `BasinPill` or `IucnBadge`; don't build a third.

---

## 14. Voice & tone

Copy decisions are owned by the `@conservation-writer` agent. Before writing new microcopy:

1. Check `docs/planning/copy/` for existing voice guides (husbandry copy, IUCN glossary, etc.).
2. For empty states and errors: state what's true, then what the reader can do. No apologies, no "Oops."
3. For species-facing copy: the audience is researchers, educators, funders, hobbyist breeders. Write plainly. Italicize scientific names. Don't nickname species.
4. For French / Malagasy users: avoid idioms; keep sentences short.
5. Delegate net-new prose (About page, section intros, funder summaries) to the conservation-writer agent rather than drafting it inline.

---

## 15. Reuse vs. extract decision rule

When building a new page:

- **Pattern already in this doc?** → Use it as written. Don't stylistically remix.
- **Pattern in an existing component (`EmptyState`, `IucnBadge`, `SpeciesSilhouette`, `ProfileDistribution`)?** → Import it. Don't reimplement.
- **Pattern inlined in `page.tsx` (`SummaryBox`, `StatTile`, `BasinPill`, `ConservationStatusPanel`)?** → Either (a) promote it to a shared component under `frontend/components/` and import from both sites, or (b) copy the style objects verbatim with a `// mirrors page.tsx <Component>` comment. Promotion is preferred once a pattern is used on two pages.
- **Genuinely new pattern?** → Check with a UX or design reviewer before inventing it. If approved, land it in this doc in the same PR, and extract it as a component from day one.

Rough threshold: if a styled div is about to appear on its second page, it's a component, not a snippet.

---

## 16. Page scaffold template

For a brand-new page (say, About), this is the minimum viable scaffold:

```tsx
export const revalidate = 3600;

export default async function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <section style={{
        background: "var(--bg-sunken)",
        borderBottom: "1px solid var(--rule)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ ...containerStyle, padding: "24px 28px 40px" }}>
          <p style={eyebrowStyle}>About</p>
          <h1 style={heroH1StyleNonItalic}>Malagasy Freshwater Fishes</h1>
          <p style={{ /* lead paragraph style */ }}>…</p>
        </div>
      </section>

      {/* Body */}
      <div style={{ ...containerStyle, padding: "32px 28px 48px" }}>
        <section style={{ marginTop: 0 }}>
          <p style={eyebrowStyle}>Mission</p>
          <h2 style={h2Style}>Why this platform exists</h2>
          <p style={{ ...paragraphStyle, maxWidth: 640 }}>…</p>
        </section>

        <section style={{ marginTop: 48 }}>
          <p style={eyebrowStyle}>Partners</p>
          <h2 style={h2Style}>Who we work with</h2>
          {/* cards / list */}
        </section>
      </div>
    </main>
  );
}
```

Copy `containerStyle`, `eyebrowStyle`, `h2Style`, `paragraphStyle` from the profile page (or, once a second page is adding them, extract to `frontend/lib/designStyles.ts`).

---

## 17. Accessibility baseline

- Every `<section>` with standalone meaning has an `id` (for deep-linking) and an `aria-label` or `aria-labelledby`.
- Decorative elements (gradient overlays, separators) carry `aria-hidden="true"`.
- `IucnBadge` supplies an `aria-label` describing the status in words; criteria are surfaced in the accessible label and `title`.
- Focus ring is global and 2px — don't override `outline: none` without a replacement.
- Honor `prefers-reduced-motion` for any animation you add.

---

## 18. Related references

- `docs/design.md` — the source handoff. Use for context; **the current codebase is authoritative** where the two disagree (per D3/D4 in the registry-redesign hub).
- `docs/planning/registry-redesign/README.md` — gate split, locked decisions.
- `frontend/app/species/[id]/page.tsx` — canonical page implementation.
- `frontend/app/globals.css` — token definitions.
- `frontend/components/EmptyState.tsx`, `IucnBadge.tsx`, `ProfileDistribution.tsx` — reusable building blocks.

If you need to change a token, add a new component, or deviate from anything here, update this doc in the same PR and note the decision in the registry-redesign README.
