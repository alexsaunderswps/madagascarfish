# Gate 1 — Visual System + Silhouette Cascade + Map Assets

**Status:** Spec (PM)
**Target:** Shipped before ABQ BioPark, June 1–5, 2026
**Branch (when cut):** `feat/registry-redesign-gate-1-visual`
**Spec branch:** `docs/registry-redesign-gate-1-spec`
**Inputs:** `docs/planning/registry-redesign/README.md` (D1–D7), `docs/planning/architecture/registry-redesign-architecture.md`, `docs/design.md` §12–§19

This spec decomposes Gate 1 of the registry redesign into PR-sized stories, each tagged with its stop-ship checkpoint (A/B/C/Full), audience, scope (frontend / backend / full-stack), and relative complexity. The sequencing mirrors the architecture doc §4 (horizontal layers: tokens → chrome → primitives → cascade → map assets → cards → pages).

Decisions locked (in addition to D1–D7):

- CARES vocabulary: the model is authoritative (`CCR / CEN / CVU / CLC`). The design doc is wrong here. Filter chip copy is drafted with `@conservation-writer`.
- Slug URLs: deferred to Gate 2. Gate 1 keeps numeric species IDs.
- Hero photo fallback: stripe pattern is **required** in Gate 1 (there are no hero photos yet).
- Map keyboard path: `MapListView.tsx` is the keyboard/screen-reader path. No tabindex shims on Leaflet markers.
- Dashboard: visual skin only in Gate 1. No reorientation.
- Genus → family drift: pick mitigation (b) — integrity test now, computed property later.

---

## Stop-ship checkpoints

The architecture doc defines three points where partial completion still ships a coherent site.

- **Checkpoint A — Tokens + type applied.** Site is re-skinned everywhere, functionally identical. No chrome, no new primitives, no new layouts.
- **Checkpoint B — Chrome done.** Header/footer/sync strip match the design. Pages still use old card styling and old page compositions.
- **Checkpoint C — Primitives + cards done.** Directory and Home read correctly with new pills/chips/cards. Profile and Map are re-skinned but layout is old.
- **Full Gate 1 — Pages composed.** All page compositions from §16 land on existing routes.

Each story below is tagged with the earliest checkpoint it must be complete by.

---

## 1. User stories

### Foundation layer

#### S1 — Design tokens promoted site-wide
**Audience:** public visitor (reskin everyone sees), Tier 2+ downstream.
**Checkpoint:** A.
**Scope:** Frontend. **Complexity:** M.

As a public visitor, I want the site to use the redesigned color, spacing, radius, and elevation tokens so that the interface reads as the curated journal Madagascar fish registry rather than a generic dashboard.

- Port `docs/design.md` §12 palette and spacing tokens into `frontend/app/globals.css` (or equivalent theme file) as CSS custom properties: `--ink-0/1/2/3`, `--bg-page`, `--bg-raised`, `--bg-sunken`, `--hairline`, `--accent`, `--focus`, plus the motion and radius tokens.
- Alias any Tailwind-consumed palette classes currently resolving to slate/sky through a theme extension so existing components inherit the new palette without component-level edits.
- No component API changes. Every existing page continues to render and pass its current tests.

#### S2 — Type system wired
**Audience:** public visitor.
**Checkpoint:** A.
**Scope:** Frontend. **Complexity:** S.

As a public visitor, I want Spectral (display), IBM Plex Sans (UI), and IBM Plex Mono (data) typefaces loaded and applied so that text carries the design's editorial weight.

- Load Spectral, IBM Plex Sans, IBM Plex Mono via `next/font` with `display: swap`.
- Apply the §13 scale to headings, body, caption, and mono variants via global CSS.
- Subset and weight limits enforced: H1/H2 Spectral SemiBold/Regular, UI 400/500/600, Mono 400/500.

### Chrome layer

#### S3 — SiteHeader (sticky, backdrop-blur, active pill)
**Audience:** all visitors.
**Checkpoint:** B.
**Scope:** Frontend. **Complexity:** M.

As any visitor, I want a sticky top navigation with the current section highlighted as a pill so that I can orient myself across the site.

- New `SiteHeader.tsx` with logo mark slot, primary nav, optional auth affordance on the right.
- Sticky on scroll, 72px tall, `backdrop-filter: saturate(140%) blur(8px)` over `--bg-raised`.
- Active nav uses the §15 pill treatment. Uses `usePathname()` to detect active route.
- Includes the skip-to-content link as its first focusable child (see S21).

#### S4 — SiteFooter (4-column grid)
**Audience:** all visitors.
**Checkpoint:** B.
**Scope:** Frontend. **Complexity:** S.

As any visitor, I want a structured footer with platform, data, about, and contact columns so that I can find secondary information without hunting.

- Four-column grid per §16.1; collapses to two columns on tablet, one on mobile.
- Small caps for column headings per §13.
- Credits line at the bottom is right-aligned on desktop.

#### S5 — Last-sync strip with pulsing dot
**Audience:** all visitors; signals data freshness to Tier 2+ researchers.
**Checkpoint:** B.
**Scope:** Full-stack (consumes an existing endpoint; new component). **Complexity:** S.

As a researcher, I want to see the last time the registry synced external data so that I trust the freshness of what I'm looking at.

- New `LastSyncStrip.tsx` placed between the header and page content on Home.
- Reads most recent `IUCNSync` run timestamp (already exists) via the same data path Home already uses; if absent, render "Awaiting first sync" with a muted dot.
- Dot pulses with a 2.4s ease loop; animation is gated on `prefers-reduced-motion: no-preference`.

### Primitives layer

#### S6 — IUCN pill variants (tokenized)
**Audience:** all visitors.
**Checkpoint:** C.
**Scope:** Frontend. **Complexity:** M.

As any visitor, I want IUCN status to render as a consistent, colored pill including the two-letter code as text so that I can scan status at a glance and screen readers can announce it.

- Rebuild `IucnBadge.tsx` internals against the §15.1 spec (EX, EW, CR, EN, VU, NT, LC, DD, NE).
- Every variant includes the two-letter code as visible text and an `aria-label` with the long form ("Critically Endangered").
- "NE / Not yet assessed" is a first-class variant used when `iucn_status` is NULL (see mirror policy in `CLAUDE.md`).
- No API change — component contract (`<IucnBadge status={...} />`) preserved.

#### S7 — BasinPill primitive
**Audience:** all visitors (card metadata row).
**Checkpoint:** C.
**Scope:** Frontend. **Complexity:** S.

As any visitor, I want the primary basin to render as a soft pill alongside family/endemism so that watershed context is legible without consuming IUCN-level visual weight.

- New `BasinPill.tsx` per §15.7. Muted fill, hairline border, no color-coded category.
- Accepts an optional basin name; renders nothing when absent (no empty outline).

#### S8 — FilterChip primitive
**Audience:** all visitors (Directory); Tier 2+ find more use.
**Checkpoint:** C.
**Scope:** Frontend. **Complexity:** M.

As a researcher, I want filter chips for family, endemism, CARES, SHOAL, and IUCN status that toggle on/off with large hit targets so that I can refine a long species list by touch or keyboard.

- New `FilterChip.tsx` per §15.3. 44px minimum hit target (padded to spec even when visual height is smaller).
- Supports `selected`, `disabled`, and count-suffix variants.
- CARES chips use the four-tier vocabulary: `CCR` (Critical), `CEN` (Endangered), `CVU` (Vulnerable), `CLC` (Least Concern). Visible labels drafted with `@conservation-writer`; machine values match model choices exactly.

#### S9 — SegmentedControl primitive
**Audience:** all visitors (density control on Directory).
**Checkpoint:** C.
**Scope:** Frontend. **Complexity:** S.

As a visitor, I want a segmented control with clear on/off states and 44px hit targets so that I can switch between comfortable and compact density on the Directory.

- New `SegmentedControl.tsx` per §15.4. Keyboard: left/right arrow move selection, Enter/Space activate, Home/End jump.

#### S10 — Buttons and inputs tokenized
**Audience:** all visitors.
**Checkpoint:** C.
**Scope:** Frontend. **Complexity:** S.

As a visitor, I want primary/secondary/tertiary buttons and text/search/select inputs that adopt the new tokens so that forms and CTAs match the rest of the site.

- Update the existing button and input components in place (token aliasing; no API changes). Preserve props.
- Focus ring uses `2px solid var(--focus)` + 2px offset (see S20).

### Silhouette cascade (parallel track, backend + frontend)

#### S11 — `Genus` model + admin + migrations (A/B/C)
**Audience:** admin (Tier 5) for authoring; downstream benefit to all visitors.
**Checkpoint:** Must land before C (the cascade is what unblocks the profile layout decision).
**Scope:** Backend. **Complexity:** L.

As an administrator, I want a `Genus` model with a silhouette slot so that I can author one fallback silhouette per genus that species without their own SVG can inherit.

- New model `Genus(name unique, family string, silhouette_svg text, silhouette_credit, notes, created_at, updated_at)` per architecture §2.
- `Species.genus_fk` FK added as **nullable** in Migration A.
- Data migration (Migration B) populates `Genus` rows from distinct `Species.genus` strings and fills `Species.genus_fk`. Assertion: one-to-one genus → family integrity holds; migration raises if violated.
- Migration C tightens `Species.genus_fk` to `null=False`. String column `Species.genus` is retained for this gate; drop deferred to Gate 2.
- Django admin: `GenusAdmin` with fieldsets Identity / Silhouette / Notes; `list_display` includes `species_count` and `has_silhouette`; help text mirrors `Species.silhouette_svg` authoring conventions.
- `SpeciesAdmin`: `raw_id_fields += ("genus_fk",)`; `list_filter += ("genus_fk",)`.
- SVG root-size-attr stripping reused via a module-level helper shared with `Species.save`.

#### S12 — Serializer + filter surface for Genus FK
**Audience:** frontend consumers; Tier 2+ researchers using API.
**Checkpoint:** C.
**Scope:** Backend. **Complexity:** M.

As a frontend developer, I want the API to expose genus as a structured field so that I can know whether a genus-level silhouette exists without fetching its SVG body.

- `SpeciesListSerializer` and `SpeciesDetailSerializer` add `genus: {"name": str, "has_silhouette": bool}`. Name field retained (reading from `genus_fk.name` with string-column fallback for one release).
- `SpeciesFilter` adds `genus` filter keyed on `genus_fk__name`; string-value filter retained for back-compat.
- `SpeciesViewSet.get_queryset` adds `.select_related("genus_fk")`.
- New endpoint `GET /api/v1/genera/<name>/silhouette/` returns the SVG body (cached) when present; 404 otherwise. Public, no auth.

#### S13 — `SpeciesSilhouette` cascade in the UI
**Audience:** all visitors.
**Checkpoint:** C.
**Scope:** Frontend. **Complexity:** M.

As a visitor, I want a genus-level silhouette to appear on species that lack their own SVG, and nothing to render when neither exists, so that empty cells read as intentional rather than broken.

- Update `SpeciesSilhouette.tsx` to the cascade contract (species SVG → genus SVG → nothing).
- Profile page fetches genus SVG via `GET /api/v1/genera/<name>/silhouette/` only when species SVG absent; list/card does **not** fetch genus SVGs (perf).
- No family fallback. No generic silhouette.

### Map assets (parallel track, backend + frontend)

#### S14 — `SiteMapAsset` model + admin + pre-seed
**Audience:** admin (upload); all visitors (consumption).
**Checkpoint:** Full Gate 1 (Home + Profile compositions rely on it).
**Scope:** Backend. **Complexity:** M.

As an administrator, I want labeled slots to upload static map thumbnails so that the home hero and profile distribution panel have the curated imagery they need without the interactive map re-rendering at thumbnail sizes.

- New model `SiteMapAsset(slot unique, image, alt_text, credit, expected_width_px, expected_height_px, usage_notes, updated_at)`. Slot is a `TextChoices` enum with `hero_thumb` and `profile_panel` to start.
- Unique constraint on `slot` enforced at the DB level.
- Data migration pre-seeds empty rows for `hero_thumb` (expected 160×320) and `profile_panel` (expected 180×360). Admins edit rather than create.
- Admin: `SiteMapAssetAdmin` with `list_display = ("slot", "image_preview", "updated_at")`, read-only `image_preview` method, help text on every field, slot enum labels surface human-readable slot descriptions.
- Admin save triggers `revalidate_public_pages` hook (already exists in `species/admin_revalidate.py`) to invalidate public-page caches.

#### S15 — Site map asset API + frontend helper
**Audience:** public visitor consumption.
**Checkpoint:** Full Gate 1.
**Scope:** Full-stack. **Complexity:** S.

As a frontend consumer, I want a clean per-slot endpoint so that pages can reference map assets by slot name rather than hard-coded URLs.

- Public endpoint `GET /api/v1/site-map-assets/<slot>/` → `{url, alt, credit, width, height}` or 404. Aggressive cache; invalidated on admin save.
- `frontend/lib/siteMapAssets.ts` server helper with typed slot argument.
- Home and Profile consume by slot; gracefully render the stripe fallback when the asset is absent.

### Cards

#### S16 — SpeciesCard rebuild (§15.2)
**Audience:** all visitors (Directory and Home silhouette grid).
**Checkpoint:** C.
**Scope:** Frontend. **Complexity:** L.

As a visitor, I want species cards with a left IUCN color bar, silhouette column, metadata row (family · endemism · basin), softened CARES/SHOAL labels, and a right-side IUCN pill so that I can scan dozens of species rapidly.

- Rebuild `SpeciesCard.tsx` to §15.2 layout.
- Metadata row renders `family · endemism · basin` using `BasinPill` for basin; omit basin segment entirely when absent.
- CARES and SHOAL labels rendered with softened weight per §7 (text, not pills).
- Whole card remains a `<Link>` to `/species/<id>/`. IUCN pill retains its `aria-label`.
- Consumes `primary_basin` and `locality_count` from `SpeciesListSerializer` (see S17).

#### S17 — Serializer: `primary_basin` + `locality_count`
**Audience:** frontend (card rendering); Tier 2+ API users.
**Checkpoint:** C.
**Scope:** Backend. **Complexity:** S.

As a frontend developer, I want `primary_basin` (string or null) and `locality_count` (int) on every list row so that the card metadata and silhouette-grid captions render without extra round-trips or N+1 queries.

- `SpeciesListSerializer.primary_basin` — derived: drainage basin of the species' primary locality, or null.
- `SpeciesListSerializer.locality_count` — integer from a queryset `.annotate(locality_count=Count("localities"))`. No per-row query.
- Queryset override in `SpeciesViewSet.get_queryset` to add the annotation.

### Pages

#### S18 — Home redesign (`/`)
**Audience:** public visitor.
**Checkpoint:** Full Gate 1.
**Scope:** Frontend (+ minor backend helpers already delivered in S5, S15, S17). **Complexity:** L.

As a public visitor, I want a home page with a coverage-gap numeral hero, Red List breakdown histogram, three-up feature cards, and a last-sync strip so that the urgency of the crisis and the state of the data is legible in one screen.

- Stat hero with coverage-gap numeral (currently 31/50 threatened species lacking captive populations — pull from existing dashboard aggregate, do not hard-code).
- Red List breakdown histogram per §16.4 home. Reads from existing aggregate endpoint; tokenized bar colors match IUCN pill hues.
- Three-up feature cards (Directory / Map / Dashboard).
- `LastSyncStrip` mounted above the hero.
- `hero_thumb` `SiteMapAsset` renders alongside the Red List breakdown; stripe fallback if absent.

#### S19 — Species Directory redesign (`/species/`)
**Audience:** public visitor; Tier 2+ researchers find filters useful.
**Checkpoint:** C (grid) / Full Gate 1 (filter rail composed).
**Scope:** Full-stack (URL state for density + filters). **Complexity:** L.

As a researcher, I want a filter rail on the left, a card grid on the right, and a density control that toggles between comfortable and compact so that I can adjust information density to my task.

- Left filter rail uses `FilterChip` for family, endemism, CARES (four-tier), SHOAL priority, IUCN status.
- Right-side card grid uses `SpeciesCard`.
- Density control (`SegmentedControl`) controls grid row height + card internal padding. Density state stored in a `?d=comfortable|compact` query param — no client store needed.
- All filter state stays in the URL (already true for most filters). Verify on existing filter implementation; do not regress.
- Existing URL `/species/` unchanged. No slug migration.

#### S20 — Species Profile redesign (`/species/<id>/`)
**Audience:** all visitors; Tier 3+ see additional metadata.
**Checkpoint:** Full Gate 1.
**Scope:** Frontend. **Complexity:** L.

As a visitor, I want a hero strip, three-up meta strip, and ordered sections (description, distribution, conservation, ex-situ, references) so that a profile reads as a field guide entry.

- Hero strip per §16.4. No hero photo in Gate 1 — stripe-pattern fallback is applied to every profile.
  - Stripe fallback implemented as a subtle CSS diagonal-stripe gradient over `--bg-sunken` (not a blank color block). Reusable utility (`.bg-stripe-fallback` or equivalent) for any slot that needs it.
- Three-up meta strip (family / endemism / basin OR similar triad) using the tokenized type scale.
- Sections ordered per §16.4.
- Distribution section renders the `profile_panel` `SiteMapAsset` above the interactive `MapClient`; stripe fallback if asset absent.
- URL unchanged — numeric ID.

#### S21 — Map page re-skin (`/map/`)
**Audience:** all visitors (view); Tier 2+ (list navigation).
**Checkpoint:** Full Gate 1.
**Scope:** Frontend. **Complexity:** M.

As a visitor, I want the map page to match the new visual system while remaining fully keyboard-navigable through the list view so that I can explore localities by mouse or keyboard.

- Visual re-skin only: tokens, chrome, legend chrome. `MapClient.tsx` internals untouched (D2).
- `MapListView.tsx` is the documented keyboard + screen-reader path. The page renders both side-by-side per §16.5 split layout if time allows; otherwise preserve current layout with new tokens.
- `aria-describedby` or equivalent hint on the map container makes the keyboard list-view path discoverable.

#### S22 — Dashboard visual re-skin (`/dashboard/`)
**Audience:** Tier 2+ researchers (viewer) and Tier 3+ coordinators (editor). **Visual only — no reorg.**
**Checkpoint:** Full Gate 1.
**Scope:** Frontend. **Complexity:** M.

As a coordinator, I want the dashboard to match the redesigned palette and type so that the tool feels of a piece with the rest of the platform — while keeping its existing information architecture intact so that my existing workflow is undisturbed.

- Tokens + type + primitives adopted. Cards rebuilt on the new primitives.
- **No** changes to panel order, no demotion of Red List snapshot, no new ex-situ coordinator panels (Gate 3 owns that).

### Accessibility + polish

#### S23 — Accessibility pass
**Audience:** all visitors, critical for screen-reader users.
**Checkpoint:** Full Gate 1 (pieces land incrementally at A/B/C).
**Scope:** Frontend. **Complexity:** M.

As any visitor — especially a keyboard or screen-reader user — I want consistent focus rings, comfortable hit targets, a skip-to-content link, and motion that respects my reduced-motion preference so that I can use the site without strain.

- Focus ring tokenized: `2px solid var(--focus)` + 2px offset everywhere (global CSS `:focus-visible`). Land with Checkpoint A.
- 44px minimum hit target on `FilterChip`, `SegmentedControl`, map legend toggles. Land with Checkpoint C.
- Skip-to-content link (visually hidden, visible on focus) as the first focusable element inside `SiteHeader`. Land with Checkpoint B.
- Route transition (200ms fade + 4px rise) gated on `prefers-reduced-motion: no-preference`. Land with page compositions.
- `--ink-3` usage audited — reserved for ≥12px captions, never body text. Enforced via code review.

---

## 2. Scope assessment

| Story | Frontend | Backend | Full-Stack | Complexity | Checkpoint |
|-------|:-:|:-:|:-:|:-:|:-:|
| S1  Tokens | ✓ |   |   | M | A |
| S2  Type   | ✓ |   |   | S | A |
| S3  SiteHeader | ✓ |   |   | M | B |
| S4  SiteFooter | ✓ |   |   | S | B |
| S5  LastSyncStrip |   |   | ✓ | S | B |
| S6  IUCN pill | ✓ |   |   | M | C |
| S7  BasinPill | ✓ |   |   | S | C |
| S8  FilterChip | ✓ |   |   | M | C |
| S9  SegmentedControl | ✓ |   |   | S | C |
| S10 Buttons/Inputs | ✓ |   |   | S | C |
| S11 Genus model + admin |   | ✓ |   | L | C (backend) |
| S12 Genus serializer/filter |   | ✓ |   | M | C |
| S13 Silhouette cascade UI | ✓ |   |   | M | C |
| S14 SiteMapAsset model + admin |   | ✓ |   | M | Full |
| S15 SiteMapAsset endpoint + helper |   |   | ✓ | S | Full |
| S16 SpeciesCard rebuild | ✓ |   |   | L | C |
| S17 primary_basin + locality_count |   | ✓ |   | S | C |
| S18 Home page | ✓ |   |   | L | Full |
| S19 Directory |   |   | ✓ | L | C / Full |
| S20 Profile | ✓ |   |   | L | Full |
| S21 Map re-skin | ✓ |   |   | M | Full |
| S22 Dashboard re-skin | ✓ |   |   | M | Full |
| S23 A11y pass | ✓ |   |   | M | A/B/C/Full |

---

## 3. Dependencies and sequencing

Horizontal layers from the architecture doc. Parallel tracks noted.

```
A ── S1 tokens ──► S2 type ─┐
                            ├─► B ── S3 header ──► S4 footer ──► S5 sync strip ──┐
                            │                                                      │
                            └─► (S23 focus ring lands with A; skip link with B)    │
                                                                                   │
C ── S6..S10 primitives ──► S16 card  ◄── S17 serializer ─────────────────────────┤
                                                                                   │
   Parallel track:  S11 Genus model ──► S12 serializer ──► S13 cascade UI ────────┤
                                                                                   │
Full ── S14 SiteMapAsset model ──► S15 endpoint/helper ──► S18 Home                │
                                                                 S19 Directory   ◄─┤
                                                                 S20 Profile    ──┤
                                                                 S21 Map         ─┤
                                                                 S22 Dashboard   ─┘
                                                     (S23 hit targets + reduced-motion land with this tier)
```

### Backend-blocks-frontend callouts

- S16 (card) blocked on S17 (`primary_basin`, `locality_count`) landing first, or the card ships with the fields absent and reads null.
- S13 (cascade UI on profile) blocked on S12 (genus endpoint). Directory does not need the endpoint.
- S18 and S20 are blocked on S15 (site map asset endpoint + helper) for full fidelity; they can ship earlier with pure stripe fallback.

### Parallelizable

- S11/S12/S13 (silhouette cascade track) runs alongside S1..S10 (token + chrome + primitives).
- S14/S15 (map assets) runs alongside primitives.
- S23 pieces land alongside the layer they apply to, not as a final sweep.

### External dependencies

- `@conservation-writer` review for CARES chip labels (S8) and for any empty-state / section microcopy on Profile and Directory (S19, S20).
- Content team uploads for `hero_thumb` and `profile_panel` assets — not blocking merge; stripe fallback handles absence.

---

## 4. Acceptance criteria

### S1 — Tokens
- **Given** a fresh load of any existing page, **when** tokens are merged, **then** every surface reads with `--bg-page` / `--bg-raised` / `--bg-sunken` and ink stack `--ink-0..3`, and no Tailwind slate/sky class renders with its stock value.
- No existing test or snapshot regresses on layout or content (token change is cosmetic).
- Tokens are defined in exactly one place; duplicated palette values in components are removed in the same PR or flagged.

### S2 — Type
- **Given** the production build, **when** any page loads, **then** `H1` uses Spectral SemiBold, body uses Plex Sans 400, data/counts use Plex Mono 500, and no `font-family` rules point at default system stacks.
- Fonts load via `next/font` with `display: swap`; no layout shift > 50ms CLS attributable to webfont load on Home.

### S3 — SiteHeader
- **Given** scrolling past 72px on any page, **when** the user scrolls, **then** the header stays sticky with `backdrop-filter` blur applied.
- **Given** the current route matches a nav entry, **when** the header renders, **then** that entry shows the active pill treatment from §15.
- Keyboard: Tab order is skip-link → logo → nav items → right slot, and focus ring matches the S23 token.

### S4 — SiteFooter
- Four columns on ≥1024px, two on ≥640px, one below.
- Column headings render in small caps per §13.
- No broken links; every footer link is keyboard-reachable.

### S5 — LastSyncStrip
- **Given** at least one successful `IUCNSync`, **when** Home renders, **then** the strip shows "Last synced <relative time>" and a pulsing dot.
- **Given** no sync has run yet, **when** Home renders, **then** the strip shows "Awaiting first sync" with a muted, non-pulsing dot.
- **Given** `prefers-reduced-motion: reduce`, **when** the strip renders, **then** the dot does not animate.

### S6 — IUCN pill
- Every variant (EX, EW, CR, EN, VU, NT, LC, DD, NE) includes the two-letter code as visible text and an `aria-label` with the long category name.
- **Given** a species with `iucn_status = NULL`, **when** the pill renders, **then** it shows `NE` with label "Not yet assessed" (mirror policy).
- Component contract unchanged — no caller-facing prop rename.

### S7 — BasinPill
- **Given** a non-empty basin name, **when** the pill renders, **then** it uses muted fill + hairline border and no category color.
- **Given** a null basin, **when** the pill is invoked, **then** it renders nothing (no outline, no "Unknown").

### S8 — FilterChip
- **Given** any chip, **when** a pointer or keyboard user activates it, **then** the click/touch target is ≥44px on both axes regardless of visual size.
- **Given** the CARES group, **when** chips render, **then** exactly four chips appear with machine values `CCR | CEN | CVU | CLC` matching `Species.cares_status` choices. Labels are drawn from the `@conservation-writer`-approved copy.
- Keyboard: Space/Enter toggle selection; focus ring is the S23 token.

### S9 — SegmentedControl
- Roving tabindex: only the selected segment is in the tab order; arrow keys move selection; Home/End jump to first/last.
- Each segment has a 44px minimum hit target.

### S10 — Buttons / Inputs
- Primary / secondary / tertiary buttons render with tokenized bg/border/ink; disabled states meet AA contrast with their own tokenized muted treatment.
- Inputs and selects use the tokenized focus ring.

### S11 — Genus model + admin
- Migrations run cleanly from an empty DB and against staging data; Migration B is idempotent and reversible.
- Post-migration assertion: every `Species` has a non-null `genus_fk` before Migration C tightens the constraint.
- **No new fields on `Species`** other than `genus_fk`. Migrations touch only `Genus`, `SiteMapAsset`, and `Species.genus_fk`.
- `GenusAdmin` is registered, searchable by `name`, filterable by `family`, and its silhouette field strips SVG root-size attrs on save using the shared helper.
- Data-integrity test: asserts one-to-one genus → family across all rows; fails the suite if violated (R1 mitigation).

### S12 — Serializer / filter
- `SpeciesListSerializer` and `SpeciesDetailSerializer` both expose `genus: {name, has_silhouette}`.
- `SpeciesFilter` accepts `?genus=Paretroplus` and resolves via `genus_fk__name`; previous string filter still works for one release.
- Queryset uses `.select_related("genus_fk")`; list-endpoint query count verified stable (no regression) via a query-count test on a 50-species fixture.
- `GET /api/v1/genera/<name>/silhouette/` returns the SVG body with `Cache-Control: public, max-age=...` when present; returns 404 otherwise. No auth required.

### S13 — Cascade UI
- **Given** a species with `silhouette_svg` set, **when** the profile renders, **then** the species SVG is shown.
- **Given** a species without `silhouette_svg` but whose genus has one, **when** the profile renders, **then** the genus SVG is shown (fetched via the genus endpoint).
- **Given** a species whose genus also lacks a silhouette, **when** the profile renders, **then** nothing renders in the silhouette slot (no placeholder, no family glyph).
- List/card path does **not** call the genus endpoint; cards render nothing when species SVG is absent (perf).

### S14 — SiteMapAsset model + admin
- Unique constraint on `slot`: only one row per slot exists in the DB after the pre-seed migration; second insert for the same slot raises `IntegrityError`.
- Pre-seed data migration creates exactly two rows: `hero_thumb` (expected 160×320) and `profile_panel` (expected 180×360), both with empty `image`.
- Admin `list_display` renders an image preview when an image is uploaded; renders "(none)" when empty.
- Save of a `SiteMapAsset` invokes the existing `revalidate_public_pages` hook.

### S15 — SiteMapAsset endpoint + helper
- `GET /api/v1/site-map-assets/hero_thumb/` returns `{url, alt, credit, width, height}` when an image is uploaded; returns 404 when the row's image is empty or when the slot is unknown.
- `getSiteMapAsset(slot)` in `frontend/lib/siteMapAssets.ts` is typed to the slot enum; unknown slots fail the build.

### S16 — SpeciesCard rebuild
- Card renders left color bar keyed to IUCN status, silhouette column (or empty per S13), metadata row `family · endemism · basin`, softened CARES/SHOAL text row, and a right-side IUCN pill.
- Basin segment omitted entirely when `primary_basin` is null (no dangling separator).
- Whole card remains a single link to `/species/<id>/`.
- List page query count does not regress (S17 annotations stand in for per-row queries).

### S17 — Serializer annotations
- `SpeciesListSerializer.primary_basin` derives from the species' primary locality (first locality ordered by existing canonical ordering); null when none.
- `SpeciesListSerializer.locality_count` reads from a queryset `.annotate(locality_count=Count("localities"))` — **not** a serializer method that issues per-row queries.
- Query-count test on a 50-species list response: total queries stay below a documented bound (e.g. ≤8).

### S18 — Home
- Hero numeral matches the current coverage-gap computation (pulled from an aggregate, not hard-coded).
- Red List histogram bars are colored from the same tokens as the IUCN pills.
- Three-up feature cards link to `/species/`, `/map/`, `/dashboard/`.
- Hero map slot uses `hero_thumb` when uploaded; uses the stripe fallback otherwise (see AC under S20).

### S19 — Directory
- Filter rail on left, card grid on right, density control above the grid.
- Density param: `?d=comfortable` vs `?d=compact` changes row gap + card padding; unrecognized value falls back to `comfortable`.
- CARES chips are `CCR / CEN / CVU / CLC`.
- URL `/species/` unchanged; no redirect added.

### S20 — Profile
- Hero strip renders for every species. **No species is expected to have a hero photo in Gate 1; the stripe fallback is the default path.**
- **Stripe fallback is a subtle diagonal-stripe CSS gradient over `--bg-sunken`** — not a blank color block. Visible on inspection; reusable utility.
- Three-up meta strip uses the tokenized type scale.
- Sections render in the §16.4 order.
- Distribution section renders `profile_panel` asset when present, with stripe fallback when absent; interactive `MapClient` renders below.
- URL remains `/species/<id>/` with a numeric ID.

### S21 — Map page
- Visual re-skin applied; no changes to `MapClient.tsx` internals.
- `MapListView.tsx` is reachable via Tab from the page header; the map container carries an accessible hint pointing screen-reader and keyboard users at the list view.

### S22 — Dashboard re-skin
- Panel order, widget composition, and data bindings **unchanged** from current production.
- Cards, pills, and headings adopt the new tokens, type, and primitives.
- No new panels, no demoted panels.

### S23 — Accessibility
- `:focus-visible` globally applies `outline: 2px solid var(--focus); outline-offset: 2px`.
- Skip-to-content link: visually hidden by default, becomes visible on focus, moves focus to `<main id="main">`.
- `FilterChip`, `SegmentedControl`, and map legend toggles have ≥44px hit targets verified by computed-style assertions.
- Route transition is 200ms fade + 4px rise; under `prefers-reduced-motion: reduce`, transition is disabled.
- `--ink-3` usage audited: any use on text < 12px flagged in code review.

---

## 5. Stop-ship checkpoint summary

| Checkpoint | Stories complete | What ships |
|---|---|---|
| **A — tokens + type** | S1, S2, focus-ring portion of S23 | Site re-skinned everywhere, functionally identical. Old chrome and old cards. |
| **B — chrome done** | A + S3, S4, S5, skip-link portion of S23 | New header, footer, sync strip. Pages still use old card styling. |
| **C — primitives + cards** | B + S6..S10, S11..S13 (cascade), S16, S17, hit-target portion of S23 | Directory and Home read correctly. Profile and Map visually re-skinned but layout is old. Silhouette cascade live. |
| **Full Gate 1** | C + S14, S15, S18..S22, reduced-motion portion of S23 | All pages composed to §16. Map thumbnails live. Dashboard visually updated (no reorg). |

If the June 1 deadline approaches with Checkpoint C complete but Full not, ship C. It is a coherent site.

---

## 6. Gate checkpoint (at gate close — "Full Gate 1")

Demonstrable at close:

- Every existing route renders in the new visual system with no regressions in existing functional tests.
- Admin can upload a silhouette to a `Genus` and it appears on every species in that genus that lacks its own SVG; species with their own SVG are unaffected; genera with neither species-level nor genus-level SVGs render nothing.
- Admin can upload a PNG to `hero_thumb` and it appears on Home; same for `profile_panel` on a profile. Unset slots render the stripe fallback (Home) or the stripe panel + interactive map below (Profile).
- Species URLs remain numeric: `/species/42/`. No redirects introduced.
- Dashboard looks like the rest of the site but is information-architecturally unchanged.
- Tabbing through Home and Directory yields a visible focus ring on every interactive element, hits a skip-to-content link first, and triggers no hit target under 44px on chips or toggles.
- `prefers-reduced-motion: reduce` disables the route transition and the sync strip pulse.

---

## 7. Test writer guidance

Invoke `@test-writer` at gate close to author tests from the AC above. At minimum, verify:

**Backend**
- Genus migration B is idempotent: running it twice leaves the DB in the same state.
- Genus migration B is reversible: running the reverse leaves `genus_fk` null and deletes orphan `Genus` rows.
- Post-migration-C assertion: `Species.objects.filter(genus_fk__isnull=True).count() == 0`.
- Data-integrity test: one-to-one genus → family across all `Species` rows (R1 mitigation).
- `SiteMapAsset` uniqueness per slot: second insert for `hero_thumb` raises `IntegrityError`.
- `SiteMapAsset` pre-seed: exactly two rows exist immediately after migrations run on a fresh DB.
- Admin save of a `SiteMapAsset` invokes `revalidate_public_pages` (mock and assert).
- `GET /api/v1/genera/<name>/silhouette/` returns 200 with body when present, 404 otherwise.
- `GET /api/v1/site-map-assets/<slot>/` returns 200 with `{url, alt, credit, width, height}` when image uploaded, 404 when empty or slot unknown.
- `SpeciesListSerializer` exposes `primary_basin`, `locality_count`, and nested `genus: {name, has_silhouette}`.
- List endpoint query count on a 50-species fixture stays at or below a documented bound (no N+1 on `locality_count` or genus).
- `Species.iucn_status` write path: writing directly raises/is rejected per the mirror-policy invariant (or at minimum, a test enforces that the redesign did not introduce a new write path).

**Frontend**
- Silhouette cascade: three scenarios — species SVG present, only genus SVG present, neither present — produce the expected DOM.
- List/card path does not call the genus silhouette endpoint (spy assertion).
- IUCN pill: every variant includes the two-letter code as text and the long name in `aria-label`. `NE` renders for null `iucn_status`.
- Basin pill renders nothing when basin is null.
- Filter chip CARES group renders exactly four chips with machine values `CCR / CEN / CVU / CLC`.
- Density param on Directory: `?d=compact` and `?d=comfortable` yield different grid styles; unrecognized values fall back to comfortable.
- Stripe fallback: profile hero without a `hero_photo_url` renders the diagonal-stripe gradient utility (assert presence of the utility class or a computed background).
- Skip-to-content link: Tab from page load lands on the skip link first; Enter moves focus to `<main>`.
- Focus ring: `:focus-visible` on a button resolves to `outline: 2px solid var(--focus)`.
- Hit targets: `FilterChip` and `SegmentedControl` segments have ≥44px computed height/width.
- Reduced-motion: under `prefers-reduced-motion: reduce`, route transition is disabled and sync-strip dot is static.

**Adversarial scenarios**
- Species with `genus_fk` but `genus_fk.silhouette_svg = ""` (empty string) — cascade must treat this as absent and fall through to "nothing", not render an empty `<svg>`.
- `SiteMapAsset` row exists but `image` is blank — endpoint returns 404, not a broken URL.
- Genus name containing a space or unusual character — silhouette endpoint URL encoding is correct.
- IUCN status is legitimately `NE` (assessed as "Not Evaluated") vs `NULL` (never assessed) — both render as `NE` pill but keep their underlying values distinct (mirror policy R4).
- Admin attempts to set `Species.iucn_status` directly — existing guard holds; redesign introduces no bypass.
- Route change with `prefers-reduced-motion: reduce` does not produce any motion.
- Reader at 400% zoom: `SiteHeader` doesn't cover page content; skip link remains reachable.
- `primary_basin` derivation: species with no localities returns null, not empty string.

---

## 8. Verification plan

At gate close:

- **@test-writer** — write acceptance tests from §4 above, including the adversarial scenarios in §7. Runs after S17 and again after S22.
- **@security-reviewer** — run after S11 and S14 land (Genus admin + SiteMapAsset admin). Both surfaces touch admin auth and image/file upload (SVG-as-text is a scripting vector; `ImageField` wants MIME enforcement on `site-maps/`). Re-run at gate close to cover the endpoint surface (`/api/v1/genera/...`, `/api/v1/site-map-assets/...`).
- **@code-quality-reviewer** — run after primitives (S6..S10) and after cards (S16) so patterns are locked in before pages consume them. Re-run at gate close.
- **UX pass (human)** — compare shipped Home, Directory, Profile, Map, Dashboard against `handoff-refs/` screenshots if present; otherwise against `docs/design.md` §16 compositions. Sign-off by Alex before merge.
- **@conservation-writer** — sign off on CARES chip labels (S8) and any profile / empty-state microcopy introduced in S19 and S20.

---

## 9. Risks and open questions

- **R1 — Genus/family drift.** Mitigation picked: integrity test now, computed property in Gate 2. Tracked under S11 AC.
- **R2 — `locality_count` N+1.** Addressed via annotation on the viewset queryset (S17 AC). Verified by query-count test.
- **R3 — Pre-seeding `SiteMapAsset`.** Pre-seed is in scope (S14 AC). If a new slot is added later, its pre-seed is part of that slot's introductory migration.
- **R5 — Dashboard scope.** Visual only. Any drift toward reorientation work gets bounced back to Gate 3. PM to guard this during review of S22 PRs.
- **Open — Genus silhouette coverage.** Content team may ship zero genus SVGs by June 1. Cascade degrades to nothing, per D1. Demo talking point: "the cascade exists; coverage will follow."
- **Open — Hero photo asset pipeline.** Not in Gate 1 — stripe fallback everywhere. Gate 2 picks up `hero_photo_url` / `hero_photo_credit`.

---

## 10. Out of scope for Gate 1 (explicit)

- Slug URLs for species (Gate 2).
- `hero_photo_url` and `hero_photo_credit` fields (Gate 2). Gate 1 uses stripe fallback for every profile.
- `FieldProgram` and `ExSituHolding` models (Gate 2).
- Dashboard reorientation — ex-situ coordinator panels, coverage-gap panel, single-institution-risk panel, studbook status, recently-updated, demoting Red List snapshot (Gate 3).
- Contribution flows (`/contribute/husbandry/*`) beyond token inheritance via `globals.css`.
- Dropping the `Species.genus` string column (Gate 2 cleanup, after all read paths confirmed migrated).
- Family FK / `Family` model (not planned — D1 forbids family fallback; family remains a string).
- Route renames or redirects (D3).
- New schema fields on `Species` (D7; only `genus_fk` is added).
