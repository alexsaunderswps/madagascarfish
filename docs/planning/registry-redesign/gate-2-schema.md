# Gate 2 — Schema Expansion

**Status:** Stub — scoped after Gate 1 ships
**Depends on:** Gate 1 merged
**Branch (when cut):** `feat/registry-redesign-gate-2-schema`

## Scope (working outline)

New fields on `Species`:

- `common_names[]`
- `provisional_name`
- `taxonomic_status` (`described` | `undescribed_morphospecies`)
- `endemic_status` (`endemic` | `native` | `introduced`)
- `cares_status` (`CCR` | `priority` | `monitored` | none)
- `shoal_priority` (bool)
- `hero_photo_url` + `hero_photo_credit`

New models:

- `FieldProgram` — `{ species_id, partner, region, started_at, url }`
- `ExSituHolding` — `{ species_id, institution, individuals, started_at, studbook_url? }`

Admin UI, validation, and seed data for each. Sourcing decisions needed (especially CARES tier data — manual? imported?).

## Out of scope

- Dashboard restructure (Gate 3).
- Any frontend consumption beyond wiring existing redesigned components to the new fields.

## Acceptance criteria

_To be written by @product-manager._
