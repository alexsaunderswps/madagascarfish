# Gate 02 — Data Layer

**Status:** Not started
**Preconditions:** Gate 01 complete
**Unlocks:** Gate 03 (Auth & Access Control)

---

## Purpose

Create all Django applications and core models with migrations. This gate produces the database schema that every subsequent gate builds on. No business logic, no endpoints, no admin configuration — just models and migrations.

All BA-approved model changes from ba-assessment-v1.md are included here. Undescribed taxa are first-class from day one.

---

## Django Applications

| App | Models in This Gate |
|-----|---------------------|
| `species` | Species, Taxon, CommonName, ConservationAssessment |
| `populations` | Institution, ExSituPopulation, HoldingRecord |
| `fieldwork` | FieldProgram |
| `accounts` | User, AuditLog |
| `integration` | SyncJob |

Apps not created in this gate (post-MVP): `coordination` (BreedingRecommendation, PrioritizationScore), `fieldwork` extensions (Survey, OccurrenceRecord).

---

## Model Specifications

### `species.Species`

| Field | Type | Notes |
|-------|------|-------|
| `scientific_name` | CharField(200) | Full designation including informal suffix for undescribed taxa (e.g., "Bedotia sp. 'manombo'") |
| `taxonomic_status` | CharField, enum | `described` / `undescribed_morphospecies` / `species_complex` / `uncertain` — **not nullable; default `described`** |
| `provisional_name` | CharField(100), nullable | Informal epithet only (e.g., "'manombo'"). Null for described species. |
| `authority` | CharField(200), **nullable** | Null for undescribed taxa |
| `year_described` | IntegerField, **nullable** | Null for undescribed taxa |
| `family` | CharField(100) | e.g., "Bedotiidae", "Cichlidae" |
| `genus` | CharField(100) | |
| `taxon` | FK → Taxon, nullable | Link to hierarchical taxonomy |
| `endemic_status` | CharField, enum | `endemic` / `native` / `introduced` |
| `iucn_status` | CharField, enum | `EX` / `EW` / `CR` / `EN` / `VU` / `NT` / `LC` / `DD` / `NE` — nullable |
| `population_trend` | CharField, enum | `increasing` / `stable` / `decreasing` / `unknown` — nullable |
| `cares_status` | CharField, enum | `CCR` / `CEN` / `CVU` / `CLC` — nullable (null = not listed) |
| `shoal_priority` | BooleanField | Default False |
| `description` | TextField, blank | Public narrative |
| `ecology_notes` | TextField, blank | |
| `distribution_narrative` | TextField, blank | |
| `morphology` | TextField, blank | |
| `max_length_cm` | DecimalField(5,1), nullable | |
| `habitat_type` | CharField(100), blank | |
| `iucn_taxon_id` | IntegerField, nullable, unique | IUCN API identifier. Null for undescribed taxa without IUCN records. |
| `fishbase_id` | IntegerField, nullable | |
| `gbif_taxon_key` | IntegerField, nullable | |
| `created_at` | DateTimeField, auto | |
| `updated_at` | DateTimeField, auto | |

### `species.Taxon`

| Field | Type | Notes |
|-------|------|-------|
| `rank` | CharField, enum | `family` / `genus` / `species` / `subspecies` |
| `name` | CharField(200) | |
| `parent` | FK → self, nullable | Hierarchical; use `django-mptt` or nested set |
| `common_family_name` | CharField(200), blank | e.g., "Malagasy Rainbowfishes" |

### `species.CommonName`

| Field | Type | Notes |
|-------|------|-------|
| `species` | FK → Species | |
| `name` | CharField(200) | |
| `language` | CharField(10) | ISO 639-1: `en`, `fr`, `mg` |
| `is_preferred` | BooleanField | Default False; one preferred name per language |

### `species.ConservationAssessment`

| Field | Type | Notes |
|-------|------|-------|
| `species` | FK → Species | |
| `category` | CharField, enum | `EX` / `EW` / `CR` / `EN` / `VU` / `NT` / `LC` / `DD` / `NE` |
| `criteria` | CharField(100), blank | IUCN criteria string (e.g., "A2acd") |
| `assessor` | CharField(200), blank | |
| `assessment_date` | DateField, nullable | |
| `source` | CharField, enum | `iucn_official` / `recommended_revision` |
| `notes` | TextField, blank | |
| `review_status` | CharField, enum | `accepted` / `pending_review` / `under_revision` / `superseded` — **default `accepted`** |
| `review_notes` | TextField, nullable | Free-text explanation of why flagged |
| `flagged_by` | FK → User, nullable | Coordinator who flagged |
| `flagged_date` | DateTimeField, nullable | |
| `created_at` | DateTimeField, auto | |

### `populations.Institution`

| Field | Type | Notes |
|-------|------|-------|
| `name` | CharField(300) | |
| `institution_type` | CharField, enum | `zoo` / `aquarium` / `research_org` / `hobbyist_program` / `ngo` / `government` |
| `country` | CharField(100) | |
| `city` | CharField(100), blank | |
| `zims_member` | BooleanField | Default False |
| `species360_id` | CharField(50), blank | |
| `eaza_member` | BooleanField | Default False |
| `aza_member` | BooleanField | Default False |
| `website` | URLField, blank | |
| `contact_email` | EmailField, blank | Tier 3+ only |

### `populations.ExSituPopulation`

| Field | Type | Notes |
|-------|------|-------|
| `species` | FK → Species | |
| `institution` | FK → Institution | |
| `count_total` | IntegerField, nullable | Latest known total |
| `count_male` | IntegerField, nullable | |
| `count_female` | IntegerField, nullable | |
| `count_unsexed` | IntegerField, nullable | |
| `date_established` | DateField, nullable | |
| `founding_source` | CharField(300), blank | |
| `breeding_status` | CharField, enum | `breeding` / `non-breeding` / `unknown` |
| `studbook_managed` | BooleanField | Default False |
| `last_census_date` | DateField, nullable | |
| `notes` | TextField, blank | |

`unique_together`: `(species, institution)`

### `populations.HoldingRecord`

| Field | Type | Notes |
|-------|------|-------|
| `population` | FK → ExSituPopulation | |
| `date` | DateField | |
| `count_total` | IntegerField | |
| `count_male` | IntegerField, nullable | |
| `count_female` | IntegerField, nullable | |
| `count_unsexed` | IntegerField, nullable | |
| `notes` | TextField, blank | |
| `reporter` | FK → User, nullable | |

### `fieldwork.FieldProgram`

| Field | Type | Notes |
|-------|------|-------|
| `name` | CharField(300) | e.g., "Fish Net Madagascar", "Durrell Nosivolo" |
| `description` | TextField | Public-facing summary |
| `lead_institution` | FK → Institution, nullable | |
| `region` | CharField(200), blank | e.g., "Nosivolo River catchment" |
| `start_date` | DateField, nullable | |
| `status` | CharField, enum | `active` / `completed` / `planned` |
| `focal_species` | ManyToMany → Species | |
| `partner_institutions` | ManyToMany → Institution | |
| `funding_sources` | TextField, blank | |
| `website` | URLField, blank | |

### `accounts.User`

Custom user model extending `AbstractBaseUser` + `PermissionsMixin`.

| Field | Type | Notes |
|-------|------|-------|
| `email` | EmailField, unique | Primary identifier (no username) |
| `name` | CharField(300) | |
| `access_tier` | IntegerField | 1–5; default 2 (Registered Researcher) for self-registered accounts |
| `institution` | FK → Institution, nullable | Primary affiliation |
| `expertise_areas` | TextField, blank | |
| `orcid_id` | CharField(50), blank | |
| `is_active` | BooleanField | Default False until email verified |
| `is_staff` | BooleanField | Default False; True for Django Admin access |
| `date_joined` | DateTimeField, auto | |

Tier 1 = unauthenticated access (no User record required). `access_tier=1` on an authenticated User is valid but unusual.

### `accounts.AuditLog`

| Field | Type | Notes |
|-------|------|-------|
| `user` | FK → User, nullable | Null for anonymous actions |
| `action` | CharField, enum | `create` / `update` / `delete` |
| `model_name` | CharField(100) | e.g., "Species" |
| `object_id` | CharField(50) | PK of affected record |
| `timestamp` | DateTimeField, auto | |
| `changes` | JSONField | Before/after diff |
| `ip_address` | GenericIPAddressField, nullable | |

Append-only. No update/delete signals on this model. Use a `pre_delete` signal to block deletion attempts.

### `integration.SyncJob`

| Field | Type | Notes |
|-------|------|-------|
| `job_type` | CharField, enum | `iucn_sync` (only value for MVP) |
| `status` | CharField, enum | `pending` / `running` / `completed` / `failed` |
| `started_at` | DateTimeField, nullable | |
| `completed_at` | DateTimeField, nullable | |
| `records_processed` | IntegerField, default 0 | |
| `records_updated` | IntegerField, default 0 | |
| `records_skipped` | IntegerField, default 0 | |
| `error_log` | TextField, blank | Accumulated errors |

---

## Technical Tasks

- Run `django-admin startapp` for `species`, `populations`, `fieldwork`, `accounts`, `integration`
- Add all apps to `INSTALLED_APPS` in settings
- Create custom User model before first migration (cannot be changed after)
- Configure `AUTH_USER_MODEL = 'accounts.User'`
- Enable PostGIS: `django.contrib.gis` in `INSTALLED_APPS`; `DATABASES['default']['ENGINE'] = 'django.contrib.gis.db.backends.postgis'`
- Install `django-mptt` for Taxon hierarchy; add `MPTTModel` to Taxon
- Run initial migrations; confirm PostGIS extension enabled (`SELECT PostGIS_Version();`)
- Write model-level unit tests: field nullability, enum constraints, `unique_together` on ExSituPopulation

---

## Acceptance Criteria

**Given** a new Species record with `taxonomic_status = 'undescribed_morphospecies'`
**When** `authority` and `year_described` are set to null
**Then** the record saves without error and no null constraint is violated

**Given** a new Species record with `taxonomic_status = 'described'`
**When** the record is saved with `provisional_name` set
**Then** the record saves (provisional_name is nullable and optional for described species)

**Given** a ConservationAssessment record with `review_status = 'pending_review'`
**When** `flagged_by` and `flagged_date` are null
**Then** the record saves (both fields are nullable — flagging via Django Admin may not always record user context)

**Given** an attempt to set `access_tier` outside the range 1–5 on a User record
**When** the record is saved
**Then** a validation error is raised (enforce with `validators=[MinValueValidator(1), MaxValueValidator(5)]`)

**Given** two ExSituPopulation records with the same `species` and `institution`
**When** the second is saved
**Then** a database-level unique constraint violation is raised

---

## Out of Scope

- Admin configuration (Gate 04)
- DRF endpoints or serializers (Gate 05)
- Auth enforcement / permission classes (Gate 03)
- Occurrence records, Survey, BreedingRecommendation, PrioritizationScore (post-MVP)
- PostGIS geometry fields — no spatial data in MVP models

---

## Gate Exit Criteria

Before marking Gate 02 complete:
1. All migrations apply cleanly on a fresh PostGIS database (`migrate --run-syncdb` passes)
2. All model-level unit tests pass
3. Custom User model is set before any auth migrations run
4. Invoke **@code-quality-reviewer** on all model files
