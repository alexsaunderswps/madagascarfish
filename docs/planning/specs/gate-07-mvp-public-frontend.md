# Gate 07 — [MVP GATE] Public Frontend

**Status:** Not started
**Preconditions:** Gates 05 and 06 complete (API endpoints live; real species data seeded)
**Unlocks:** ECA Workshop demonstration — this is the MVP

---

## Purpose

Build the public-facing Next.js frontend. This is the product that conservation stakeholders will see at the June 2026 ECA Workshop. Three pages: species directory, species profile, conservation dashboard.

No auth UI in the Next.js frontend at MVP. Coordinators use Django Admin. The Next.js app is a public-facing read-only interface over the DRF API.

---

## Deliverables

- Next.js 14 project with TypeScript and Tailwind CSS
- Three public pages: `/species/`, `/species/[id]/`, `/dashboard/`
- Navigation header and footer present on all pages
- SSR/SSG for species directory and species profiles (for SEO on public species pages)
- Configurable API base URL via `NEXT_PUBLIC_API_URL` environment variable
- Deployed to staging at a public URL accessible to ECA Workshop attendees

---

## API Dependencies (Gate 05)

| Page | DRF Endpoints Consumed |
|------|----------------------|
| Species Directory | `GET /api/v1/species/` |
| Species Profile | `GET /api/v1/species/{id}/`, `GET /api/v1/field-programs/` (for linked programs) |
| Conservation Dashboard | `GET /api/v1/dashboard/` |

All requests are unauthenticated (Tier 1 / public access). No token management in the Next.js frontend at MVP.

---

## User Stories

### FE-07-1: Species Directory

**As** a conservation stakeholder visiting the platform,
**I want** to browse all ~95–100 Madagascar freshwater fish species in a searchable, filterable directory,
**so that** I can find species I'm interested in and understand the overall scope of the group.

**Page:** `/species/`
**Rendering:** SSG with revalidation every 24 hours (species data changes rarely; IUCN sync is weekly)

**UI elements:**
- Page header: "X Endemic Freshwater Fish Species" with subtitle "(Y described, Z undescribed taxa)"
- Counts come from `count`, `described_count`, `undescribed_count` in the API response
- Filter sidebar or filter bar:
  - Taxonomic status (All / Described / Undescribed)
  - IUCN status (multi-select: CR / EN / VU / NT / LC / DD / NE)
  - Family (multi-select, populated from species data)
  - CARES status (All / CCR / CEN / CVU / CLC)
- Search input (submits to `?search=...` query param)
- Species cards/rows: scientific name, taxonomic status badge, family, IUCN status badge, CARES status badge
- Undescribed taxa display a "Provisional Name" badge distinguishing them from described species
- IUCN status badges use standard IUCN color coding (CR = red, EN = orange, VU = yellow, etc.)
- Pagination: 50 per page; page controls at bottom
- Filters update URL query params (shareable/bookmarkable filter state)

**Acceptance Criteria:**

**Given** a user visiting `/species/`
**When** the page loads
**Then** the header shows the correct total count; both described and undescribed species appear by default; pagination controls are visible if more than 50 species exist

**Given** a user with `?taxonomic_status=undescribed_morphospecies` in the URL
**When** the page loads
**Then** only undescribed taxa are shown; the count reflects the filtered set; each card shows the "Provisional Name" badge

**Given** a user selecting "CR" from the IUCN status filter
**When** the filter is applied
**Then** only CR-status species are shown; the count updates; the filter state is reflected in the URL

**Given** a user typing "sakaramy" in the search field
**When** the search is submitted
**Then** *Pachypanchax sakaramyi* appears in results; other species do not

**Given** a user clicking a species card
**When** the click is registered
**Then** the user is navigated to `/species/{id}/`

---

### FE-07-2: Species Profile

**As** a conservation stakeholder or educator,
**I want** to view a detailed profile page for a single species,
**so that** I understand its taxonomy, conservation status, ecological context, and captive population status.

**Page:** `/species/[id]/`
**Rendering:** SSR with `getServerSideProps` (individual species pages may update after IUCN sync; SSR ensures freshness without cache invalidation complexity at MVP)

**UI sections:**

1. **Header** — Scientific name (bold, italic), taxonomic status badge, family, genus. For undescribed taxa: "Undescribed taxon — provisional name used in conservation literature" notice below the name. Do not display authority or year_described for undescribed taxa.

2. **Conservation Status** — IUCN status badge (category + criteria string), assessment date, CARES status badge. No mention of `review_status` to public users (pending reviews are invisible at Tier 1).

3. **Common Names** — Displayed by language (English, French, Malagasy)

4. **Description & Ecology** — `description`, `ecology_notes`, `distribution_narrative`, `morphology`, `max_length_cm`, `habitat_type` — displayed if non-empty

5. **Captive Population Summary** — "X institutions hold this species in captivity, with approximately Y individuals across Z breeding programs." Uses `ex_situ_summary` from the API. If `institutions_holding = 0`: "No captive population is currently tracked for this species." Use warm neutral styling to convey urgency without alarming language.

6. **Field Programs** — List of linked field programs (name, status, region) with links to `/field-programs/{id}/` (if that page is implemented; otherwise link to program website if available). Can be empty section if no programs linked.

7. **External Links** — If `iucn_taxon_id` is set: link to IUCN Red List species page. If `gbif_taxon_key` is set: link to GBIF species page.

**Acceptance Criteria:**

**Given** a user visiting `/species/{id}/` for *Bedotia sp. 'manombo'* (undescribed morphospecies)
**When** the page renders
**Then** the header shows "Bedotia sp. 'manombo'" with a "Provisional Name" badge; the "Undescribed taxon" notice is displayed; no authority or year is shown; the IUCN status section shows "Not Evaluated" if no assessment exists

**Given** a user visiting `/species/{id}/` for *Pachypanchax sakaramyi* (described, IUCN EN)
**When** the page renders
**Then** the IUCN status badge shows "EN" in orange; the criteria string "B1ab(iii)" is displayed; the assessment date and assessor are shown; the authority "Holly, 1928" is shown

**Given** a user visiting `/species/{id}/` for a species with `ex_situ_summary.institutions_holding = 0`
**When** the page renders
**Then** the captive population section displays "No captive population is currently tracked for this species" — not an error state, not empty

**Given** a user visiting `/species/9999/` where no such species exists
**When** the page renders
**Then** a 404 page is displayed (Next.js `notFound()`)

**Given** the DRF API is unreachable during SSR
**When** the page is requested
**Then** an error page is shown with a message like "Data temporarily unavailable" — not a stack trace

---

### FE-07-3: Conservation Dashboard

**As** a conservation funder, workshop attendee, or journalist,
**I want** to see a visual summary of the ex-situ coverage gap and overall conservation status,
**so that** I understand at a glance why this platform exists and what problem it solves.

**Page:** `/dashboard/`
**Rendering:** SSR (dashboard data refreshes after IUCN sync; freshness matters here)

**UI sections:**

1. **The Coverage Gap** (most prominent section) — Large stat block: "X of Y threatened species have no known captive population." Threatened = IUCN CR + EN + VU. Uses `ex_situ_coverage.threatened_species_without_captive_population` and `ex_situ_coverage.threatened_species_total`.

2. **Species by IUCN Threat Status** — Horizontal bar chart or donut showing species counts by IUCN category. Use standard IUCN colors. Include "Not Evaluated / Not Assessed" category for species without assessments.

3. **Summary Stats Row** — Three stat boxes: total species tracked, institutions participating, total populations monitored. Uses `species_counts.total`, `ex_situ_coverage.institutions_active`, `ex_situ_coverage.total_populations_tracked`.

4. **Field Programs Active** — Simple count with brief description. Uses `field_programs.active`.

5. **Data freshness** — Small footer note: "IUCN assessment data last synced: [date]" using `last_updated`.

**Chart library:** Use `recharts` or `chart.js` via `react-chartjs-2` (both are lightweight, React-compatible, and open-source). No proprietary visualization dependencies.

**Acceptance Criteria:**

**Given** a user visiting `/dashboard/`
**When** the page loads
**Then** the coverage gap stat prominently shows "31 of 49 threatened species have no known captive population" (or whatever the current data shows); the species-by-status chart renders with data for all present categories

**Given** `GET /api/v1/dashboard/` returns `last_updated: "2026-04-10T02:00:00Z"`
**When** the dashboard renders
**Then** the data freshness note reads "IUCN data last synced: April 10, 2026" (formatted, not raw ISO timestamp)

**Given** a user on a mobile device (viewport < 768px)
**When** the dashboard renders
**Then** the layout stacks vertically; charts are responsive; no horizontal scroll is required; text remains readable at default font size

---

### FE-07-4: Navigation and Site Shell

**As** any visitor,
**I want** consistent navigation across all pages,
**so that** I can move between the directory, profiles, and dashboard without confusion.

**Header links:** "Species Directory" (`/species/`), "Conservation Dashboard" (`/dashboard/`), "About" (static page or anchor on homepage — minimal content at MVP)

**Footer:** Platform name, Apache-2.0 license notice, link to GitHub repository, "Data sources: IUCN Red List, Leiss et al. 2022"

**Acceptance Criteria:**

**Given** a user on any page
**When** they click "Species Directory" in the navigation
**Then** they are taken to `/species/` and the current page link in the nav is visually active

**Given** a user on any page
**When** the page is viewed without JavaScript
**Then** the species directory and profile pages still render meaningful content (SSR/SSG guarantees this; dashboard chart may degrade gracefully)

---

## Technical Tasks

- Initialize Next.js 14 project with TypeScript: `npx create-next-app@14 --typescript --tailwind --app`
- Use the App Router (`app/` directory) for all pages
- Create TypeScript types for all DRF API response shapes in `lib/types.ts`; these are the client-side reflection of the DRF serializer contracts
- Create `lib/api.ts` — typed fetch wrapper that reads `NEXT_PUBLIC_API_URL` from env; handles API errors consistently
- Configure `next.config.js` to proxy `/api/` to the Django backend in development (avoids CORS issues)
- Install and configure chart library (recharts recommended)
- Add `.env.local.example` with `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Write Vitest component tests for: species card renders undescribed taxa badge correctly, dashboard coverage gap stat renders correct values, IUCN status badge applies correct color class
- Deploy to Fly.io or Vercel staging environment before gate is marked complete

---

## Out of Scope

- Login, registration, or any auth UI (coordinators use Django Admin)
- Species profile pages for occurrence data, survey maps, or breeding records (post-MVP)
- Coordinator-facing Next.js UI (Gate 08)
- Field program data entry (post-MVP)
- Multilingual UI (English only at MVP; CommonName data for fr/mg is stored but not surfaced in UI)
- Species images (stored in S3; display is desirable but not required for ECA Workshop demonstration)

---

## Gate Exit Criteria

This is the MVP gate. All prior gates must be complete before this one is marked complete.

Before marking Gate 07 (MVP) complete:
1. All three pages render with real seeded data (`/species/`, `/species/{id}/`, `/dashboard/`)
2. The species directory correctly shows described vs. undescribed species with appropriate badges
3. The dashboard coverage gap statistic renders correctly
4. No stack traces or unhandled errors appear on any page with valid data
5. Pages render on mobile viewports without horizontal scroll
6. Deployed to a staging URL that can be demonstrated at the ECA Workshop (June 1–5, 2026)
7. Invoke **@test-writer** to write adversarial frontend tests (undefined API fields, empty states, network failure, 404 species IDs)
8. Invoke **@ux-reviewer** — this is the face of the platform at the workshop; validate that the coverage gap message and species directory are immediately comprehensible to a conservation professional unfamiliar with the platform
9. Invoke **@code-quality-reviewer** on Next.js code
10. Invoke **@security-reviewer** — verify no sensitive data leaks through public API calls; verify NEXT_PUBLIC env vars contain nothing sensitive
