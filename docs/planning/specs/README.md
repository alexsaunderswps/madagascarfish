# Gate Specifications Index

**Project:** Madagascar Freshwater Fish Conservation Platform
**Hard Deadline:** June 1-5, 2026 — CPSG Ex-situ Conservation Assessment Workshop, ABQ BioPark
**As of:** 2026-04-12

---

## MVP Gates

| Gate | Title | Status | Summary |
|------|-------|--------|---------|
| [Gate 01](gate-01-foundation.md) | Foundation | Not started | Django project skeleton, Docker Compose stack, CI/CD pipeline, Apache-2.0 license |
| [Gate 02](gate-02-data-layer.md) | Data Layer | Not started | All core Django apps and models with migrations, including undescribed taxa and BA-approved model changes |
| [Gate 03](gate-03-auth-access-control.md) | Auth & Access Control | Not started | Five-tier access model, TierPermission DRF class, institution-scoped querysets, auth endpoints |
| [Gate 04](gate-04-django-admin.md) | Django Admin Configuration | Not started | Coordinator data entry UI — list_display, list_filter, search_fields, and inlines for all MVP models |
| [Gate 05](gate-05-drf-api.md) | DRF API | Not started | All MVP REST endpoints with tier-aware serializers — the backend contract for the Next.js frontend |
| [Gate 06](gate-06-iucn-sync-seed-data.md) | IUCN Sync & Seed Data | Not started | Celery + Redis setup, IUCN Red List API sync job, species seed management command |
| **[Gate 07](gate-07-mvp-public-frontend.md)** | **[MVP GATE] Public Frontend** | **Not started** | **Next.js species directory, species profiles, and conservation dashboard consuming the DRF API** |

All seven gates are required for the MVP demonstration at the June 2026 ECA Workshop.

---

## Gate Exit Protocol

Before marking any gate complete, invoke:
1. **@test-writer** — write adversarial tests from the gate's acceptance criteria
2. **@security-reviewer** — for any gate touching auth, permissions, data access, or API endpoints (Gates 03, 05)
3. **@code-quality-reviewer** — for all gates

Address all blocking feedback before advancing to the next gate.

---

## Post-MVP Gates

The PM will be reinvoked after the MVP is delivered to write full specs for these gates.
CARES 2.0 and prioritization tool gates are additionally blocked on external dependencies noted below.

| Gate | Title | Notes |
|------|-------|-------|
| Gate 08 | Coordinator Frontend (Next.js) | Population management, breeding events, and transfer coordination in Next.js — replaces Django Admin for Tier 3+ workflows |
| Gate 09 | Breeding Recommendations | Conservation coordinator tool for recommending breeding actions per species |
| Gate 10 | Occurrence Records + Field Survey Data Entry | Darwin Core-compliant occurrence tracking, coordinate generalization, survey data entry forms |
| Gate 11 | CARES 2.0 Integration | Blocked on CARES 2.0 (CaresSpecies.org) launch and API stabilization |
| Gate 12 | ZIMS CSV Import Pipeline | Validated CSV ingest pipeline for institutional ZIMS population snapshots |
| Gate 13 | FishBase API Sync | Weekly Celery sync for morphology, ecology, and common names from FishBase |
| Gate 14 | GBIF Darwin Core Archive Publishing | DwC-A generation, sensitive coordinate generalization, and IPT registration |
| Gate 15 | Prioritization Scoring Tool | Blocked on working group agreement on Malagasy-specific weighting criteria |
| Gate 16 | Studbook & Genetic Data Management | Tier 4 feature — pedigree records, genetic diversity data, studbook integration |
