# Gate 1 — Visual System + Silhouette Cascade + Map Assets

**Status:** Stub — to be filled by @architecture, then @product-manager
**Target:** Shipped before ABQ BioPark, June 1–5, 2026
**Branch (when cut):** `feat/registry-redesign-gate-1-visual`

## Scope (working outline — architecture will refine)

- Design tokens from `docs/design.md` §12 promoted to production CSS custom properties.
- Typography from §13 wired (Spectral, IBM Plex Sans, IBM Plex Mono).
- Component library from §15: IUCN pill variants, species card, filter chips, segmented control, inputs, buttons, basin pill, coverage-gap stat.
- Page composition updates on **existing routes** per §16, applied to what the current schema supports.
- New `Genus` model + species→genus→nothing silhouette cascade (per decision D1).
- New map-asset model with per-slot admin upload (per decision D2).
- CARES/SHOAL softening per §7.
- Accessibility pass per §10 + §19.

## Out of scope (deferred to Gate 2 or 3)

- New species fields (`common_names`, `provisional_name`, `taxonomic_status`, etc.).
- `FieldProgram`, `ExSituHolding` models.
- Ex-situ coordinator dashboard restructure.
- Any route renames.

## Acceptance criteria

_To be written by @product-manager after architecture review._

## Verification gates

_Test writer, security reviewer, code quality reviewer assignments TBD._
