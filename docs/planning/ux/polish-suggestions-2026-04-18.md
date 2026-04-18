# UX Polish Review — Public Frontend

**Date:** 2026-04-18
**Reviewer:** ux-reviewer agent
**Scope:** Low-effort quality-of-life / polish suggestions. No redesigns.

The look is already solid — the type hierarchy is calm, the serif-for-taxonomy / sans-for-UI split reads as intentional, the IUCN palette is doing the semantic work it should, and the empty/error states already exist and say sensible things. What follows is a short list of cheap nudges that buy disproportionate polish without touching any locked decisions (IUCN badge palette, husbandry sky/emerald accent, conservation-first hierarchy on profiles).

## Ranked polish suggestions

1. **Add a site-wide focus-visible ring.** Global focus styling is currently only defined on the filter search input (`focus:ring-1 focus:ring-sky-500`). Keyboard users tabbing through the header, species cards, pagination, or map toggle get whatever the browser defaults supply — inconsistent across Chrome/Safari/Firefox. In `frontend/app/globals.css`, add one rule: `*:focus-visible { outline: 2px solid rgb(14 165 233); outline-offset: 2px; border-radius: 2px; }` (sky-500). This single line lifts accessibility noticeably and is invisible to mouse users. ~10 min.

2. **Skip-to-content link in the layout.** `frontend/app/layout.tsx` has no skip link, so screen-reader and keyboard users tab through every nav item on every page load. Add a visually-hidden-until-focused anchor at the top of `<body>` that jumps to `#main-content`, and give each page's `<main>` that id (or wrap once in `layout.tsx`). Tailwind has everything you need: `className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:ring-2 focus:ring-sky-500"`. ~20 min.

3. **Species directory: add a lightweight skeleton via `loading.tsx`.** Per auto-memory, `loading.tsx` has been deliberately avoided on fetch routes because of Vercel preview behaviour — but the species directory and dashboard are on 1-hour ISR (`revalidate = 3600`), so cold-cache renders occasionally feel blank for a beat on slow links. If comfortable adding one only on `/species/` (not on `/species/[id]/`), a minimal `frontend/app/species/loading.tsx` that renders the filter column plus 6 grey card placeholders (`<div className="h-24 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />`) is a visible win. Skip if the Vercel-preview issue still applies; otherwise ~30 min.

4. **Active-nav underline → pill (optional, low-effort).** `frontend/components/NavLinks.tsx` uses `underline underline-offset-4` for the active link, which can look broken next to the other sans-serif items on narrow screens where nav wraps. A subtle `bg-sky-50 text-sky-800 rounded px-2 py-0.5` for active reads cleaner and still respects the sky palette. Five-minute swap. If you prefer to keep underlines, at least bump `underline-offset-4` to `underline-offset-[6px]` so descenders in "Dashboard" / "Directory" don't clip it.

5. **Tighten the homepage hero rhythm.** `frontend/app/page.tsx` uses `py-16 sm:py-24` on `<main>` plus `gap-10` inside — on desktop the eyeline drops past the fold before the coverage-gap stat appears. Try `py-12 sm:py-16` and `gap-8`. The three nav cards also currently have `p-5` while the coverage card has `p-6`; equalizing both to `p-6` makes the card grid feel less lumpy. ~10 min, purely a spacing nudge.

6. **Species card: add a subtle lift + cursor cue on hover.** `frontend/components/SpeciesCard.tsx` already has `hover:border-sky-400 hover:shadow-md` — a one-pixel `hover:-translate-y-0.5` with `transition` (already present) adds a tactile "these are clickable" signal that pays off across a grid of 40+ cards. Pair with `focus-visible:border-sky-500 focus-visible:shadow-md` so keyboard users get the same affordance. ~10 min.

7. **Pagination: show prev/next as a disabled-looking placeholder on edges.** `frontend/components/Pagination.tsx` currently renders nothing at all when you're on page 1 (no "Previous") or the last page (no "Next"), which makes the control jump left/right as you paginate. Render both links always, but swap to a non-link `<span>` with `text-slate-400 border-slate-200` styling when disabled. The bar stays anchored and the disabled state is self-explanatory. ~20 min.

8. **404 page: add a search affordance.** `frontend/app/not-found.tsx` offers "Return home" and "Browse all species," but by far the commonest 404 on a species platform is a mistyped or renamed scientific name. Add a third action to the `EmptyState`: a plain link to `/species/?search=` with copy like "Search the directory." Even simpler: inline a one-line note under the body — `Looking for a specific species? Try the directory search.` — linked to `/species/`. Keeps `EmptyState` generic. ~10 min.

9. **Filter "Apply" should not be required for obvious toggles.** On `frontend/components/SpeciesFilters.tsx` it's easy for a user to click CR/EN/VU chips, expect the list to narrow, and then wonder why nothing happens until they hit Apply. This is borderline "change" not "polish," so the low-effort version: add a small helper line above the Apply row — `<p className="text-xs text-slate-500">Apply to update results.</p>` — so the affordance is explicit. Full live-filter would be bigger than 1 hour, so keep that for later. ~5 min.

10. **Microcopy: loosen "Counts refreshing…" on the species directory.** `frontend/app/species/page.tsx` line 65 renders "Counts refreshing…" when the dashboard fetch fails or is warming. For a user who doesn't know what "counts" refers to this is a bit cryptic. Suggest `Species count is loading…` or, if the backend is genuinely unavailable, nothing at all (the list itself already surfaces the total via `list.count`). One-line change. ~5 min.

11. **Small delight: pluralize and comma-format counts on the homepage stat.** `frontend/app/page.tsx` lines 65–72 renders "X of Y threatened species" — fine until Y crosses 3 digits. Wrap both numbers in `.toLocaleString()` so "1,234" not "1234". One-character diff (`{gap.threatened_species_total.toLocaleString()}`). Same treatment on `StatTile` values in `frontend/app/dashboard/page.tsx`. ~5 min.

## Bugs, not polish

These are things to fix regardless of the polish pass:

- **Sort buttons in `MapListView` are not keyboard-visible.** `frontend/components/MapListView.tsx` lines 73–85: the `<button>` inside `SortHeader` has no focus style. Combined with #1 above this would be resolved by the global `:focus-visible` rule, but call it out explicitly — a sortable table with invisible focus is a WCAG 2.4.7 fail.
- **Clickable-row pattern in `MapListView` has no keyboard equivalent.** `frontend/components/MapListView.tsx` line 153: the `<tr>` has `cursor-pointer hover:bg-sky-50` and comments describe "click a row to view that locality on the map," but the row itself has no `onClick`, no `tabIndex`, and no `role="link"` — only the cells contain links. So mouse users get a misleading hover cue for an interaction that doesn't actually exist at the row level (they have to hit one of the per-cell links). Either remove `cursor-pointer` from the `<tr>` (recommended — simpler), or make the row a real keyboard-reachable link.
- **`SiteHeader` max-width is narrower than most pages.** `frontend/components/SiteHeader.tsx` uses `max-w-5xl` while `frontend/app/species/page.tsx` uses `max-w-6xl` and `MapListView` uses `max-w-6xl`. On wide monitors the nav bar visually detaches from the content it sits above. Align to `max-w-6xl` in the header (and footer, which is also `max-w-5xl`). ~2 min.
- **`UpdatedAgo` component has an SSR/CSR hydration mismatch risk.** `frontend/components/UpdatedAgo.tsx` initializes `now` with `Date.now()` in `useState`, which on the server produces a different value than the client's first render. React will usually paper over this but the `time` element text will briefly flicker. Low priority but worth noting — render `null` or `{iso}` until `useEffect` runs.

## Files referenced

- `frontend/app/layout.tsx`
- `frontend/app/globals.css`
- `frontend/app/page.tsx`
- `frontend/app/species/page.tsx`
- `frontend/app/species/[id]/page.tsx`
- `frontend/app/not-found.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/components/NavLinks.tsx`
- `frontend/components/SiteHeader.tsx`
- `frontend/components/SiteFooter.tsx`
- `frontend/components/SpeciesCard.tsx`
- `frontend/components/SpeciesFilters.tsx`
- `frontend/components/Pagination.tsx`
- `frontend/components/MapListView.tsx`
- `frontend/components/UpdatedAgo.tsx`
