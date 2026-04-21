# Gate 2 — Schema Expansion

**Status:** ✅ Closed by drift (2026-04-21)
**Outcome:** Gate 2's scoped schema shipped incrementally through Gates 4–10, not as a single schema-expansion PR. This document is now a **close-out audit**, not a forward spec.

---

## Why this gate was closed without a dedicated PR

When the Registry Redesign was split into three gates on 2026-04-20, Gate 2 was written against a pre-Gate-1-implementation view of the schema. In the four weeks of Gate 1 and adjacent feature work (Gates 4–10), every field and model in Gate 2's scoped outline shipped — each alongside the feature that needed it, rather than as a speculative schema-expansion pass. When Gate 1 closed, Gate 2's outline had no work left.

Rather than cut an empty PR against `feat/registry-redesign-gate-2-schema`, we're closing Gate 2 here and documenting where each item landed.

---

## Schema audit against the original scope

| Scope item | Status | Landed in | Notes |
|---|---|---|---|
| `Species.common_names[]` | ✅ Shipped | Pre-Gate-1 | `CommonName` model, FK to `Species`, `language` ISO-639-1. Rendered in the profile's Common Names panel (PR #79). |
| `Species.provisional_name` | ✅ Shipped | Pre-Gate-1 | CharField; used by `displayScientificName()` when `taxonomic_status = undescribed_morphospecies`. |
| `Species.taxonomic_status` | ✅ Shipped | Pre-Gate-1 | Choices: `described`, `undescribed_morphospecies`. Filter-rail exposed. |
| `Species.endemic_status` | ✅ Shipped | Pre-Gate-1 | Choices: `endemic`, `native`, `introduced`. Default directory excludes `introduced` unless `include_introduced=true`. |
| `Species.cares_status` | ✅ Shipped | Pre-Gate-1 | Four-tier: `CCR / CEN / CVU / CLC`. Design-doc vocabulary was wrong; model is authoritative (locked in Gate 1 spec). |
| `Species.shoal_priority` | ✅ Shipped | Pre-Gate-1 | Boolean; directory filter rail toggle in S19. |
| `Species.hero_photo_url` + credit | ❌ Not built — **superseded** | — | D2 (Registry Redesign README) decided hero imagery lives on `SiteMapAsset` (one row per slot: `hero_thumb`, `profile_panel`) rather than per-species fields. Per-species hero photos may return in a future gate if photography is commissioned, but it is not a blocker for the June 1 deadline. |
| `FieldProgram` model | ✅ Shipped | `backend/fieldwork/models.py` | M2M to focal species + partner institutions. Surfaced on the profile page via `field_programs` inline. |
| `ExSituHolding` model (→ renamed `ExSituPopulation`) | ✅ Shipped | `backend/populations/models.py` | Named `ExSituPopulation` in the actual implementation; carries `institution` FK, `count_total`, `breeding_status` (`breeding` / `non-breeding`), census via inline `HoldingRecord` rows. |

---

## What this means for Gate 3

The dashboard panels in Gate 3 (coverage gap, single-institution risk, studbook status) assumed Gate 2's schema. Every field those panels need is already in the models:

- **Coverage gap** — `Species.iucn_status` + presence/absence of `ExSituPopulation` rows.
- **Single-institution risk** — `COUNT(DISTINCT ExSituPopulation.institution) ≤ 2` per species.
- **Studbook status** — `ExSituPopulation.breeding_status` in (`breeding`, `non-breeding`).
- **Recently updated** — any model's `updated_at` timestamp (present on `Species`, `ExSituPopulation`, `ConservationAssessment`).
- **Red List snapshot demotion** — pure FE restructure; backend already exposes category counts via `/api/v1/species/counts/`.

**No schema work is required before Gate 3 can start.**

---

## Carve-outs (deferred, not dropped)

These were in the original Gate 2 orbit but are now explicitly punted:

1. **Per-species hero photo field.** Deferred until (a) photography is commissioned for a critical mass of species and (b) we need per-species distinct hero imagery beyond the single curated `hero_thumb` SiteMapAsset slot.
2. **Slug URLs for species.** The Gate 1 spec noted slugs were deferred to Gate 2. They're now deferred indefinitely — numeric IDs are linked from elsewhere, indexed, and working. Slugs are an optimization, not a requirement.
3. **CARES tier auto-import.** Gate 2's outline flagged "sourcing decisions needed (especially CARES tier data — manual? imported?)." Status: CARES is populated manually via admin. An importer can be built if it becomes a bottleneck; it is not one today.

---

## Retroactive acceptance criteria

For the record — what Gate 2 was, had it shipped as scoped:

- [x] `common_names`, `provisional_name`, `taxonomic_status`, `endemic_status`, `cares_status`, `shoal_priority` are addressable from admin, serialized into the public API, and exposed in the frontend where relevant.
- [x] `FieldProgram` and ex-situ holding models exist with admin UI, validators, and are wired into the species detail serializer.
- [x] Seed data exercises each field (directory filters return non-empty results for each of the four CARES tiers, for each of the three endemic statuses, for described vs. undescribed, and for SHOAL-priority species).
- [x] No field forced the directory or profile to render "undefined" in the UI.

All boxes checked across current seed + production data.
