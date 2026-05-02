# Registry Redesign — Planning Hub

**Status:** Planning (pre-implementation)
**Initiated:** 2026-04-20
**Target milestone:** Gate 1 shipped before ABQ BioPark (June 1–5, 2026)
**Source handoff:** [`docs/design.md`](../../design.md) — developer handoff from the Claude design session

This folder is the canonical reference for the Malagasy Freshwater Fishes Registry redesign. Any new session, any agent, should read this file first to understand the shape of the work and the decisions already made.

---

## Why this initiative exists

`docs/design.md` is a thorough design handoff: tokens, type scale, component specs, page compositions. But it was written against an **imagined backend**, not the one we have. We need to port the visual system and the data-plumbing upgrades without breaking the functioning site, and without committing to schema changes that can't land before the June 1 workshop.

This planning hub reconciles the design doc with the current codebase, captures the decisions that shape the implementation, and splits the work into gates so nothing ships half-baked.

---

## Decisions locked in (2026-04-20)

These are agreed between Alex and Claude before the architecture review. Agents should treat these as constraints, not suggestions.

### D1 — Silhouette fallback cascade: species → genus → nothing

- **Species level:** `Species.silhouette_svg` (inline SVG text, admin-authored). Already exists.
- **Genus level:** new `Genus` model with its own `silhouette_svg`. Requires promoting `Species.genus` from a string field to a FK.
- **No generic/family fallback.** If neither species nor genus has an SVG, render nothing. This is a deliberate reversal of the design doc's "family fallback" proposal and an extension of the 2026-04-19 decision that placeholders read worse than absence.

### D2 — Map: existing `MapClient` is authoritative; thumbnails are static PNGs, per slot

- The interactive map (Leaflet, `frontend/components/MapClient.tsx`) stays as-is for the full map page and profile map.
- The design doc's proposed `<RegistryMap>` contract is **advisory only** — we extend MapClient to meet the redesign's needs, we do not replace it.
- Thumbnail-size map imagery (hero strip, profile panel, silhouette-grid tile) is **admin-uploaded static PNGs, one per slot**. Each slot is clearly labeled in admin with the expected dimensions and context so admins know what's going where.
- Slot list (initial): `hero_thumb` (~160×320), `profile_panel` (~180×360). Silhouette-grid tile (~64×124) deferred until the layout calls for it.

### D3 — Existing URLs are authoritative; the design doc's routing table is wrong

- The design doc proposes `/registry/*` paths. **Ignore.**
- Our current URL structure (`/species/*`, `/map`, etc.) stays. The redesign applies visually and structurally to existing routes in place.
- Add new routes if genuinely new pages are needed. Do not rename, redirect, or break existing routes.
- Rationale: existing URLs are linked from elsewhere, indexed, and bookmarked. The redesign is a refinement, not a new product.

### D4 — "Add, don't change" is the operating principle for the whole initiative

- New models, new fields, new routes, new components: fine.
- Modifying existing models, fields, routes, or component APIs without explicit approval: not fine.
- If an existing thing is actively wrong and needs changing, flag it and ask — don't silently rewrite.

### D5 — Asset pipeline: admin-uploaded via Django admin

- Silhouettes, hero photos, map PNGs, credits — all upload through Django admin (`ImageField` / `FileField` / `TextField` on relevant models).
- No filesystem-convention bulk importer yet. Build one only if manual upload becomes a bottleneck.
- Every asset slot in admin must carry a short description of what the asset is for, where it renders, and expected dimensions.

### D6 — Three-gate split (to protect the June 1 deadline)

- **Gate 1 — Visual system + silhouette cascade + map assets** (target: before June 1).
  Port design tokens, type system, component library, page compositions onto **existing routes with existing schema**. Add `Genus` model + genus-silhouette cascade. Add admin-uploaded map PNG slots. Soften CARES/SHOAL visual weight. Accessibility pass.
- **Gate 2 — Schema expansion** (after June 1 if needed).
  Add `common_names[]`, `provisional_name`, `taxonomic_status`, `endemic_status`, `cares_status`, `shoal_priority`, `hero_photo_url`; new `FieldProgram` and `ExSituHolding` models. Admin UI + seed + validation for each.
- **Gate 3 — Ex-situ coordinator dashboard** (depends on Gate 2).
  Rebuild the dashboard around the five ex-situ coordinator panels (coverage gap, single-institution risk, studbook status, recently updated, Red List snapshot demoted).

Each gate gets its own branch, its own spec, its own verification pass. No gate merges into the next until human review.

### D7 — Schema expansion is deferred, not dropped

- Full schema expansion would likely double the branch and compete with visual work for June 1. Split decided above.
- Gate 1 works against the **current** schema. Any field the redesign references that doesn't exist yet either: (a) degrades gracefully to absent, or (b) is deferred to Gate 2 and the design is adjusted to not depend on it in Gate 1.

---

## Open questions for the architecture review

The architecture agent should resolve or surface:

1. **Migration audit:** full delta between the design doc's assumed `Species` schema (§4 of `docs/design.md`) and what exists in `backend/species/models.py`. Categorize each missing field as "Gate 1 graceful-degrade," "Gate 2 add," or "drop."
2. **Genus model shape:** promote `species.genus` string to FK on a new `Genus` model. Migration strategy, seed path, admin surface, impact on serializers/views/filters.
3. **Map asset model:** shape of the `SiteMapAsset` (or similar) model — one row per slot, admin UI with per-slot labels and dimension hints, frontend consumption path.
4. **Component migration order within Gate 1:** tokens first, then chrome, then cards, then pages — or a vertical slice per page? Recommend a sequence that lets us ship partial wins if time runs short.
5. **Which existing routes take the redesign in Gate 1, and which are deferred to a later gate.**
6. **Accessibility baseline:** what's already in place vs. what §10 + §19 of the design doc require.

---

## Gate specs

- [Gate 1 — Visual system](./gate-1-visual-system.md) — ✅ Shipped 2026-04-21
- [Gate 2 — Schema expansion](./gate-2-schema.md) — ✅ Closed by drift 2026-04-21 (see close-out audit)
- [Gate 3 — Dashboard](./gate-3-dashboard.md) — 🟡 Spec kickoff 2026-04-21

## Follow-up ideation

Ideas raised during Gate 1/2 that don't block the June 1 deadline:

- [Narrow-range / microendemic pill](../ideation/narrow-range-pill.md) — sampling-bias risk, likely resolved with a basin count on cards rather than a categorical pill.
- [Key Biodiversity Area (KBA) overlay](../ideation/kba-overlay.md) — post-ABQ work; high value for the SHOAL conversation but additive to the dashboard rather than a blocker.

---

## How to pick this up in a new session

1. Read this file.
2. Read `docs/design.md` for the source handoff.
3. Read the gate spec you're working in.
4. Check `git branch` — redesign work happens on `feat/registry-redesign-gate-N-*` branches, never on `main`.
5. If the decisions above (D1–D7) seem wrong for what you're being asked to do, stop and ask — don't override them silently.
