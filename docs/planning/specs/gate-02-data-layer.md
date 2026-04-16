# Gate 02 — Data Layer

**Status:** Complete
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
| `species` | Species, Taxon, CommonName, ConservationAssessment, SpeciesLocality, Watershed, ProtectedArea |
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

### `species.SpeciesLocality`

Each record represents a single known locality for a species — sourced from type descriptions, museum collection records, published literature, field observations, or eDNA surveys. This is the primary point layer for the conservation map.

| Field | Type | Notes |
|-------|------|-------|
| `id` | AutoField | PK |
| `species` | FK → Species | `on_delete=CASCADE`; indexed |
| `locality_name` | CharField(300) | e.g., "Amboaboa River at Antsirabe confluence" |
| `location` | PointField(srid=4326) | Exact coordinates (WGS 84) |
| `location_generalized` | PointField(srid=4326), nullable | Pre-computed generalized coordinates for public display. Null if not sensitive. |
| `water_body` | CharField(200), blank | Name of river, lake, etc. |
| `water_body_type` | CharField, enum | `river` / `lake` / `stream` / `cave_system` / `wetland` / `estuary` |
| `drainage_basin` | FK → Watershed, nullable | Enables efficient "all species in this watershed" queries |
| `drainage_basin_name` | CharField(200), blank | Denormalized basin name. Auto-populated from FK on save. |
| `locality_type` | CharField, enum | `type_locality` / `collection_record` / `literature_record` / `observation` |
| `presence_status` | CharField, enum | `present` / `historically_present_extirpated` / `presence_unknown` / `reintroduced` |
| `source_citation` | TextField | Required. Provenance is non-negotiable for biodiversity data. |
| `year_collected` | IntegerField, nullable | Year of the record, not the publication year. |
| `collector` | CharField(200), blank | Collector or observer name(s). |
| `coordinate_precision` | CharField, enum | `exact` / `approximate` / `locality_centroid` / `water_body_centroid` |
| `is_sensitive` | BooleanField, default False | If True, `location_generalized` is served to Tier 1-2 users instead of `location`. |
| `notes` | TextField, blank | |
| `created_at` | DateTimeField, auto_now_add | |
| `updated_at` | DateTimeField, auto_now | |

**Constraints:**
- `unique_together = (species, location, locality_type)`
- `save()` override: if `is_sensitive` and `location` is not null, compute `location_generalized` as `Point(round(lng, 1), round(lat, 1))`. If not sensitive, set `location_generalized = None`.
- `save()` override: if `drainage_basin` FK is set and `drainage_basin_name` is empty, populate from `drainage_basin.name`.

### `species.Watershed`

Reference layer storing HydroSHEDS HydroBASINS polygons for Madagascar. Used as FK target for SpeciesLocality.drainage_basin and as the source for the watershed map overlay.

| Field | Type | Notes |
|-------|------|-------|
| `id` | AutoField | PK |
| `hybas_id` | BigIntegerField, unique | HydroBASINS feature ID |
| `name` | CharField(200) | Basin name; fallback "Unnamed basin [hybas_id]" for unnamed features |
| `pfafstetter_level` | IntegerField | Pfafstetter coding level (MVP loads level 6 only) |
| `pfafstetter_code` | BigIntegerField | Pfafstetter basin code |
| `parent_basin` | FK → self, nullable | For hierarchical basin navigation |
| `area_sq_km` | DecimalField(12,2), nullable | Basin area from HydroBASINS attributes |
| `geometry` | MultiPolygonField(srid=4326) | Basin boundary polygon |
| `created_at` | DateTimeField, auto_now_add | |

### `species.ProtectedArea`

Reference layer storing WDPA protected area polygons for Madagascar. Used for the protected areas map overlay.

| Field | Type | Notes |
|-------|------|-------|
| `id` | AutoField | PK |
| `wdpa_id` | IntegerField, unique | WDPA feature ID |
| `name` | CharField(300) | Protected area name |
| `designation` | CharField(200) | e.g., "National Park", "Special Reserve" |
| `iucn_category` | CharField(20), blank | IUCN PA category (Ia, Ib, II, III, IV, V, VI) |
| `status` | CharField(100) | e.g., "Designated", "Proposed" |
| `status_year` | IntegerField, nullable | Year of designation |
| `area_km2` | DecimalField(12,2), nullable | Reported area |
| `geometry` | MultiPolygonField(srid=4326) | PA boundary |
| `created_at` | DateTimeField, auto_now_add | |

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

**Given** a SpeciesLocality record with valid coordinates (-18.91, 47.52)
**When** the record is saved
**Then** the PointField stores the coordinates correctly; querying with `ST_Contains` against a polygon that includes those coordinates returns the record

**Given** two SpeciesLocality records with the same `species`, `location`, and `locality_type`
**When** the second is saved
**Then** a database-level unique constraint violation is raised

**Given** a SpeciesLocality record with `is_sensitive = True` and `location = Point(47.5234, -18.9156)`
**When** the record is saved
**Then** `location_generalized` is auto-computed as `Point(47.5, -18.9)` (rounded to 0.1 degree)

**Given** a SpeciesLocality record with `is_sensitive = False`
**When** the record is saved
**Then** `location_generalized` is null

**Given** a Watershed record with a valid MultiPolygon geometry
**When** the record is saved with `hybas_id = 1060000010`
**Then** the record saves without error; a second record with the same `hybas_id` raises a unique constraint violation

**Given** a ProtectedArea record with `wdpa_id = 303847`
**When** the record is saved
**Then** the record saves without error; a second record with the same `wdpa_id` raises a unique constraint violation

---

## Out of Scope

- Admin configuration (Gate 04)
- DRF endpoints or serializers (Gate 05)
- Auth enforcement / permission classes (Gate 03)
- Occurrence records, Survey, BreedingRecommendation, PrioritizationScore (post-MVP)

---

## Gate Exit Criteria

Before marking Gate 02 complete:
1. All migrations apply cleanly on a fresh PostGIS database (`migrate --run-syncdb` passes)
2. All model-level unit tests pass
3. Custom User model is set before any auth migrations run
4. SpeciesLocality, Watershed, and ProtectedArea migrations apply cleanly; spatial field tests pass (PointField and MultiPolygonField accept valid geometries)
5. Unique constraints enforced on `hybas_id`, `wdpa_id`, and `(species, location, locality_type)`
6. `save()` override on SpeciesLocality correctly computes `location_generalized` for sensitive records and populates `drainage_basin_name` from FK
7. Invoke **@code-quality-reviewer** on all model files

---

## Reconciliation

Gate 02 implementation was reconciled on 2026-04-16. Full reconciliation report:
[gate-02-reconciliation.md](gate-02-reconciliation.md)

Key deviations from spec (all justified, none blocking):
- SpeciesLocality unique constraint uses deterministic `location_key` CharField instead of raw geometry equality
- CheckConstraint uses `condition=` (Django 5.1+ forward-compatible) instead of deprecated `check=`
- Circular accounts/populations migration dependency resolved via split 0001/0002 migration
- `drainage_basin_name` always syncs from FK on save (not conditional on empty)
- SyncJob.error_log implemented as JSONField instead of TextField
- FieldProgram.end_date added (not in original spec)
