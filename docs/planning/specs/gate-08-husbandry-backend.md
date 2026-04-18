---
gate: 08
title: Husbandry & Breeding Guidance — Backend (Model + Admin + API)
status: Not started
preconditions:
  - Gate 06 complete (`ConservationAssessment` governance pattern is the reference shape).
  - Gate 07 v2 public profile shipped (`/species/[id]/` is the integration surface for the teaser in Gate 09).
unlocks:
  - Gate 09 (Husbandry Frontend Route + Profile Teaser) — needs the API endpoint and field contract.
  - Gate 10 (Husbandry Contribute Contact Form) — can run parallel but shares the same Django app.
branch: gate/08-husbandry-backend
deadline: 2026-06-01 (ECA Workshop, ABQ BioPark — SHOAL partnership conversation)
input:
  - docs/planning/business-analysis/species-profile-husbandry.md (locked 2026-04-18)
  - docs/planning/business-analysis/conservation-status-governance.md (governance pattern to mirror)
  - data/husbandry/TEMPLATE.md (canonical field list — matches this model 1:1)
  - frontend/components/HusbandrySourcingEthics.tsx (already exists — not re-scoped)
---

# Gate 08 — Husbandry & Breeding Guidance: Backend

## Goal

Ship the data model, Django admin authoring UX, and read-only public API for
per-species husbandry & breeding guidance, following the
`ConservationAssessment` governance pattern (human-reviewed, attributed,
sourced). After this gate lands, Aleksei can author the 3–5 exemplar records
from `data/husbandry/TEMPLATE.md` in Django admin before the ECA Workshop, and
the frontend (Gate 09) has a stable contract to render against.

No UI work lives in this gate. The frontend teaser + `/species/[id]/husbandry/`
route are Gate 09.

## Stories

- **Story 08.1** — As an admin, I want a `SpeciesHusbandry` model tied one-to-one
  to `Species` with structured fields for water, tank, diet, behavior, breeding,
  difficulty factors, sourcing, sources, and governance, so that I can author
  husbandry content that matches `data/husbandry/TEMPLATE.md` without lossy
  free-text dumps.
- **Story 08.2** — As an admin, I want difficulty surfaced as **factors** (not a
  single label), so that the page describes *why* a species is challenging
  rather than issuing a prescriptive verdict (locked decision Q2, 2026-04-18).
- **Story 08.3** — As an admin, I want Django admin to refuse publishing a
  `SpeciesHusbandry` record unless at least one `HusbandrySource` citation is
  attached and `last_reviewed_by` + `last_reviewed_at` are populated, so that
  every public husbandry page is traceable.
- **Story 08.4** — As an admin, I want `published` to be an explicit boolean
  independent of record existence, so that I can draft records in admin
  without exposing them on the public site until ready.
- **Story 08.5** — As a Tier 1 public consumer of the REST API, I want to
  retrieve a species' published husbandry guidance at a stable endpoint, so
  that the Next.js frontend can render `/species/[id]/husbandry/`.
- **Story 08.6** — As a Tier 1 consumer of the species detail API, I want a
  `husbandry.has_published_record` boolean (and nothing else) embedded on the
  existing `/api/species/{id}/` response, so that the profile page can decide
  whether to render the teaser block without a second request (AC-1 / AC-2).
- **Story 08.7** — As an admin editing a record whose `last_reviewed_at` is
  older than 24 months, I want the admin form to show a "review pending"
  indicator, so that I can see stale records at a glance (mirrors the public
  AC-4 rendering).

## Scope Assessment

| Story | Frontend | Backend | Full-Stack | Complexity |
|-------|----------|---------|------------|------------|
| 08.1 |   | ✓ |   | M |
| 08.2 |   | ✓ |   | S |
| 08.3 |   | ✓ |   | S |
| 08.4 |   | ✓ |   | S |
| 08.5 |   | ✓ |   | M |
| 08.6 |   | ✓ |   | S |
| 08.7 |   | ✓ |   | S |

Total: backend-only gate. No frontend changes.

## Data Model

New Django app `husbandry` (or co-locate under `species` — recommend new app
for clean migration boundary and future extension to photos/version history).

### `SpeciesHusbandry`

One-to-one with `Species`. Nullable — absence is the default state. All value
fields are nullable/blank; the template drives which are populated.

- `species` — `OneToOneField(Species, on_delete=CASCADE, related_name='husbandry')`.
- `published` — `BooleanField(default=False)`. Gates public API + frontend teaser.
- **Water** — `water_temp_c_min` / `water_temp_c_max` (Decimal, nullable),
  `water_ph_min` / `water_ph_max` (Decimal, nullable), `water_hardness_dgh_min` /
  `_dgh_max` / `_dkh_min` / `_dkh_max` (Decimal, nullable), `water_flow`
  (CharField with choices `still`/`gentle`/`moderate`/`strong`, blank),
  `water_notes` (TextField, blank).
- **Tank** — `tank_min_volume_liters` (PositiveInteger, nullable),
  `tank_min_footprint_cm` (CharField, blank — free text like "120x45"),
  `tank_aquascape` / `tank_substrate` / `tank_cover` / `tank_notes` (all TextField,
  blank).
- **Diet** — `diet_accepted_foods` (JSONField `list`, default=list),
  `diet_live_food_required` (Boolean, default False), `diet_feeding_frequency`
  (CharField, blank), `diet_notes` (TextField, blank).
- **Behavior** — `behavior_temperament` / `behavior_recommended_sex_ratio` /
  `behavior_schooling` / `behavior_community_compatibility` / `behavior_notes`
  (all CharField or TextField, blank).
- **Breeding** — `breeding_spawning_mode` (CharField with choices
  `substrate_spawner` / `mouthbrooder` / `annual_killi` / `bubble_nest` /
  `livebearer` / `other`, blank), `breeding_triggers` / `breeding_egg_count_typical`
  / `breeding_fry_care` / `breeding_survival_bottlenecks` / `breeding_notes`
  (TextField, blank).
- **Difficulty factors** (locked Q2: factors, not a single label) —
  `difficulty_adult_size`, `difficulty_space_demand`, `difficulty_temperament_challenge`,
  `difficulty_water_parameter_demand`, `difficulty_dietary_specialization`,
  `difficulty_breeding_complexity`, `difficulty_other` — all CharField, blank.
  **No aggregate `difficulty` column.**
- **Sourcing** — `sourcing_cares_registered_breeders` (Boolean, default False),
  `sourcing_notes` (TextField, blank). The narrative ethics block itself is
  rendered by the existing `HusbandrySourcingEthics.tsx` component and is not
  stored per-record.
- **Narrative** — `narrative` (TextField, blank — Markdown, 2–5 short paragraphs
  per template guidance).
- **Governance** — `contributors` (TextField, blank — free text at MVP per BA
  §5), `last_reviewed_by` (`ForeignKey(User, null=True, on_delete=PROTECT,
  related_name='reviewed_husbandry')`, required when `published=True`),
  `last_reviewed_at` (DateField, nullable; required when `published=True`),
  `created_at` / `updated_at` (auto).
- **Meta** — ordering `('species__scientific_name',)`; `verbose_name_plural =
  'Species husbandry records'`.

### `HusbandrySource`

Child table for citations (BA §5 requires ≥1 source to publish).

- `husbandry` — `ForeignKey(SpeciesHusbandry, on_delete=CASCADE,
  related_name='sources')`.
- `label` — `CharField(max_length=500)`, required.
- `url` — `URLField(blank=True)`.
- `order` — `PositiveSmallIntegerField(default=0)` for stable admin ordering.
- Meta ordering `('order', 'id')`.

### Validation (model-level `clean`)

When `published=True`:
- At least one `HusbandrySource` row must exist (checked in `ModelAdmin.save_related`,
  since inlines aren't available at model `clean` time — raise
  `ValidationError` back to the change form).
- `last_reviewed_by` and `last_reviewed_at` must be non-null.

Not implicitly required: any of the value-field sections. A record can publish
with just narrative + sources + reviewer — useful for sparse species.

## API

New DRF endpoint under the existing API app:

- `GET /api/species/{id}/husbandry/` — returns 200 with the full serialized
  `SpeciesHusbandry` (including nested `sources`, reviewer username + ORCID if
  present, `last_reviewed_at`, and a computed `review_is_stale` boolean set to
  `true` when `last_reviewed_at` is older than 24 months) **only if
  `published=True`**. Returns 404 otherwise — regardless of whether an
  unpublished draft exists. Public (no auth required). Cacheable (same
  revalidate window as species detail — 3600s).

- `GET /api/species/{id}/` — existing endpoint. Add a minimal field
  `has_husbandry` (boolean) at the top level, derived from
  `SpeciesHusbandry.objects.filter(species_id=id, published=True).exists()`.
  Do **not** embed the full husbandry payload here — the frontend fetches it
  lazily on the husbandry route. This is deliberate: the profile page stays
  fast and the husbandry payload stays cacheable independently.

Serializer exposes only the fields above. Never exposes `published` (implied by
the 404 behavior) or internal timestamps beyond `last_reviewed_at`.

## Admin

- `SpeciesHusbandryAdmin` with inline `HusbandrySourceInline` (TabularInline, min
  zero, validated to ≥1 when `published=True` via `save_related`).
- List display: species, published, last_reviewed_at, review_is_stale badge,
  source count.
- List filters: `published`, `sourcing_cares_registered_breeders`,
  `breeding_spawning_mode`.
- Search: `species__scientific_name`, `species__common_names__name`,
  `contributors`.
- Fieldsets grouped to match the template: Water / Tank / Diet / Behavior /
  Breeding / Difficulty Factors / Sourcing / Narrative / Governance.
- Help text on the Difficulty Factors fieldset: "Describe factors honestly.
  Do not attempt an overall difficulty label — the page deliberately surfaces
  factors, not a verdict."
- If `last_reviewed_at` is > 24 months old at edit time, render a warning row
  at the top of the change form: "Review is overdue; public page will show a
  'review pending' note."
- Authoring permission: Tier 5 only at MVP. Tier 4 write access is post-MVP
  (tracked separately; matches `data/husbandry/TEMPLATE.md` workflow where
  Aleksei is the sole author pre-workshop).

## Acceptance Criteria

### AC-08.1 — Model shape matches template

**Given** a developer reads `data/husbandry/TEMPLATE.md`
**When** they compare it to `SpeciesHusbandry` fields
**Then** every non-metadata field in the template has a corresponding model
field, with naming that is mechanically translatable (e.g. `water.ph_min` →
`water_ph_min`).

### AC-08.2 — No aggregate difficulty column exists

**Given** the `SpeciesHusbandry` model
**When** inspected
**Then** there is **no** `difficulty` field; difficulty is represented
exclusively by the seven `difficulty_*` factor fields.

### AC-08.3 — Publishing without a source is rejected

**Given** an admin creates a `SpeciesHusbandry` with no `HusbandrySource`
inlines and sets `published=True`
**When** they click Save
**Then** the save is rejected with a form-level error "At least one source
citation is required to publish." and the record is not marked published.

### AC-08.4 — Publishing without a reviewer is rejected

**Given** an admin creates a `SpeciesHusbandry` with at least one source but
leaves `last_reviewed_by` or `last_reviewed_at` empty and sets `published=True`
**When** they click Save
**Then** the save is rejected with a field-level error naming the missing
field(s), and the record is not marked published.

### AC-08.5 — Unpublished drafts are invisible to the public API

**Given** a `SpeciesHusbandry` exists for species X with `published=False`
**When** an anonymous client requests `/api/species/{X}/husbandry/`
**Then** the response is **404**, not 200 with a `published: false` flag.

**And Given** the same state
**When** the client requests `/api/species/{X}/`
**Then** the response body includes `"has_husbandry": false`.

### AC-08.6 — Published record is readable by Tier 1

**Given** species X has a published `SpeciesHusbandry` with one source and a
reviewer
**When** an anonymous client requests `/api/species/{X}/husbandry/`
**Then** the response is 200 and includes all non-governance fields, the
`sources` array, `last_reviewed_by` (username + ORCID if available),
`last_reviewed_at`, `contributors`, and a computed `review_is_stale` boolean.

**And Given** the same state
**When** the client requests `/api/species/{X}/`
**Then** the response body includes `"has_husbandry": true`.

### AC-08.7 — Stale review is surfaced

**Given** a published `SpeciesHusbandry` with `last_reviewed_at` more than 24
months before today
**When** the husbandry endpoint is requested
**Then** `review_is_stale` is `true` in the response.

**And Given** the same record
**When** an admin opens it in Django admin
**Then** a warning banner "Review is overdue" renders at the top of the change
form.

### AC-08.8 — One-to-one integrity

**Given** a `SpeciesHusbandry` exists for species X
**When** an admin attempts to create a second `SpeciesHusbandry` for species X
**Then** the save fails with a uniqueness error (enforced by the
`OneToOneField`).

### AC-08.9 — Species deletion cascades

**Given** species X has a `SpeciesHusbandry` with sources
**When** species X is deleted
**Then** the `SpeciesHusbandry` row and its `HusbandrySource` rows are deleted
(cascade).

### AC-08.10 — Unpublishing is reversible

**Given** a published `SpeciesHusbandry`
**When** an admin toggles `published=False` and saves
**Then** the save succeeds (no validation checks gate unpublishing), the
public endpoint 404s, and `has_husbandry` flips to `false` on the species
detail response.

## Out of Scope

- Frontend route `/species/[id]/husbandry/` and the teaser block on the profile
  (Gate 09).
- Contribute contact form (Gate 10).
- Photo/image attachments on husbandry records (post-MVP per BA §6).
- Version history / edit audit log (post-MVP; the `ConservationAssessment`
  audit pattern is not ported to husbandry in this gate).
- Tier 3+ write submission pipeline (post-MVP).
- Structured difficulty filter on the species directory (post-MVP per BA §Cross-
  Feature Impact; the factor fields exist but are not yet filter facets).
- FishBase "culture" field auto-pull (post-MVP).
- Public edit history, version diffs, comments, ratings (post-MVP).
- Richer `contributors` structure (free text at MVP is deliberate per BA §5).

## Dependencies

- `User` model (already in place).
- `Species` model (already in place).
- DRF wiring for new endpoints (existing species API app).
- Authoring workflow assumes Aleksei hand-enters 3–5 exemplars from
  `data/husbandry/TEMPLATE.md`. Q1 (authoring capacity) remains open; this
  gate is independent of final count.

## Sequencing / Deadline Note (June 1, 2026)

This gate is the **critical path** for the workshop demo. Target: merged by
**2026-05-08** to leave two weeks for Aleksei to author exemplars against the
live admin and for Gate 09 (frontend) to land on top with ~2 weeks of QA
runway before June 1. If this gate slips past 2026-05-15, consider descoping
Gate 10 (contribute form) to unblock Gates 08/09 for the demo.

## Test Writer Guidance

At this gate, the test writer should verify:

- Model-level: unique-per-species constraint, cascade-on-species-delete,
  `review_is_stale` boundary at exactly 24 months (on-day and off-by-one).
- Admin-level: publish-without-source rejection, publish-without-reviewer
  rejection, publish-with-both succeeds, unpublish has no validation gate.
- API-level: 404 vs 200 parity (unpublished → 404, published → 200);
  `has_husbandry` flag on species detail flips correctly on
  publish/unpublish/delete.
- **Adversarial:** attempting to POST/PUT/DELETE on the husbandry API as
  an anonymous or Tier 1-4 user should return 405 (read-only endpoint) or
  401/403 depending on DRF config — never 200.
- **Adversarial:** a draft record for species Y where `published=False` but
  one source + reviewer are set must still 404 publicly. Do not leak drafts
  via ETag or any other side channel.
- **Adversarial:** flipping `published=False → True` without having added
  sources in the same transaction must not succeed.

## Risks and Open Questions

- **Authoring capacity (Q1, still open).** If Aleksei lands zero exemplars
  before Gate 09 frontend work begins, the frontend cannot be visually
  verified against real content. Mitigation: seed one fixture record from
  `TEMPLATE.md` (fully populated, marked `published=False`) as part of this
  gate's test fixtures so the frontend has at least one readable shape to
  develop against.
- **Reviewer ORCID surfacing** requires `User.orcid` to exist on the auth
  model. If it does not, add a nullable `orcid` CharField to the User profile
  as part of this gate or degrade gracefully to username-only and track ORCID
  as a follow-up. Confirm before implementation starts.
- **App location (`husbandry` vs folded into `species`).** Recommending new
  app; confirm with tech lead before migration 0001 is generated.
