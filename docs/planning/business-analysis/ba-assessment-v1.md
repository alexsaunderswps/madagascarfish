# BA Assessment v1: Madagascar Freshwater Fish Conservation Platform

**Date:** 2026-04-12 (rev 2)
**Status:** Draft -- Awaiting Human Review
**Analyst:** Business Analyst Agent
**Input Documents:** Architecture Proposal (2026-04-09), Extinction Crisis Report, Data Infrastructure Gap Analysis, January 2026 Workshop Notes, ECA Workshop Invitation (Feb 2026), SHOAL 1,000 Fishes Blueprint (2024), Leiss et al. (2022) -- Zoo Biology 41:244-262, CARES program materials
**Context:** Five issues raised during human review of the architecture proposal require BA evaluation before the PM can write tickets.
**Rev 2 Note:** Updated after reading full reference documents. Leiss et al. 2022 confirms all baseline figures used in rev 1 -- no data model changes. ECA Workshop invitation and SHOAL 1,000 Fishes Blueprint produce material updates to Sections 1, 2, 4, and 5 (SHOAL landscape characterization corrected; ECA/SHOAL strategic relationship clarified; Q5/Q6 updated; prioritization criteria note revised).

---

## 1. Strategic Fit

### Does this platform belong in the landscape?

**Yes, with a narrower differentiation claim than the architecture proposal implies.** The competitive landscape has shifted since the gap analysis was written, and the platform's positioning must be precise to avoid building something that gets outflanked.

**What exists now (April 2026):**

| System | What It Does Well | What It Cannot Do for This Community |
|--------|-------------------|--------------------------------------|
| **ZIMS / Species360** | Gold-standard captive animal records at 1,300+ institutions | Proprietary, excludes hobbyists, no species-level coordination layer, no public profiles, no field program linkage |
| **CARES 2.0 (CaresSpecies.org)** | Moving from static WordPress to structured database with new classification system (CCR/CEN/CVU/CLC) | Not yet launched; hobbyist-focused; no ex-situ population tracking, no field program data, no institutional coordination |
| **Citizen Conservation "Wild at Home"** | Structured hobbyist breeding programs with inventory tracking | Still in password-protected beta; broader than Madagascar; no public species profiles, no field data integration |
| **SHOAL Initiative** | Global strategic framework for 1,000 Priority Freshwater Fishes; co-organized the June 2026 ECA Workshop; launched the Zoo and Aquaria Alliance for Freshwater Species Conservation (2024) | Not a database platform -- SHOAL's data foundation is the IUCN Red List, not a separate species database. No competing species profiles or coordination tools. Madagascar is a SHOAL Priority Country (Northwestern Madagascar = Priority Area #23). |
| **IUCN Red List** | Authoritative conservation assessments | Static assessments, many outdated for Malagasy species, no coordination tools |
| **FishBase** | Broad ecological data | Global generalist; thin Malagasy endemic coverage; no conservation coordination |
| **GBIF** | Occurrence data at massive scale | Publish-only for this community; no species profiles, no coordination |

**The genuine gap this platform fills:** No existing or in-development system integrates (a) Madagascar-specific species profiles with (b) cross-sector ex-situ population tracking (zoos + hobbyists) and (c) field program monitoring in a single platform with tiered access. This is a regional coordination hub, not a global biodiversity platform.

**Strategic risks the architecture proposal underweights:**

1. **CARES 2.0 timing risk.** The architecture proposal describes CARES as a static WordPress site. CARES 2.0 (CaresSpecies.org) is actively under development with a structured database and a new classification system. If CARES 2.0 launches before this platform's MVP and includes species profiles or hobbyist inventory features, the platform's value proposition to the hobbyist community weakens. The project lead's role as incoming CARES Coordinator for Malagasy species mitigates this -- but only if the platform is positioned as complementary to CARES, not as a replacement for CARES species data.

2. **ECA Workshop alignment opportunity.** The June 2026 CPSG Ex-situ Conservation Assessment Workshop (ABQ BioPark, June 1-5) will assess ~360 globally imperiled freshwater fishes, including Malagasy species. SHOAL is a co-organizer and co-funder of this workshop (alongside New Mexico BioPark Society, Re:wild, CPSG, and the IUCN SSC Freshwater Fish Specialist Group), meaning workshop outputs will feed directly into SHOAL's Priority Species network. This is the single most important near-term event for the platform's target community. If the MVP can demonstrate species profiles and basic ex-situ tracking before or at that workshop, it becomes the natural regional data partner for SHOAL's workshop outcomes. If it cannot, workshop outputs will flow into other channels and the platform loses first-mover positioning.

3. **The January 2026 workshop explicitly asked "who will implement it and how?"** The community wants a centralized database but has not committed to this specific platform. Demonstrating value fast is not optional -- it is the adoption strategy.

**Recommendation:** The platform's unique value proposition is: *"The single place where you can see every Malagasy freshwater fish species, who holds them in captivity, what field programs are active, and what conservation actions are recommended -- across zoos, hobbyists, and researchers."* Every MVP decision should be evaluated against whether it advances this claim.

---

## 2. MVP Scope Recommendation

### Constraint Framing

- ~50-100 active users globally
- Must show visible value quickly to drive adoption
- June 2026 ECA Workshop is the key demonstration opportunity (less than 2 months away)
- Single developer (project lead) with agent-assisted development
- $5-40/month hosting budget

### MVP: What to Build

| Capability | MVP? | Rationale |
|------------|------|-----------|
| **Species Directory + Profiles** (public) | **YES -- core** | This is the "front door" that demonstrates value to every stakeholder. Seed with Leiss et al. 2022 data (173 species). Must include IUCN status, family, endemic status, common names, ecology notes, images where available. |
| **Conservation Dashboard** (public) | **YES -- core** | High-level metrics (species by threat status, ex-situ coverage gap chart) that tell the story at a glance. The "31 of 50 threatened species have no captive population" statistic should be visually prominent. |
| **Ex-Situ Population Tracking** (Tier 3+) | **YES -- core** | Per-institution captive populations with census counts. This is the coordination feature no other system provides for this community. Seed with Leiss et al. 2022 ZIMS + Zootierliste baseline data. |
| **Institution Directory** (public names; detail at Tier 3+) | **YES -- core** | List of zoos, aquariums, hobbyist programs involved. Required by ExSituPopulation. |
| **Five-Tier Auth + Django Admin** | **YES -- core** | Auth model is cross-cutting. Django Admin provides immediate data entry capability without custom frontend for coordinators. |
| **Field Program Summaries** (public) | **YES -- lightweight** | Static-ish pages for Fish Net Madagascar, Durrell Nosivolo, Lake Tseny. No survey data entry in MVP -- just program descriptions, status, focal species links. |
| **IUCN Red List API Sync** | **YES -- lightweight** | Automated pull of assessment data for species that have IUCN taxon IDs. Essential for keeping status current without manual entry. |
| **FishBase API Sync** | **DEFER** | Coverage is thin for Malagasy endemics per the gap analysis. Manual data entry via Django Admin is faster and more accurate for MVP. |
| **GBIF Publishing** | **DEFER** | Darwin Core Archive generation and IPT registration is complex. No occurrence records to publish until field data is entered. |
| **Occurrence Records + Survey Data** | **DEFER** | Requires review workflow, coordinate generalization at serializer level, Darwin Core compliance. Not needed for the core "species + populations + programs" value proposition. |
| **Breeding Recommendations** | **DEFER** | Depends on having population data in the system first. Add after MVP when coordinators are actively using population tracking. |
| **Prioritization Tool** | **DEFER** | SHOAL's global Priority Fishes criteria are now published (all IUCN EW/CR/EN/VU species meeting criterion D1 or D2 -- 2,338 species globally). Three Malagasy *Typhleotris* cave fish rank #2, #4, #6 in SHOAL's EDGE ranking. However, Malagasy-specific weighting criteria (CARES status, ex-situ gap, local endemism) remain under discussion per the January 2026 workshop. The SHOAL criteria can be stored as a field (shoal_priority boolean) without building the scoring tool. Defer the composite scoring UI until Malagasy criteria are defined. |
| **Studbook Management / Genetic Data** | **DEFER** | Tier 4 feature. Small user base. Complex domain. No studbooks exist for most species yet. |
| **Data Import Pipeline** (ZIMS CSV, Zootierliste) | **DEFER as automated feature** | For MVP, seed data manually via Django Admin or management commands. Build formal import pipeline post-MVP when ongoing data updates justify the investment. |
| **CARES Integration** | **DEFER** | See Issue 1 analysis below. CARES 2.0 is not yet live; building against the old WordPress site is wasted work. |
| **Zootierliste Scraping** | **DEFER** | Semi-annual manual process. Django Admin data entry is sufficient for MVP. |
| **Coordinate Generalization** | **DEFER with foundation** | No occurrence records in MVP, but the Species model should include a `sensitive_location` flag and the architectural pattern for tier-based serialization should be established even if not yet exercised. |

### MVP Definition

**MVP delivers:** A public-facing species directory with conservation status, a conservation dashboard showing the ex-situ gap, institution-scoped population tracking via Django Admin for coordinators, and IUCN API sync for assessment data. This is demonstrable at the June 2026 ECA Workshop and provides immediate value to the January 2026 workshop attendees who asked for "a centralized database for species/research data."

**MVP does NOT deliver:** Occurrence records, GBIF publishing, breeding recommendations, prioritization scoring, automated data imports, CARES/FishBase/Zootierliste integration, or the full Next.js frontend for coordinator workflows.

---

## 3. Data Model Refinements

### Issue 1: CARES 2.0 Changes the Integration Picture

**Analysis:**

The architecture proposal describes CARES integration as "Manual import (HTML scrape or CSV)" from "Static HTML lists on WordPress; no API." This is already outdated. CARES is building CARES 2.0 at CaresSpecies.org with a structured database. The beta dataset uses a classification system (CCR/CEN/CVU/CLC) that is distinct from IUCN categories:

- **CCR** -- CARES Critically at Risk (roughly analogous to IUCN CR/EW)
- **CEN** -- CARES Endangered (roughly analogous to IUCN EN)
- **CVU** -- CARES Vulnerable (roughly analogous to IUCN VU)
- **CLC** -- CARES Lower Concern (roughly analogous to IUCN NT/LC but still conservation-relevant)

These are not 1:1 mappings to IUCN categories. CARES classifications reflect hobbyist-community assessment of aquarium-trade availability and breeding urgency, not formal extinction risk assessment. A species can be IUCN LC but CARES CEN if its aquarium population is declining.

**Recommendations:**

1. **Do not build CARES integration for MVP.** CARES 2.0 has no announced launch date. Building against the old WordPress site is throwaway work. Building against CARES 2.0 before it stabilizes creates coupling to an unstable target.

2. **The CARES classification system warrants a dedicated structure, not a boolean.** The current model has `cares_listed (boolean)` on Species and `cares_listed (boolean)` on PrioritizationScore. This is insufficient. When CARES integration is built, the model needs:
   - A `CARESClassification` entity (or extend `ConservationAssessment` with a `source` enum that includes `cares`) storing: species FK, cares_category (CCR/CEN/CVU/CLC), cares_region, date_listed, notes.
   - The boolean `cares_listed` on Species can remain as a denormalized convenience flag.

3. **For MVP, store CARES status as a simple enum field on Species** (`cares_status`: null/CCR/CEN/CVU/CLC) alongside the existing `cares_listed` boolean. This is manually entered via Django Admin and requires no integration code. Migrate to the full `CARESClassification` model when CARES 2.0 is live and the integration is built.

4. **The project lead's CARES Coordinator role (Issue 3) creates an opportunity**: influence CARES 2.0's export format to include machine-readable species identifiers (GBIF taxon keys or IUCN taxon IDs) that enable reliable cross-referencing. This should be pursued as a stakeholder conversation, not a platform feature.

**Acceptance Criteria (post-MVP, when CARES integration is built):**

**Given** a Species record for *Ptychochromis insolitus* with iucn_status = "CR"
**When** the CARES sync job runs and the species is listed as CCR in CARES 2.0
**Then** the Species record has cares_status = "CCR" and cares_listed = True and the CARESClassification record stores the full classification detail including date_listed and cares_region

**Given** a Species record that exists in this platform but not in CARES 2.0
**When** the CARES sync job runs
**Then** the Species.cares_status remains null and cares_listed remains False and no CARESClassification record is created or modified

**Given** a CARES 2.0 entry for a species not yet in this platform (e.g., an undescribed morphospecies)
**When** the CARES sync job runs
**Then** the sync job logs the unmatched entry for manual review rather than auto-creating a Species record

### Issue 2: The Species Model Does Not Handle Undescribed Taxa

**Analysis:**

This is a critical gap. The extinction crisis report documents "at least 15-20 undescribed species identified through genetic and morphological work but awaiting formal description." The CARES beta data includes numerous morphospecies: *Bedotia* sp. 'manombo', *Paratilapia* sp. 'southwest', *Pachypanchax* sp. 'Sofia', *Rheocles* sp. 'Ambodivato', etc. The September 2024 eDNA paper (Oliveira Carvalho et al.) identified likely undescribed species. The Leiss et al. 2022 paper itself notes taxonomic uncertainty in captive holdings.

These are not marginal edge cases. They are species currently held in captive breeding programs, targeted by field programs, and listed on CARES priority lists. A platform that cannot represent them fails a core use case.

**The current Species model assumes formal description:**
- `scientific_name` -- expects binomial nomenclature
- `authority` -- expects a formal taxonomic authority
- `year_described` -- expects a description year
- `iucn_taxon_id`, `fishbase_id`, `gbif_taxon_key` -- all assume formal taxonomic recognition

Undescribed morphospecies have none of these. They have informal designations like "Bedotia sp. 'manombo'" that follow an informal convention (Genus sp. 'locality/descriptor') but are not governed by nomenclatural codes.

**Recommendation: Supporting undescribed taxa is in scope for MVP.** The rationale:

1. The platform's species directory is seeded from Leiss et al. 2022, which includes species with uncertain taxonomy. Omitting undescribed taxa from the directory means omitting species that are actively held in captivity and actively targeted by CARES -- exactly the species the coordination community needs to track.

2. The representation is lightweight. It does not require a separate entity or complex taxonomic resolution system.

**Minimum viable representation:**

Add the following to the Species model:

| Field | Type | Purpose |
|-------|------|---------|
| `taxonomic_status` | Enum: `described`, `undescribed_morphospecies`, `species_complex`, `uncertain` | Distinguishes formal from informal taxa |
| `provisional_name` | CharField, nullable | Informal designation (e.g., "sp. 'manombo'"). Stored separately from `scientific_name` to avoid polluting taxonomic searches. |
| `authority` | CharField, **nullable** (currently assumed non-null) | Null for undescribed taxa |
| `year_described` | IntegerField, **nullable** (currently assumed non-null) | Null for undescribed taxa |

The `scientific_name` field stores the full designation including the informal part for undescribed taxa (e.g., "Bedotia sp. 'manombo'") so that it remains the primary display and search field. The `provisional_name` field stores just the informal epithet ('manombo') for cases where the genus-level assignment may change.

**Downstream effects on integrations:**

| Integration | Impact | Handling |
|-------------|--------|----------|
| **IUCN API Sync** | IUCN has assessed some undescribed taxa (e.g., unnamed *Bedotia* lineages appear in the Red List). Matching by name is unreliable. | Match by `iucn_taxon_id` where available. For undescribed taxa without IUCN IDs, skip automatic sync; flag for manual review. |
| **FishBase Sync** | FishBase generally does not include undescribed taxa. | No impact. `fishbase_id` remains null for undescribed taxa. |
| **GBIF Publishing** | Darwin Core supports `identificationQualifier` = "sp." and `identificationRemarks` for informal identifications. Undescribed taxa are publishable as occurrence records with appropriate qualifiers. | When building GBIF publishing (post-MVP), set `identificationQualifier` = "sp." and populate `identificationRemarks` with the provisional name for undescribed taxa. |
| **CARES Sync** | CARES beta data heavily features undescribed taxa. Name-matching will be the primary challenge. | Cross-reference by genus + provisional_name. Flag ambiguous matches for manual resolution. |
| **Species Directory (public)** | Undescribed taxa should be visually distinguished from described species. | Display a badge or label indicating "Undescribed -- provisional name" on species profiles. |

**Acceptance Criteria:**

**Given** a Tier 5 administrator creating a new Species record via Django Admin
**When** they set taxonomic_status = "undescribed_morphospecies"
**Then** the authority and year_described fields accept null values and the provisional_name field becomes available and the scientific_name field accepts non-binomial formats (e.g., "Bedotia sp. 'manombo'")

**Given** a public user browsing the Species Directory
**When** they view a species with taxonomic_status = "undescribed_morphospecies"
**Then** the species profile displays a clear visual indicator (e.g., "Undescribed taxon -- provisional name used in conservation literature") and the authority/year_described fields are not shown

**Given** the IUCN API sync job running
**When** it encounters a Species record with taxonomic_status = "undescribed_morphospecies" and iucn_taxon_id = null
**Then** it skips that species (no API call attempted) and does not log an error

**Given** a Species record with taxonomic_status = "undescribed_morphospecies"
**When** a user filters the Species Directory by IUCN status
**Then** undescribed taxa without IUCN assessments appear under a "Not Evaluated" or "Not Assessed" filter option rather than being excluded from results

### Issue 3: Platform Owner's Direct Stakeholder Role in CARES

**Analysis:**

Aleksei Saunders has been invited to serve as CARES Coordinator for Malagasy cichlids and rainbowfish, succeeding Paul Loiselle. This is significant for three reasons:

**Scope creep risk: MODERATE.** The risk is real but manageable. As CARES Coordinator, Aleksei will need tools for maintaining species priority lists, tracking hobbyist registrations, and coordinating with regional breeders. There will be natural pressure to build these CARES-specific coordination workflows into the platform. However, this platform's value proposition is broader than CARES -- it serves zoos, researchers, and field programs that CARES does not touch. The mitigation is clear: CARES coordination workflows are out of scope. The platform provides species data and ex-situ tracking that CARES coordinators can *use*, but the platform is not a CARES coordination tool.

**Conflict-of-interest risk: LOW but worth documenting.** As both platform owner and CARES Coordinator, Aleksei controls how CARES data is presented relative to IUCN or other classification sources. The practical risk is minimal -- CARES and IUCN serve different purposes and are not in competition -- but the principle matters for stakeholder trust. The mitigation is architectural: always display the source of any classification alongside the classification itself. Never present a CARES classification as equivalent to an IUCN assessment without explicit labeling.

**Opportunity: HIGH.** Direct influence over CARES 2.0's data architecture could enable:
- Machine-readable species identifiers (GBIF taxon keys) in CARES 2.0 exports
- Structured data formats that align with this platform's import needs
- A CARES 2.0 API endpoint specifically for Malagasy species
- Alignment of CARES 2.0's handling of undescribed taxa with this platform's `taxonomic_status` model

**Recommendation:** Pursue the CARES Coordinator role. Document the following governance principle in the platform's About page or contribution guidelines: *"Conservation classification data is always attributed to its source (IUCN, CARES, recommended revision by [author]). The platform does not adjudicate between classification systems but presents them side by side."* This is consistent with the ConservationAssessment model's existing `source` field.

No data model changes required for this issue. The existing `source` enum on ConservationAssessment should be extended to include `cares_official` alongside `iucn_official` and `recommended_revision` when CARES integration is built.

### Issue 4: CARES Beta Data Embeds a Coordinator Review Queue

**Analysis:**

The CARES beta data uses '***' annotations in a Notes field to flag provisional classifications pending coordinator review. This is effectively a workflow state embedded in unstructured text. The current platform data model has no concept of "classification pending review" -- ConservationAssessment records are either `iucn_official` or `recommended_revision`, with no lifecycle state.

The broader question is whether the platform needs a general-purpose review/moderation queue for data quality. Three data types could benefit:

1. **Conservation classifications** (CARES or IUCN recommended revisions) -- "This species may need reclassification"
2. **Species records** (undescribed taxa) -- "This morphospecies may be synonymized with a described species"
3. **Occurrence records** (Tier 2 submissions) -- Already planned: Tier 2 users submit occurrences "pending review"

**Recommendation: A lightweight review flag belongs in MVP. A full review queue does not.**

For MVP, add a `review_status` field to ConservationAssessment:

| Field | Type | Values |
|-------|------|--------|
| `review_status` | Enum | `accepted`, `pending_review`, `under_revision`, `superseded` |
| `review_notes` | TextField, nullable | Free-text notes explaining what needs review |
| `flagged_by` | FK User, nullable | Who flagged this for review |
| `flagged_date` | DateTimeField, nullable | When it was flagged |

This is not a full workflow engine. It is a status field that lets coordinators mark assessments as needing attention and filter on that status. The Django Admin provides sufficient UI for MVP.

**Access tier mapping:**

| Action | Minimum Tier |
|--------|-------------|
| View review_status on assessments | Tier 3 (Conservation Coordinator) |
| Flag an assessment for review | Tier 3 (Conservation Coordinator) |
| Resolve a review flag (set to accepted/superseded) | Tier 3 (Conservation Coordinator) |
| Create a new ConservationAssessment with source = recommended_revision | Tier 3 (Conservation Coordinator) |

Tier 1-2 users see the current accepted assessment only. They do not see pending reviews or revision history.

**Acceptance Criteria:**

**Given** a Tier 3 user viewing a Species profile for *Pachypanchax sakaramyi*
**When** the species has a ConservationAssessment with source = "iucn_official", category = "EN", and review_status = "pending_review" with review_notes = "Ziegler et al. 2020 recommend upgrade to CR"
**Then** the coordinator sees both the current IUCN assessment (EN) and the pending review flag with notes and has the option to create a new ConservationAssessment with source = "recommended_revision" and category = "CR"

**Given** a Tier 1 public user viewing the same Species profile
**When** the species has a pending review flag
**Then** the user sees only the current accepted IUCN assessment (EN) with no indication of the pending review

**Given** a Tier 3 user filtering ConservationAssessments in Django Admin
**When** they filter by review_status = "pending_review"
**Then** they see all assessments flagged for review across all species, enabling a coordinator review queue without dedicated queue UI

### Issue 5: Species Count Needs Revision

**Analysis:**

The "~79 endemic freshwater fish species" figure comes from Leiss et al. 2022, which documented 79 described endemics out of 173 total species in Malagasy freshwaters. This is a count of formally described endemic species as of ~2020. It excludes:

- Undescribed morphospecies (at least 15-20 per the extinction crisis report)
- Species described since 2020 (e.g., *Malagodon honahona*, described 2024)
- Cryptic species within known complexes (e.g., *Paratilapia polleni* is likely 3-5 species)

The CARES beta data alone lists 22 Bedotiidae and 33 Cichlidae entries for Madagascar, many of which are undescribed morphospecies. The real count of biologically distinct endemic freshwater fish lineages in Madagascar is probably 100-120+.

**Impact:** This affects how the platform represents itself to stakeholders and funders. "~79 species" underestimates the scope and urgency. But inflating the number without rigor undermines credibility with the scientific community.

**Recommendation:** Use layered language:

- **In technical/scientific contexts:** *"79 described endemic freshwater fish species (Leiss et al. 2022), with an additional 15-20+ undescribed taxa recognized in conservation programs"*
- **In public-facing messaging:** *"Nearly 100 endemic freshwater fish species, including many not yet formally described by science"*
- **In the Species Directory itself:** Display a count of all species records in the database regardless of `taxonomic_status`, with a breakdown: "X described species, Y undescribed taxa under conservation management"

**The Species Directory filter should include taxonomic_status as a filter option** so users can view described species only, undescribed only, or all.

**Acceptance Criteria:**

**Given** a public user visiting the Species Directory
**When** the directory contains 79 species with taxonomic_status = "described" and 18 with taxonomic_status = "undescribed_morphospecies"
**Then** the page header displays "97 Endemic Freshwater Fish Species" with a subtitle or breakdown showing "(79 described, 18 undescribed taxa)" and the directory defaults to showing all species

**Given** a public user applying the taxonomic_status filter
**When** they select "Described species only"
**Then** only the 79 described species are shown and the count updates to "79 Described Endemic Species"

---

## 4. Integration Strategy

### MVP Integrations

| Integration | MVP Status | Recommendation |
|-------------|-----------|----------------|
| **IUCN Red List API** | **Build for MVP** | Weekly Celery sync for the ~79 species with IUCN taxon IDs. Cache responses. Store as ConservationAssessment records with source = "iucn_official". Skip undescribed taxa without IUCN IDs. This is the single most valuable automated integration -- it keeps conservation status current without manual effort. |
| **Django Admin data entry** | **Build for MVP** | This IS the primary "integration" for MVP. Species data seeded from Leiss et al. 2022 via management command. Ongoing population data entered by coordinators via Django Admin. |

### Post-MVP Integrations (ordered by priority)

| Integration | Priority | Rationale |
|-------------|----------|-----------|
| **CARES 2.0 (CaresSpecies.org)** | **High, but blocked** | Build only after CARES 2.0 is live and stable. The project lead's Coordinator role provides direct access to influence export formats. When built, sync CARES classifications into CARESClassification records (or extended ConservationAssessment). |
| **ZIMS CSV Import** | **High** | Institutional data-sharing agreements take time to establish. Build a validated CSV import pipeline that can ingest ZIMS snapshots. Not MVP because the initial dataset can be seeded manually. |
| **FishBase API** | **Medium** | Coverage is thin. Manual entry via Django Admin is more accurate for the ~100 species in scope. Build when the species count grows or when the ecology/morphology sections of species profiles need enrichment. |
| **GBIF Publishing** | **Medium** | Requires occurrence records in the system first. Build when the fieldwork app is active and there are records to publish. |
| **Zootierliste** | **Low** | Semi-annual manual process. Small number of records. Django Admin suffices. |
| **Wild at Home (Citizen Conservation)** | **Watch only** | Still in beta. No API. Monitor for launch and API availability. |
| **SHOAL (data partnership)** | **Engage now; technical integration post-MVP** | SHOAL is not building a competing database -- it uses the IUCN Red List as its data foundation. The relationship is partnership, not integration. Near-term action: contact Georgie Bull to understand how SHOAL would use Malagasy species data from this platform, and whether the ECA Workshop outputs should flow into both systems. The Zoo and Aquaria Alliance (launched 2024) is a direct audience for the ex-situ coordination features. |

### Integration Architecture Note

The architecture proposal's `integration` Django app with SyncJob, ExternalReference, and ImportBatch models is sound and should be retained. For MVP, only the IUCN sync job needs to be implemented. The abstraction should be built to support future sync jobs without rearchitecting.

---

## 5. Open Questions for Human Resolution

**Resolution status:** Q5 resolved 2026-04-12.

### Blocking for MVP

These decisions must be made before the PM can write tickets for the first implementation gate.

**Q1: What is the initial species dataset, and who curates it?**
The architecture proposal recommends seeding from Leiss et al. 2022 (173 species). The January 2026 workshop asked "who will implement it and how?" For MVP, the project lead must manually prepare a seed dataset (CSV or fixtures) covering at minimum: scientific_name, authority, year_described, family, genus, endemic_status, iucn_status, taxonomic_status, and cares_status for all species to be included. This is a data preparation task, not a development task. **Decision needed: Will the MVP seed dataset include only the ~79 described endemics, or also the ~15-20 undescribed morphospecies from CARES beta / recent literature?** This BA recommends including undescribed taxa (see Issue 2), but the scope is the project lead's call.

**Q2: Does the MVP frontend use Next.js or Django templates?**
The architecture proposal specifies Next.js 14 for the frontend. For an MVP targeting the June 2026 ECA Workshop (~7 weeks away), building a full decoupled Next.js frontend may not be achievable alongside the Django backend, data model, auth system, IUCN sync, and data seeding. An alternative MVP path: use Django templates (with Tailwind or similar) for the public species directory and conservation dashboard, plus Django Admin for coordinator data entry. The DRF API is still built and the Next.js frontend replaces the Django templates post-MVP. **Decision needed: Django templates for MVP speed, or Next.js from the start?** This BA recommends Django templates for MVP given the timeline constraint, but this is an architecture decision the project lead should make with full awareness of the tradeoff.

**Q3: Licensing decision.**
The architecture proposal lists AGPL-3.0, MIT/BSD, and Apache-2.0 as options. This does not block implementation gates but blocks the first public commit. The gap analysis notes that institutional adoption (EAZA, AZA members) may be sensitive to AGPL's copyleft requirements. **Decision needed before first public release, which should coincide with MVP.**

### Blocking for Post-MVP but Should Be Tracked Now

**Q4: CARES 2.0 liaison.**
The project lead should establish a communication channel with CARES 2.0 developers (via the Coordinator role) to: (a) understand CARES 2.0's data export capabilities and timeline, (b) advocate for machine-readable species identifiers in CARES 2.0 exports, (c) align the CARES classification enum values (CCR/CEN/CVU/CLC) between systems. This is a stakeholder conversation, not a development task, but it has architecture implications.

**Q5: ECA Workshop attendance and data alignment. [RESOLVED]**
The project lead (Aleksei Saunders) is registered and will attend the June 2026 CPSG Ex-situ Conservation Assessment Workshop (ABQ BioPark, June 1-5). The platform should be in a demonstrable state by then -- species profiles and basic ex-situ population tracking as the minimum. The workshop is co-organized by SHOAL, so this is also the natural moment to initiate the Q6 conversation with Georgie Bull in person. Preparation task (not a code task): prepare a brief one-pager on the platform to share with workshop participants, framing it as the regional data infrastructure for Malagasy species ECA outcomes.

**Q6: SHOAL partnership scope.**
The SHOAL 1,000 Fishes Blueprint confirms that SHOAL is not building a competing species database -- its data foundation is the IUCN Red List. The January 2026 workshop reference to Georgie Bull building a "conservation project database" likely refers to a project registry (tracking which organizations are working on which species), not a species profile or ex-situ tracking system. This platform is complementary. **Decision needed: Has the project lead contacted Georgie Bull to (a) understand exactly what SHOAL's project database covers, (b) clarify whether this platform could serve as the Malagasy data source feeding SHOAL's network, and (c) coordinate on how ECA Workshop outputs for Malagasy species will be captured?** Given SHOAL's co-organizer role in the ECA Workshop, this conversation is now more urgent than the January 2026 framing suggested.

### Not Blocking -- Can Be Deferred

The following open questions from the architecture proposal are real but do not block MVP and can be resolved during or after initial development:

- **Prioritization criteria** -- SHOAL's global Priority Fishes criteria are now published (IUCN EW/CR/EN/VU + criterion D1 or D2). The `shoal_priority` boolean field on Species can be populated from the Blueprint's published list without building the scoring tool. Malagasy-specific composite scoring criteria (weighting CARES status, ex-situ gap, local endemism factors) remain under discussion. Defer the scoring tool UI; the data fields can be seeded.
- **KBA spatial data** -- Thomas Ziegler proposed this as a student project. Defer spatial overlay until spatial data sources are identified and licensed.
- **Multilingual scope** -- English for MVP. French and Malagasy common names stored in the CommonName model from day one, but UI internationalization is post-MVP.
- **Governance handover** -- Resolved for now (Aleksei owns at launch). Long-term handover is a post-MVP organizational question. Architecture mitigates lock-in risk (org-level credentials, no personal account dependencies).
- **Data entry responsibility** -- For MVP, the project lead is the primary data entrant via Django Admin. Post-MVP, the Tier 3+ coordinator community enters population data. Distributed data entry with review workflows is a post-MVP capability.

---

## 6. Cross-Feature Impact Summary

The five issues interact with each other in ways the PM should be aware of:

1. **Undescribed taxa (Issue 2) amplifies the CARES integration challenge (Issue 1).** CARES 2.0 heavily features undescribed morphospecies. The platform must represent them before CARES integration can work. Solving Issue 2 in MVP is a prerequisite for post-MVP CARES integration.

2. **The review queue (Issue 4) is needed by the CARES Coordinator role (Issue 3).** As CARES Coordinator, the project lead will receive provisional classifications that need review. The lightweight review_status field on ConservationAssessment provides the minimal infrastructure for this workflow.

3. **Species count revision (Issue 5) depends on undescribed taxa support (Issue 2).** The count can only be revised upward if the data model can represent undescribed taxa. These are the same change.

4. **The CARES Coordinator role (Issue 3) de-risks the CARES 2.0 timing uncertainty (Issue 1).** Direct influence over CARES 2.0 means the project lead can align timelines and data formats, reducing integration risk when CARES 2.0 launches.

5. **All five issues converge on the ConservationAssessment model.** The `source` enum needs to support `cares_official` (Issue 1), the review_status field supports the review queue (Issue 4), and the model must handle assessments for undescribed taxa (Issue 2). The PM should treat ConservationAssessment model refinement as a single work unit, not five separate changes.

---

## 7. Summary of Data Model Changes for PM

| Model | Change | MVP? | Driven By |
|-------|--------|------|-----------|
| **Species** | Add `taxonomic_status` enum (described / undescribed_morphospecies / species_complex / uncertain) | YES | Issue 2 |
| **Species** | Add `provisional_name` (CharField, nullable) | YES | Issue 2 |
| **Species** | Make `authority` nullable | YES | Issue 2 |
| **Species** | Make `year_described` nullable | YES | Issue 2 |
| **Species** | Add `cares_status` enum (null / CCR / CEN / CVU / CLC) | YES | Issue 1 |
| **ConservationAssessment** | Add `review_status` enum (accepted / pending_review / under_revision / superseded) | YES | Issue 4 |
| **ConservationAssessment** | Add `review_notes`, `flagged_by`, `flagged_date` | YES | Issue 4 |
| **ConservationAssessment** | Extend `source` enum to include `cares_official` | Post-MVP | Issue 1 |
| **CARESClassification** (new entity) | Full CARES classification history with cares_category, cares_region, date_listed | Post-MVP | Issue 1 |

---

*This assessment is ready for human review. Once the blocking questions (Q1-Q3) are resolved, the PM can proceed with gate specifications.*
