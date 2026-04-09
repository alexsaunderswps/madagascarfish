# Madagascar Freshwater Fish Conservation Platform

## Project Overview

Centralized, open-source platform for Madagascar's ~79 endemic freshwater fish species —
the island's most imperiled vertebrate group. Combines public species profiles, restricted
ex-situ breeding coordination, field program tracking, and cross-sector networking between
zoos, researchers, and hobbyist breeders.

Designed to complement (not replace) existing systems: ZIMS, IUCN Red List, FishBase, GBIF.
Fills the documented gap where no platform integrates species-level data with conservation
breeding coordination.

## Technical Stack

- Backend: Python, Django, PostgreSQL-PostGIS
- Data standard: Darwin Core with custom extensions for breeding coordination
- API: RESTful, decoupled from frontend
- Frontend: Modern JavaScript framework (TBD by Architecture Agent)
- GIS: PostGIS for spatial data, coordinate generalization for sensitive locations
- Auth: Five-tier access model (public → researcher → coordinator → program manager → admin)

## Key Entities

- **Species** — ~79 endemic freshwater fish. IUCN status, taxonomy, distribution, population trend.
  Families: Bedotiidae, Cichlidae, Aplocheilidae, Anchariidae, plus endemic gobies, cave fish, others.
- **Ex-situ Population** — captive populations across zoos, aquariums, and private breeders.
  Links to ZIMS for institutional records. Tracks genetics, demographics, breeding recommendations.
- **Field Program** — in-situ conservation projects. Surveys, habitat restoration, community management.
  Links to occurrence data publishable to GBIF.
- **Institution** — zoos, aquariums, research organizations, hobbyist breeding programs (CARES,
  Citizen Conservation). Has tier-based access.
- **User** — five access tiers determining what data is visible and editable.
- **Occurrence Record** — Darwin Core–compliant species observation. Sensitive location data
  restricted by tier using GBIF coordinate generalization protocols.

## Access Tiers

| Tier | Role | Access |
|------|------|--------|
| 1 | Public (anonymous) | Species profiles, conservation status, general distribution |
| 2 | Registered Researcher | Occurrence data, published datasets, field program summaries |
| 3 | Conservation Coordinator | Sensitive locations, breeding recommendations, transfer coordination |
| 4 | Program Manager | Population genetics, studbook-level data, institutional inventory |
| 5 | Administrator | Full system access, user management, data import/export |

## External Integrations

- IUCN Red List API — species assessments (read, don't duplicate)
- FishBase — ecological data (read)
- GBIF — publish occurrence data via Darwin Core Archives + IPT
- ZIMS/Species360 — captive population snapshots (via institutional data-sharing)
- CARES priority lists — species conservation priority status
- SHOAL 1,000 Fishes Blueprint — global priority alignment

## Sensitive Data Rules

- Wildlife location coordinates for threatened species must use coordinate generalization
  (GBIF sensitive species best practices) — exact coordinates only at Tier 3+
- Breeding recommendations and genetic data restricted to Tier 4+
- No PII in public-facing layers
- Captive population counts aggregated for public display, per-institution detail at Tier 3+

## Development Commands

[To be filled after scaffolding — include: run server, run tests, migrate, lint, seed data]

## Conventions

[To be filled by Architecture Agent — coding standards, patterns, naming conventions]

## Planning Documents

Planning artifacts live in `docs/planning/`:
- `architecture/` — Architecture Agent proposals
- `business-analysis/` — BA Agent assessments
- `specs/` — PM Agent gate specs with acceptance criteria

Ideation documents live in `docs/ideation/`:
- `extinction-crisis-report.md` — domain context and species data
- `data-infrastructure-gap.md` — gap analysis and platform rationale

## Agent Delegation

This project uses specialized agents in `.claude/agents/`. Delegate as follows:

### Planning (before writing code)
- **@architecture** — when starting a new project or major feature, or when a technical
  design decision needs to be made before requirements can be finalized
- **@business-analyst** — when evaluating whether a feature belongs, analyzing requirements,
  or writing acceptance criteria. The BA evaluates WHAT to build.
- **@product-manager** — when breaking approved requirements into stories, defining gates
  and milestones, or sequencing work. The PM plans HOW to build it.
- **@ux-reviewer** — when validating that a proposed feature or flow is usable, or when
  reviewing interaction design

### Verification (after writing code, at gate checkpoints)
- **@test-writer** — to write adversarial tests from PM specs at each gate. The test
  writer works from acceptance criteria, not from the implementation.
- **@security-reviewer** — to review code for vulnerabilities. Always invoke for changes
  touching auth, permissions, data access, or API endpoints.
- **@code-quality-reviewer** — to review code for maintainability, pattern adherence,
  and readability.

### Workflow
The standard flow is: Architecture → BA → PM → [you implement with unit tests] →
Test Writer + Reviewers → address feedback or escalate to planning.

Human gates exist between planning layers. At designated gates during implementation,
pause and invoke the verification agents before proceeding.

Planning documents live in `docs/planning/`:
- `architecture/` — Architecture Agent output
- `business-analysis/` — BA Agent output
- `specs/` — PM Agent output (gate specs with acceptance criteria)