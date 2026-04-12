# Gate 06 — IUCN Sync & Seed Data

**Status:** Not started
**Preconditions:** Gate 03 complete (auth), Gate 04 complete (Admin usable for verification)
**Unlocks:** Gate 07 (MVP Public Frontend) — frontend needs real data to demonstrate

---

## Purpose

Two independent but related tasks that must both be complete before the MVP frontend is meaningful:

1. **IUCN Sync** — automated weekly pull of conservation assessments from the IUCN Red List API v4 into `ConservationAssessment` records. This is the only automated integration for MVP.
2. **Seed Data** — a management command that loads the baseline species dataset (~95–100 species) from a prepared CSV. This is a technical task, not a user story.

Both are in this gate because they share the Celery + Redis infrastructure and because the frontend demonstration at the ECA Workshop requires live IUCN data, not placeholder data.

---

## Deliverables

- Celery worker and Celery Beat scheduler running in Docker Compose (the services exist from Gate 01 but Celery app configuration is completed here)
- `IUCNClient` class in `integration/clients/iucn.py` — wraps IUCN Red List API v4 with rate limiting and response caching (7-day Redis TTL)
- `iucn_sync` Celery task — fetches current assessment for each `Species` with `iucn_taxon_id` set; creates or updates `ConservationAssessment` with `source = 'iucn_official'`, `review_status = 'accepted'`; skips undescribed taxa without `iucn_taxon_id`; logs all errors to `SyncJob.error_log`
- `celery beat` schedule: `iucn_sync` runs weekly (Sunday 02:00 UTC)
- `SyncJob` lifecycle management: job creates a `SyncJob` record on start, updates it on completion or failure
- Management command `seed_species` — idempotently loads species from `data/seed/species.csv`

---

## Technical Tasks (Non-User-Story)

### Task 1: Celery Configuration

- Initialize Celery app in `config/celery.py`; import in `config/__init__.py`
- Configure broker (Redis) and result backend (Redis) via `django-environ`
- Configure `celery beat` with database scheduler (`django-celery-beat`) so schedules are manageable via Django Admin
- Write a smoke test: enqueue a no-op task and confirm the worker processes it
- Add `celery inspect ping` health check to `GET /api/v1/health/` response

### Task 2: IUCN API Client

The IUCN Red List API v4 requires a token (free registration at iucnredlist.org).

`IUCNClient` interface:
```python
class IUCNClient:
    def get_species_assessment(self, iucn_taxon_id: int) -> dict | None:
        """
        Returns the current assessment dict or None if not found.
        Raises IUCNAPIError on non-404 HTTP errors.
        Caches responses in Redis for 7 days.
        """

    def get_species_by_name(self, scientific_name: str) -> dict | None:
        """
        Used for name-based lookup during seed data import.
        Returns IUCN taxon record or None.
        """
```

- Rate limit: max 1 request/second (IUCN API requirement). Use `time.sleep(1)` between requests within a single task run; do not use per-request sleep for cached hits.
- Cache key format: `iucn:assessment:{iucn_taxon_id}` with 7-day TTL
- Store raw API response in cache; parse into `ConservationAssessment` fields in the task, not the client

### Task 3: `iucn_sync` Celery Task

```python
@app.task(bind=True, max_retries=3)
def iucn_sync(self):
    job = SyncJob.objects.create(job_type='iucn_sync', status='running', started_at=now())
    try:
        species_qs = Species.objects.exclude(iucn_taxon_id__isnull=True)
        for species in species_qs.iterator():
            try:
                assessment_data = client.get_species_assessment(species.iucn_taxon_id)
                if assessment_data:
                    _upsert_assessment(species, assessment_data, job)
                else:
                    job.records_skipped += 1
            except IUCNAPIError as e:
                job.error_log += f"Species {species.id}: {e}\n"
        job.status = 'completed'
    except Exception as e:
        job.status = 'failed'
        job.error_log += str(e)
        raise
    finally:
        job.completed_at = now()
        job.save()
```

`_upsert_assessment` creates or updates a `ConservationAssessment` with `source='iucn_official'`, using `update_or_create` keyed on `(species, source='iucn_official')`. Sets `review_status='accepted'` only if no existing record has `review_status='pending_review'` (do not overwrite a coordinator's pending review flag with an IUCN sync).

### Task 4: Seed Data Management Command

Location: `species/management/commands/seed_species.py`

The seed CSV (`data/seed/species.csv`) is prepared separately from this gate (data preparation is the project lead's task). The management command is code; the CSV is data.

**CSV schema:**
```
scientific_name, taxonomic_status, provisional_name, authority, year_described,
family, genus, endemic_status, iucn_status, cares_status, shoal_priority,
description, ecology_notes, iucn_taxon_id, fishbase_id, gbif_taxon_key
```

Command behavior:
```
python manage.py seed_species --csv data/seed/species.csv [--dry-run]
```

- `--dry-run` validates the CSV and reports what would be created/updated without writing to the database
- Idempotent: keyed on `scientific_name`; updates existing records if a row already exists in the database
- Logs counts: N created, N updated, N skipped (validation errors), with error details per row
- Does not delete existing records not present in the CSV
- After loading species, attempts IUCN name lookup for any species without `iucn_taxon_id` set (uses `IUCNClient.get_species_by_name`); populates `iucn_taxon_id` where found

---

## User Stories

### BE-06-1: IUCN Sync Runs and Produces Assessments

**As** a conservation coordinator,
**I want** the platform to automatically keep IUCN assessments current,
**so that** species profiles always reflect the latest Red List status without manual entry.

**Acceptance Criteria:**

**Given** a Species record for *Pachypanchax sakaramyi* with `iucn_taxon_id = 166478`
**When** the `iucn_sync` task runs
**Then** a `ConservationAssessment` record exists with `species = sakaramyi`, `source = 'iucn_official'`, `category` matching the current IUCN assessment, and `review_status = 'accepted'`

**Given** a Species record with `taxonomic_status = 'undescribed_morphospecies'` and `iucn_taxon_id = null`
**When** the `iucn_sync` task runs
**Then** no IUCN API call is made for that species; `job.records_skipped` increments by 1; no error is logged

**Given** the IUCN API returns a 500 error for one species during a sync run
**When** the task processes that species
**Then** the error is recorded in `SyncJob.error_log` with the species ID; the task continues processing remaining species; `job.status = 'completed'` (not `'failed'`) if at least one species succeeded

**Given** a species has an existing `ConservationAssessment` with `review_status = 'pending_review'`
**When** the `iucn_sync` task runs and finds a new IUCN assessment for that species
**Then** the existing assessment's `review_status` is not overwritten; a new `ConservationAssessment` record is created alongside the pending one; the coordinator's flag is preserved

**Given** the weekly sync job runs twice in a row without any IUCN data changes
**When** the second run completes
**Then** no duplicate `ConservationAssessment` records are created (upsert behavior)

---

### BE-06-2: Sync Job Visible in Django Admin

**As** a Tier 5 administrator,
**I want** to see sync job history in Django Admin,
**so that** I can diagnose sync failures without server access.

**Acceptance Criteria:**

**Given** an `iucn_sync` task completed with 3 errors
**When** a Tier 5 admin views the SyncJob list in Django Admin
**Then** the job appears with `status = 'completed'`, `records_updated`, `records_skipped`, and `error_log` showing the 3 error messages

---

## Out of Scope

- FishBase sync (post-MVP)
- CARES sync (post-MVP; CARES 2.0 not yet live)
- GBIF publishing (post-MVP)
- ZIMS CSV import pipeline (post-MVP)
- Automated retry for failed species within a sync run (retry on next weekly run is sufficient)

---

## Gate Exit Criteria

Before marking Gate 06 complete:
1. `iucn_sync` task completes against the real IUCN API in a local dev environment (with a valid token in `.env`)
2. `seed_species` management command loads the species CSV without errors; `--dry-run` flag validates correctly
3. After seeding, `GET /api/v1/species/` returns ~95–100 species
4. After sync, at least the described species with `iucn_taxon_id` set have `ConservationAssessment` records
5. SyncJob records are visible in Django Admin
6. All acceptance criteria tests pass (mock the IUCN API in tests; do not call the live API in CI)
7. Invoke **@test-writer** to write tests covering: task retry on transient failure, idempotent upsert, skip behavior for undescribed taxa, CSV validation edge cases
8. Invoke **@security-reviewer** — IUCN API token must be stored in env vars, never committed; verify Redis caching does not leak data across requests
9. Invoke **@code-quality-reviewer** on task and client code
