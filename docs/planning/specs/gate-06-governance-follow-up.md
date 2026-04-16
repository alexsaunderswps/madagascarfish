# Gate 06b — Conservation Status Governance (follow-up)

**Status:** Not started
**Preconditions:** Gate 06 complete (`gate/06-iucn-sync-seed-data` merged to `main`). `Species.iucn_status` mirror path, `ALLOW_IUCN_STATUS_OVERWRITE` setting, `SyncJob`, `ConservationAssessment` with `source` + `review_status` + `flagged_by`, and `iucn_sync` task all in place.
**Unlocks:** Gate 07 (MVP Public Frontend) — the public profile status badge contract (Tier 1 attribution: "Expert review — {assessor}" vs "IUCN {category}") depends on `manual_expert` source existing and on the conflict state being represented in the mirror.
**Branch:** `gate/06b-status-governance`
**Input:** `docs/planning/business-analysis/conservation-status-governance.md` (Sections 1–7 are the requirements; Section 8 holds the locked decisions dated 2026-04-16 that supersede draft conflicts).

---

## Purpose

Close the four governance gaps identified after gate 06 shipped the `Species.iucn_status` mirror:

1. No audit trail for status changes.
2. No canonical source value for human-reviewed overrides.
3. No enforcement at the admin edit surface that routes changes through a `ConservationAssessment`.
4. No detection when an incoming IUCN assessment contradicts an existing `manual_expert` override.

This gate ships BA Requirements **1, 2, 3a, and 4**. Requirement **3b** (GBIF pre-publish check) is deferred to gate 08+ when the GBIF export pipeline itself is spec'd.

Implementation order on the branch, per BA §4: **Req 2 → Req 1 → Req 3a → Req 4.**

---

## Deliverables

### Models (new + modified)
- **New model `AuditEntry`** (app: `audit` — new Django app, or `integration` if PM prefers to keep governance infra co-located with `SyncJob`; recommend new `audit` app).
  - Fields: `target_type` (CharField, e.g. `'Species'` / `'ConservationAssessment'`), `target_id` (PositiveIntegerField), `field` (CharField, nullable — used for field-level Species audit; null for row-level CA audit), `actor_type` (enum `user` / `system`), `actor_user` (FK → `settings.AUTH_USER_MODEL`, nullable), `actor_system` (CharField, e.g. `'iucn_sync'` / `'unknown'`, nullable), `action` (enum: `create` / `update` / `delete` / `mirror_write` / `conflict_detected` / `conflict_resolved`), `before` (JSONField), `after` (JSONField), `reason` (TextField, blank), `sync_job` (FK → `SyncJob`, nullable), `timestamp` (DateTimeField, `auto_now_add`, indexed).
  - Indexes: `(target_type, target_id, -timestamp)` composite; `(-timestamp)`; `(actor_type, -timestamp)`.
  - Append-only enforcement at the model level: override `save()` to raise `PermissionError` if `pk` is already set (no updates); override `delete()` to raise `PermissionError`. Admin `has_change_permission`, `has_delete_permission`, `has_add_permission` all return `False` (mirrors the read-only `SyncJobAdmin` pattern from gate 06).
- **New model `ConservationStatusConflict`** (app: `species`).
  - Fields: `species` (FK → Species, indexed), `manual_assessment` (FK → ConservationAssessment, `PROTECT`, `related_name='manual_conflicts'`), `iucn_assessment` (FK → ConservationAssessment, `PROTECT`, `related_name='iucn_conflicts'`), `detected_at` (DateTimeField, auto), `detected_by_sync_job` (FK → SyncJob, nullable), `status` (enum: `open` / `resolved`, default `open`), `resolution` (enum, nullable: `accepted_iucn` / `retained_manual` / `reconciled` / `dismissed`), `resolution_reason` (TextField, blank — required when `status='resolved'`; enforced in admin form `clean`), `resolved_by` (FK → User, nullable), `resolved_at` (DateTimeField, nullable).
  - Constraint: unique `(species, manual_assessment, iucn_assessment)` to prevent duplicate conflict rows for the same pair.
- **Modified `ConservationAssessment.Source`**: add `MANUAL_EXPERT = "manual_expert"`.
- **Modified `ConservationAssessment`**: add `created_by = ForeignKey(User, null=True, blank=True, on_delete=SET_NULL, related_name='authored_assessments')`. Separate field from `flagged_by` (per decision 4). Historical rows keep `created_by=NULL`; no backfill.
- **Modified `ConservationAssessment`**: add `conflict_acknowledged_assessment_ids = JSONField(default=list, blank=True)` — tracks IUCN `assessment_id`s that a `manual_expert` row has already been reviewed against and deliberately retained (see Req 4 idempotency).

### Migrations
Three sequential migrations under `species/migrations/` and one under `audit/migrations/` (or `integration/migrations/`):
1. `audit.0001_initial` — creates `AuditEntry` with indexes.
2. `species.000X_add_manual_expert_source` — `Source.MANUAL_EXPERT` enum value + `created_by` FK + `conflict_acknowledged_assessment_ids` JSON field.
3. `species.000X_conservation_status_conflict` — creates `ConservationStatusConflict`.

All three migrations must be additive only. No existing row modifications, no backfill.

### Admin changes
- **`AuditEntryAdmin`**: read-only list view with filters (`target_type`, `actor_type`, date-range), ordering newest-first. No add/change/delete. Search on `target_type` + `target_id` + `actor_user__username` + `actor_system`.
- **`SpeciesAdmin`**: `iucn_status` added to `readonly_fields`. Help-text override on that field per BA Req 3a copy. Inline panel `SpeciesAuditInline` listing the last 12 months of `AuditEntry` rows where `(target_type='Species' AND target_id=this.id)` OR `(target_type='ConservationAssessment' AND target_id IN species.conservation_assessments)`. Visible to Tier 3+ (per decision 2, ship in phase 1).
- **`SpeciesAdmin`**: banner at top of change form when `ConservationStatusConflict.objects.filter(species=obj, status='open').exists()`, linking to the conflict admin.
- **`ConservationAssessmentAdmin`**:
  - Form validation: when `source='manual_expert'`, require `category`, `assessor`, `assessment_date`, `notes`, `created_by` (the latter defaults to `request.user` in `save_model` if blank).
  - Form validation: `reason` prompt (free-text field on the admin form, not a model field) required on manual_expert creates and conflict resolutions only. The reason is passed through to the `AuditEntry.reason` field via the audit hook.
  - Tier 3 coordinators may create `manual_expert` rows for species within their institutional scope; Tier 5 unrestricted (per decision 3, **no dual-approval** — Tier 5 can create with `review_status='accepted'` in one step; the `under_revision` default from the draft body is withdrawn).
  - `review_status='accepted'` transitions on a `manual_expert` row trigger the mirror path.
- **`ConservationStatusConflictAdmin`**: list view filtered by `status` with open-count badge on dashboard. Change view renders a resolution form — selecting a `resolution` enum value and providing `resolution_reason` flips `status='resolved'`, sets `resolved_by=request.user`, `resolved_at=now()`, runs the post-resolution side effects (see Req 4 resolution outcome table in BA spec §3 Req 4), and writes an `AuditEntry` with `action='conflict_resolved'`.

### Signal handlers / audit hooks
- `pre_save` + `post_save` on `Species` capturing changes to `iucn_status`. Records actor via thread-local context (set by the admin middleware / by explicit `with audit_actor(...)` context manager inside the sync task). Default `actor_system='unknown'` when no context is set — this makes out-of-band writes searchable per BA Req 3a last AC.
- `post_save` on `ConservationAssessment` capturing create/update as row-level entries (before/after dict of changed fields only).
- `post_delete` on `ConservationAssessment` capturing the delete.
- `iucn_sync._sync_one_species` wraps its DB work in `with audit_actor(system='iucn_sync', sync_job=job): ...` so mirror writes and CA upserts are attributed correctly.
- `ConservationStatusConflictAdmin.save_model` wraps its resolution side-effect chain in `with audit_actor(user=request.user, reason=form.cleaned_data['resolution_reason']): ...`.

### Assertions
Per decision 7, add a `pre_save` signal on `Species` that raises `AssertionError` in `DEBUG` when `iucn_status` has changed and the current audit-actor context is not `system='iucn_sync'` or an explicit sanctioned `manual_expert_mirror` actor. In production (`DEBUG=False`) the assertion is skipped, but the audit entry is still written with `actor_system='unknown'` so the violation is searchable.

### IUCN `iucn_sync` extension (Req 4)
Inside `_sync_one_species`, after fetching the incoming IUCN `(assessment_id, category)` but before the existing upsert branch:
- Look up any `ConservationAssessment` for this species with `source='manual_expert'` and `review_status IN ('accepted', 'under_revision')`.
- If one exists and its `category != incoming category` and `incoming assessment_id NOT IN manual.conflict_acknowledged_assessment_ids`:
  - Write the incoming IUCN row with `review_status='pending_review'` (create new, or update existing `iucn_official` row but force `review_status='pending_review'`).
  - Do **not** mirror to `Species.iucn_status`.
  - `get_or_create` a `ConservationStatusConflict(species, manual_assessment, iucn_assessment, status='open', detected_by_sync_job=job)`.
  - Write `AuditEntry` with `action='conflict_detected'`, `target_type='Species'`, `before={'iucn_status': species.iucn_status}`, `after={'conflict': {'iucn_assessment_id': ..., 'manual_assessment_id': ...}}`.
  - Return `"skipped"` (counts against `records_skipped`, not errored).
- Otherwise, existing gate-06 branch runs unchanged.

### IUCN `assessment_id` stability task
Per decision 8, before landing Req 4: make live IUCN API v4 calls for 3–5 species (e.g. *Pachypanchax sakaramyi*, *Paretroplus menarambo*, *Bedotia madagascariensis*) across two days; verify `assessment_id` is stable for unchanged assessments. Record findings in a commit message or in `docs/planning/notes/iucn-assessment-id-stability.md`. **If IDs prove unstable**, substitute a composite idempotency key `(iucn_taxon_id, year_published, category)` stored in `conflict_acknowledged_assessment_ids` as JSON tuples — wrap the lookup in a helper so the storage format is centralized.

---

## Acceptance Criteria

Grouped by requirement, pruned per 2026-04-16 decisions.

### Requirement 2 — `manual_expert` source (implement first)

**Given** a Tier 3 coordinator creating a `ConservationAssessment` via Django admin with `source=manual_expert`
**When** they submit with `category='CR'` but leave `assessor` blank
**Then** the form rejects with a field-level error "`assessor` is required when `source` is `manual_expert`" and no row is saved. Same for missing `assessment_date`, `notes`, and `created_by`.

**Given** a Tier 5 admin creating a `manual_expert` assessment with all required fields populated, `review_status='accepted'`, and a non-empty `reason` on the admin form
**When** they save
**Then** (a) the row is saved with `review_status='accepted'` in one step (no dual-approval), (b) `created_by` is set from the form or falls back to `request.user`, (c) `Species.iucn_status` is updated to match `category` via the mirror path, (d) an `AuditEntry` is written for the CA create (with the admin-supplied reason) and a second `AuditEntry` is written for the Species mirror write (with `reason="mirror from ConservationAssessment id={id}"`).

**Given** a species with a `manual_expert accepted` assessment dated 2026-03-01 and no `iucn_official` assessment
**When** `iucn_sync` runs and the species has no `iucn_taxon_id`
**Then** the sync skips this species entirely; the `manual_expert` row is untouched; `Species.iucn_status` stays at the manual category; no audit entries are written for this species.

**Given** historical `ConservationAssessment` rows with `source='iucn_official'` and `created_by=NULL` created before this gate
**When** a Tier 3 coordinator creates a new `manual_expert` row for the same species
**Then** the create succeeds; no backfill is required on the historical row; the new row's `created_by` is populated normally.

### Requirement 1 — Audit log

**Given** a Tier 5 admin editing a `ConservationAssessment` and changing `review_status` from `accepted` to `pending_review`
**When** they save
**Then** an `AuditEntry` is created with `target_type='ConservationAssessment'`, `target_id={row id}`, `actor_type='user'`, `actor_user={admin user}`, `action='update'`, `before={'review_status':'accepted'}`, `after={'review_status':'pending_review'}`, and `reason=''` (routine edit, no prompt per decision 6).

**Given** `iucn_sync` accepts a new IUCN category for a species and writes the mirror
**When** the mirror write executes inside `_sync_one_species`
**Then** an `AuditEntry` is created with `target_type='Species'`, `target_id={species id}`, `field='iucn_status'`, `actor_type='system'`, `actor_system='iucn_sync'`, `action='mirror_write'`, `before={'iucn_status': old}`, `after={'iucn_status': new}`, `sync_job={job}`, `reason='mirror from ConservationAssessment id={id}'`.

**Given** a Tier 5 admin views the `AuditEntry` list in Django admin
**When** the list renders
**Then** rows are newest-first, filterable by `target_type`, `actor_type`, and date range; add/change/delete permissions all return `False`.

**Given** a Tier 1–4 user hits the `AuditEntry` list or detail
**When** the request is processed
**Then** the response is 403 (or the admin URL is not registered for that user).

**Given** a Tier 3 coordinator navigates to a Species change page in Django admin
**When** the page renders
**Then** an inline panel shows all `AuditEntry` rows where `target` is this species or any of its `ConservationAssessment` rows, for the last 12 months, newest-first.

**Given** a developer in `DEBUG=True` calls `species.save(update_fields=['iucn_status'])` outside the sanctioned mirror-actor context
**When** the save occurs
**Then** an `AssertionError` is raised. In `DEBUG=False`, the save succeeds but an `AuditEntry` is written with `actor_system='unknown'`, making the violation searchable.

### Requirement 3a — Admin form blocks direct `iucn_status` edit

**Given** a Tier 5 admin views the Species change form
**When** the form renders
**Then** `iucn_status` is displayed read-only (in `readonly_fields`), shows the current value, and displays help-text:
> Conservation status is determined by the most-recent-accepted ConservationAssessment for this species. It cannot be edited here. To change it, create a new ConservationAssessment with `source=manual_expert` and set its `review_status` to `accepted`.

**Given** a script POSTs a modified `iucn_status` value to the Species admin change view
**When** the request is processed
**Then** the submitted `iucn_status` is ignored (field is read-only server-side), and a warning-level log entry names the user and the attempted value.

### Requirement 4 — IUCN vs manual-expert conflict detection

**Given** species X has an `accepted manual_expert` row with `category='CR'` and `iucn_sync` retrieves an IUCN assessment with `category='EN'` and `assessment_id=9999` (not in `conflict_acknowledged_assessment_ids`)
**When** the sync processes X
**Then** (a) a `ConservationAssessment(source='iucn_official', category='EN', review_status='pending_review', last_sync_job=job)` is created/updated, (b) a `ConservationStatusConflict(species=X, status='open', manual_assessment=..., iucn_assessment=...)` is created, (c) `Species.iucn_status` remains `'CR'`, (d) no mirror-write `AuditEntry` is produced; a `conflict_detected` `AuditEntry` is produced instead, (e) the sync counts X as `records_skipped`.

**Given** an admin resolves the conflict with `resolution=retained_manual` and `resolution_reason="Ziegler 2024 field data supports CR; IUCN uses outdated 2018 data"`
**When** the resolution form is saved
**Then** (a) the conflict `status` flips to `resolved`, `resolved_by` and `resolved_at` are populated, (b) the `iucn_official` row stays at `review_status='pending_review'` with a line appended to `review_notes` recording the decision and date, (c) the `manual_expert` row's `conflict_acknowledged_assessment_ids` gains the IUCN `assessment_id`, (d) an `AuditEntry` with `action='conflict_resolved'` and the supplied reason is written.

**Given** the next weekly `iucn_sync` runs and the IUCN API returns the same assessment (same `assessment_id`)
**When** the sync processes X
**Then** no new `ConservationStatusConflict` is created; no category change; X counts as `records_skipped`; no new audit entries for X.

**Given** a later sync retrieves a **new** IUCN assessment for X with a new `assessment_id` (even if `category='EN'` again)
**When** the sync processes X
**Then** a new `ConservationStatusConflict` is raised (acknowledgement was keyed on `assessment_id`, not category).

**Given** `resolution=accepted_iucn`
**When** saved
**Then** the manual row transitions to `superseded` with a note, the IUCN row transitions to `accepted`, and `Species.iucn_status` is overwritten to the IUCN category via the mirror path.

**Given** `resolution=reconciled`
**When** saved
**Then** the admin form requires a new category input; both original rows transition to `superseded`; a new `manual_expert` row is created with `review_status='accepted'`, `category={reconciled}`, `created_by=request.user`; the mirror updates.

**Given** `resolution=dismissed`
**When** saved
**Then** the IUCN row is deleted; the manual row is untouched; the mirror is unchanged.

**Given** species Y has an `accepted iucn_official` row at `category='EN'` and no `manual_expert` row
**When** the sync retrieves an updated IUCN assessment with `category='CR'`
**Then** this is the normal gate-06 path: the existing row updates, the mirror writes, no conflict raised (confirms no regression).

**Given** a Tier 5 admin views the Species admin change page for a species with an open conflict
**When** the page renders
**Then** a banner reads "Open conservation status conflict — IUCN says {X}, manual expert says {Y}" with a link to the `ConservationStatusConflict` change view.

---

## Out of Scope / Explicitly Deferred

- **Requirement 3b** (GBIF pre-publish check, soft-block-with-override). Deferred to **gate 08+** when GBIF export is spec'd. The gate 08 spec must pick this up.
- Auditing of models other than `Species.iucn_status` and `ConservationAssessment`: `Institution`, `ExSituPopulation`, `HoldingRecord`, `BreedingEvent`, `Transfer`, `BreedingRecommendation`, `SpeciesLocality` are not audited in this gate.
- Auditing of other `Species` fields (`cares_status`, `shoal_priority`, `endemic_status`, `in_captivity`, etc.).
- Point-in-time reads ("show me this species as of 2025-12-01"). `AuditEntry` supports change feeds only.
- Email / Slack / SMS notifications on conflict detection. Admins poll the admin dashboard.
- Dual-approval workflow for `manual_expert` rows (explicitly withdrawn per decision 3).
- Automated resolution recommendations.
- Retention / pruning of audit entries (indefinite retention in phase 1).

---

## Migration Plan

The gate introduces 2 new models, 2 new fields, and 1 enum addition. All changes are additive.

1. **`audit.0001_initial`** — `AuditEntry` table plus the three indexes listed above. No data migration.
2. **`species.000X_manual_expert_and_created_by`** — combined migration:
   - Adds `MANUAL_EXPERT` to `ConservationAssessment.source` choices (enum-level change; Django stores it as a string field so no DB schema change beyond the `choices` Python enum, but a migration file is required for the state).
   - Adds `ConservationAssessment.created_by` FK, nullable.
   - Adds `ConservationAssessment.conflict_acknowledged_assessment_ids` JSONField with `default=list`.
3. **`species.000X_conservation_status_conflict`** — creates `ConservationStatusConflict` with its unique constraint.

**Behavior on existing rows:**
- Existing `iucn_official` rows: `created_by` stays `NULL` (no backfill); no conflict rows; no audit entries are retroactively written for historical changes.
- A Tier 3 coordinator creating their first `manual_expert` row post-migration works without any pre-existing infrastructure — the new `created_by` FK populates from `request.user`.
- The `iucn_sync` task can run on a freshly-migrated DB with zero conflict rows; it will start creating them only when a `manual_expert` row exists and disagrees with IUCN.

No rollback plan is required: if the gate needs to be reverted, the migrations reverse cleanly because no data depends on the new columns.

---

## Commit Sequence (recommended)

On `gate/06b-status-governance`:

1. `chore: scaffold audit app (empty migrations, admin registration stub)` — allows the signal wiring in later commits to import from a real app.
2. `feat(species): add manual_expert source, created_by FK, conflict_acknowledged_assessment_ids` — Req 2 model + migration. Admin form validation + required-field enforcement. No mirror changes yet.
3. `feat(audit): AuditEntry model, read-only admin, append-only enforcement` — Req 1 substrate.
4. `feat(audit): signal handlers for Species.iucn_status and ConservationAssessment; audit-actor context manager` — Req 1 wiring.
5. `feat(integration): wrap iucn_sync in audit-actor context; emit mirror_write audit entries` — Req 1 completion for sync path.
6. `feat(species): SpeciesAdmin iucn_status read-only + help text + Tier 3 audit inline panel + DEBUG assertion on out-of-band writes` — Req 3a.
7. `chore: verify IUCN assessment_id stability against live API v4` — runs the stability probe (decision 8). Commits findings doc.
8. `feat(species): ConservationStatusConflict model + admin + resolution side effects` — Req 4 model layer.
9. `feat(integration): conflict detection branch in _sync_one_species; acknowledgement idempotency` — Req 4 sync-side completion.
10. `test: adversarial coverage for Req 1/2/3a/4` — hand-off point for `@test-writer`.

Each commit should pass its own tests before the next lands.

---

## Test Plan (unit + integration, separated from @test-writer adversarial set)

### Unit
- `AuditEntry.save()` raises on update, `delete()` raises.
- `audit_actor` context manager: nested contexts, system + user mix, thread-local cleanup on exception.
- Admin form: `manual_expert` required-fields validator (each missing field surfaces a distinct error).
- Admin form: `reason` prompt required on manual_expert creates and conflict resolutions, absent on routine edits and IUCN sync writes.
- `_sync_one_species` conflict-detection branch: unit-test the three sub-cases (no manual row, manual row matches, manual row disagrees with un-acknowledged assessment).
- `conflict_acknowledged_assessment_ids` idempotency helper: add-and-check, composite-key fallback if ID stability probe fails.

### Integration
- Full `iucn_sync` run against mocked IUCN API with a mixture of species: one with no manual row (regression path), one with an agreeing manual row (no conflict), one with a disagreeing manual row (conflict created), one with a disagreeing but acknowledged manual row (no conflict).
- End-to-end manual-expert workflow: Tier 5 admin creates `manual_expert accepted` → mirror updates → audit entries appear in Tier 3 inline panel.
- End-to-end conflict workflow: sync detects → admin resolves with each of the four resolution enums → post-conditions verified per the Req 4 AC table.
- `DEBUG=True`: direct `species.iucn_status` assignment outside sanctioned path raises `AssertionError`. `DEBUG=False`: same call writes audit entry with `actor_system='unknown'`.

### `@test-writer` adversarial set (gate-exit)
Delegate at gate exit to cover:
- Race condition: two admins resolving the same `ConservationStatusConflict` concurrently.
- Race condition: `iucn_sync` running mid-resolution (conflict marked resolved, but sync re-enters the conflict branch before the acknowledgement commit).
- Permission bypass: Tier 2 researcher attempting to POST to `AuditEntry` admin URLs.
- Tier 3 coordinator attempting to create a `manual_expert` row outside their institutional scope.
- `created_by` tampering: Tier 3 submitting a form with `created_by` pointing to another user.
- Audit append-only bypass: raw SQL update on `audit_entry` — verify DB-level permissions / document that defense-in-depth is application-level only.
- Conflict acknowledgement replay: retained_manual resolution, sync runs, manual expert edits their row's `conflict_acknowledged_assessment_ids` directly — should that field be read-only in admin? (Open.)

---

## Verification Gates

At gate exit, invoke in order:

- **@test-writer** — adversarial suite above. Confirm every AC in this spec has at least one test. Confirm gate-06 regression tests still pass (no change to the unconflicted `iucn_official` path).
- **@security-reviewer** — focus on: (1) append-only guarantees on `AuditEntry` at the application layer, (2) permission enforcement on the `AuditEntry` and `ConservationStatusConflict` admin URLs (Tier 5 only; Tier 3 sees scoped inline panel only), (3) `created_by` cannot be spoofed via form submission, (4) resolution-reason text is stored without HTML/script rendering risk in the admin inline panel, (5) the conflict-acknowledgement JSON field cannot be mutated to silence future conflicts without an audit trail.
- **@code-quality-reviewer** — focus on: (1) `audit_actor` context manager cleanliness (thread-local discipline, exception safety), (2) signal handler idempotency (no double-fire on same save), (3) `_sync_one_species` readability after the conflict branch is added (it is already dense; extract helpers if needed), (4) admin form validation pattern consistency between `ConservationAssessmentAdmin` and `ConservationStatusConflictAdmin`.

---

## Gate Exit Criteria

1. All acceptance criteria above pass in CI.
2. IUCN `assessment_id` stability probe committed (either confirming stability, or the composite-key fallback is wired in).
3. Migrations apply cleanly on a fresh DB and on a gate-06-populated DB.
4. `iucn_sync` regression suite from gate 06 still passes.
5. `@test-writer`, `@security-reviewer`, `@code-quality-reviewer` reviews complete; feedback addressed or escalated.
6. `docs/planning/specs/gate-07-mvp-public-frontend.md` updated (or cross-referenced) with the badge-attribution contract: public profile shows `"Expert review — {assessor}"` when the mirror's source assessment is `manual_expert`, else `"IUCN {category}"`.
7. Gate 08+ spec TODO notes the deferred GBIF pre-publish check (Req 3b) so it is not lost.

---

## Risks and Open Questions

- **Thread-local audit-actor context in Celery workers.** Celery eagerly reuses worker processes; thread-local state must be explicitly cleared between tasks. Verify the `audit_actor` context manager's `__exit__` always clears, including on task retry.
- **`conflict_acknowledged_assessment_ids` mutability.** Currently modeled as a plain JSONField on `ConservationAssessment`. If a coordinator edits it directly in admin, they can silence future conflicts without an audit entry. Mitigation: make the field read-only in admin; only the conflict resolution side-effect writes it. Flag for `@security-reviewer`.
- **IUCN `assessment_id` stability.** Assumed stable per decision 8; stability probe is a task in this gate. If unstable, composite-key fallback must be adopted and documented before Req 4 is considered complete.
- **`AuditEntry` volume.** Every sync run writes one entry per accepted-or-conflicted species. At ~95 species weekly, that's ~5k entries/year — trivial. Revisit if auditing expands to `ExSituPopulation` etc.
- **Public badge attribution string.** Decision 9 locks "Expert review — {assessor name}" but does not specify truncation or multi-assessor formatting. Gate 07 spec must resolve.
