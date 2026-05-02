# MFFCP Administration Guide

A task-oriented reference for operators of the Malagasy Freshwater Fishes
Conservation Platform Django admin.

**Admin URL:** https://api.malagasyfishes.org/admin/
**Local dev:** http://localhost:8000/admin/

Sign in with a superuser (Tier 5) or a staff account with the right tier.
Tier gates are enforced on specific models — see each section.

---

## Quick-find: "I need to edit X, where do I go?"

| I want to… | App → Model | Notes |
|---|---|---|
| Add or edit a species | **Species → Species** | Core taxonomy, silhouette, narrative |
| Add a species silhouette (species-level) | **Species → Species** → open species → `silhouette_svg` field | Paste SVG markup; width/height stripped on save |
| Add a silhouette at the **genus** level (fallback) | **Species → Genus** → open genus → `silhouette_svg` field | Used when a species has no silhouette of its own |
| Change a species' IUCN category | **Species → Conservation assessments** → **Add** (source = manual_expert) | **Do NOT edit `iucn_status` on Species directly** — it's a mirror |
| Upload the home hero image | **Species → Site map assets** → find row with key `hero_thumb` → upload | Pre-seeded; edit, don't add |
| Upload the species-profile distribution panel image | **Species → Site map assets** → find row with key `profile_panel` → upload | Same pattern |
| Edit a watershed / drainage basin | **Species → Watersheds** | Read-only (HyBAS mirror) — contact dev to re-import |
| Add a locality / occurrence record | **Species → Species localities** | GIS map picker; check `needs_review` to quarantine |
| Add a common name for a species | **Species → Species** → open species → Common names inline | Tabular inline at bottom of species form. Set `language` to ISO 639-1 code (en, mg, fr, de). Public profile groups by language. |
| Add an institution holding captive fish | **Populations → Institutions** | |
| Record a captive population | **Populations → Ex situ populations** | After creation, the institution's keepers can edit it from the self-service web surface — see POPULATION_DATA_GUIDE §4 |
| Log a census snapshot | **Populations → Ex situ populations** → open row → Holding records inline | Or update `last_census_date` on the row directly (Option A in POPULATION_DATA_GUIDE §8) |
| Approve / reject an institution-membership claim | **Accounts → Pending institution claims** | Tier 3+. Use the "Approve selected" / "Reject selected" actions; superuser-only for add/delete |
| Log a breeding event | Self-service preferred — `/dashboard/institution/breeding-events/` | Append-only ledger; corrections via follow-up entries |
| Add husbandry guidance | **Husbandry → Species husbandry** | Publishing requires ≥1 source + reviewer |
| Record a field program | **Fieldwork → Field programs** *or* `/dashboard/institution/field-programs/` | Self-service can create/edit programs led by your institution; M2M relations stay coordinator-only |
| Draft a breeding recommendation | **Populations → Breeding recommendations** | Lifecycle: open → in-review → completed |
| Log a transfer | **Populations → Transfers** | Coordinator-only; lifecycle proposed → completed |
| Check an IUCN sync run | **Integration → Sync jobs** | Read-only log |
| Invite a user / change tier | **Accounts → Users** | Superuser only for tier/privilege edits |
| Review an IUCN↔manual conflict | **Species → Conservation status conflicts** | Tier 3+; resolve or dismiss |
| Audit who changed an IUCN status, a population, a breeding event, or a field program | **Audit → Audit entries** | Tier 5 list view; Tier 3+ via the per-species inline. Filter by `target_type`, `actor_institution`, `action`, `timestamp`. Append-only. |
| Pull a quarter's audit log as CSV | `GET /api/v1/audit/export.csv` (Tier 3+) | See POPULATION_DATA_GUIDE §12 for filters and curl |

---

## App-by-app reference

### Species

The core taxonomic and conservation-data app. Most day-to-day editing
happens here.

- **Genus** — genus record. Holds the **genus-level silhouette fallback**.
  If a species has no silhouette of its own, cards fall back to this one.
  Paste inline SVG markup into `silhouette_svg`; width/height attributes are
  stripped automatically on save so cards render cleanly.
- **Species** — the canonical species row. Fields include scientific name,
  authority, taxon hierarchy, endemic status, undescribed flag,
  `silhouette_svg` (species-level override), narrative prose, and
  `iucn_status`.
  - **`iucn_status` is a read-only mirror.** It reflects the most recent
    accepted `ConservationAssessment`. To change the badge, add an
    assessment (see below), don't edit this field.
  - Inlines on the species detail page: Conservation Assessments, Common
    Names, Species Localities.
  - Tier 3+ users see a "Recent iucn_status changes" audit strip at the
    bottom of the form.
- **Conservation assessments** — individual IUCN or manual-expert
  assessment records. Adding one with `source=manual_expert` requires a
  category, assessor, assessment date, notes, and a free-text **reason**
  (captured for audit). Tier 3+ only for add/change. An accepted new
  assessment updates `Species.iucn_status` automatically via the mirror
  policy.
- **Conservation status conflicts** — raised automatically when an IUCN
  sync brings in a category that disagrees with a manual expert
  assessment. Tier 3+ can resolve by picking one of:
  - `accepted_iucn` (supersede the manual assessment),
  - `retained_manual` (keep the manual, flag IUCN record as dissenting),
  - `reconciled` (create a new reconciled assessment),
  - `dismissed` (noise / false positive).
- **Site map assets** — curated static map thumbnails used by the
  frontend. Pre-seeded with two rows: **`hero_thumb`** (home page hero)
  and **`profile_panel`** (species-profile Distribution panel). Open the
  row and upload a new image; save triggers a revalidation of affected
  public pages.
- **Taxon** — taxonomic hierarchy rows (family → subfamily → etc.). Edit
  when you need to add a new family or reclassify.
- **Species localities** — occurrence records with GIS coordinates. Admin
  uses a map picker. Key flags:
  - `is_sensitive` — editable only by superusers; triggers coordinate
    generalization for public viewers.
  - `needs_review` — hides the record from the public map until cleared.
  - `location_generalized`, `drainage_basin_name` — auto-computed on save;
    read-only.
- **Watersheds** — HyBAS drainage-basin polygons (Pfafstetter level-12).
  **Read-only mirror** of the HyBAS import. To add or correct a basin,
  coordinate with a developer to re-run the import.
- **Protected areas** — WDPA-sourced protected-area polygons. Also a
  **read-only mirror**.

### Populations

Ex-situ coordination data. Tier-scoped.

- **Institutions** — zoos, aquariums, research orgs, hobbyist programs.
  Includes membership flags (ZIMS, EAZA, AZA) used by coordinator-tier
  filters.
- **Ex-situ populations** — one row per (species, institution) pair.
  **Tier 3–4 users can only write to their own institution.** Tier 1–2 are
  read-only. Holding Records are an inline on the detail form.
- **Holding records** — dated census snapshots (total/male/female/unknown
  counts) for a population. `reporter` is auto-filled on create from the
  logged-in user.

### Husbandry

Hobbyist captive-care guidance, published under an editorial gate.

- **Species husbandry** — water parameters, tank, diet, behavior,
  breeding, difficulty, sourcing. Publishing (`published=True`) is
  **blocked** unless the record has a `last_reviewed_by`,
  `last_reviewed_at`, **and** at least one `HusbandrySource`. A stale-
  review warning appears on the form if the last review is >730 days old.
- **Husbandry sources** — citations / references for a husbandry record.
  Normally edited via the inline on the parent species-husbandry form.

### Fieldwork

In-situ program tracking.

- **Field programs** — program or survey record with dates, lead
  institution, and many-to-many links to focal species and partner
  institutions.

### Integration

External-system sync telemetry.

- **Sync jobs** — log of IUCN API sync runs (pending / running /
  completed / failed). **Read-only** — add/change/delete are disabled.
  Use this to investigate when a species' mirror last updated or why an
  ingest failed; look at `records_skipped` and `error_log`.

### Accounts

Platform users and their own audit log.

- **Users** — platform accounts with an `access_tier` (1 Public,
  2 Researcher, 3 Coordinator, 4 Program Manager, 5 Admin) and an
  optional institution affiliation. **Only superusers can edit tier,
  `is_active`, `is_staff`, or `is_superuser`.**
- **Audit logs** — user-action audit (create / update / delete) with
  timestamp, IP, and a JSON diff. Read-only.

### Audit

Append-only conservation-status governance log, separate from the
general Accounts audit.

- **Audit entries** — every change to `Species.iucn_status` or to a
  `ConservationAssessment` row. **Tier 5 (superuser) only** for the
  global list. Tier 3+ users can see scoped entries for a species from
  inside that species' detail form (the "Recent iucn_status changes"
  block). **The table is append-only** — the admin disables add /
  change / delete, and the model raises `PermissionError` on any attempt
  to modify or delete an entry programmatically.

---

## Common workflows

### Add a new species

1. **Species → Taxon** — confirm the family / genus exists; add if needed.
2. **Species → Genus** — confirm the genus row exists; add if needed,
   including a genus-level silhouette if one is available.
3. **Species → Species → Add species.**
   - Fill taxonomy, endemic status, authority, narrative.
   - Paste species-level `silhouette_svg` if you have one — otherwise
     the genus fallback will be used.
   - Leave `iucn_status` alone — it will populate from step 4.
4. **Species → Conservation assessments → Add** referencing the new
   species, with `source=manual_expert` (or wait for the next IUCN sync
   if the species has an `iucn_taxon_id`). This sets the public badge.
5. (Optional) Add **Common names** inline on the species form. Use ISO
   639-1 language codes (`en`, `mg`, `fr`, `de`, `es`, …). The public
   profile's Common Names panel groups entries by language — English,
   Malagasy, French, German appear first in that order; other codes fall
   through alphabetically. Unknown codes render with the uppercased code
   as a label rather than disappearing.

### Add or replace a silhouette

**Species-level** (highest priority):
Species → Species → open the row → paste SVG markup into
`silhouette_svg` → Save. Width and height attributes on the root `<svg>`
are stripped automatically — the frontend sizes to the card.

**Genus-level** (fallback when species has none):
Species → Genus → open the row → paste SVG markup into
`silhouette_svg` → Save. Affects every species in that genus that has no
species-level silhouette.

### Change a species' IUCN category

Do **not** edit `Species.iucn_status` directly.

1. Species → Conservation assessments → Add.
2. Pick the species, `source=manual_expert`, set category, assessor,
   assessment date, and notes.
3. Fill in the **reason** field (free text; captured in the audit).
4. Save. The species mirror picks up the new category via the same code
   path that handles IUCN syncs.
5. If your new assessment disagrees with an existing IUCN assessment, a
   **Conservation status conflict** row will be created — resolve it
   from that list.

### Upload a new home-page hero image

1. Species → Site map assets.
2. Find the row with **Key = hero_thumb** (pre-seeded — don't add a new
   row).
3. Open it, upload the new image, update credit/alt text.
4. Save. The home page will revalidate automatically.

Same pattern for the species profile Distribution panel, using the row
with **Key = profile_panel**.

### Record a new captive population

1. Populations → Institutions — confirm the institution exists; add if
   not.
2. Populations → Ex-situ populations → Add.
3. Pick species and institution. Tier 3–4 users are constrained to their
   own institution automatically.
4. Save, then use the **Holding records** inline to add a census
   snapshot.

### Review a conservation-status conflict

1. Species → Conservation status conflicts — filter to unresolved.
2. Open the conflict. You'll see the manual assessment and the incoming
   IUCN assessment side by side.
3. Pick a resolution (`accepted_iucn`, `retained_manual`, `reconciled`,
   or `dismissed`) and, for `reconciled`, set the reconciled category.
4. Save. The chosen resolution cascades: superseded assessments are
   marked, a reconciled assessment row may be created, and the mirror is
   updated.

---

## Tier reference

| Tier | Role | Admin reach |
|---|---|---|
| 1 | Public | No admin access |
| 2 | Registered Researcher | Read-only on most species / population rows |
| 3 | Conservation Coordinator | Add/change Conservation Assessments, Conflicts, scoped audit view |
| 4 | Program Manager | Ex-situ populations for own institution, studbook-level fields |
| 5 | Administrator / superuser | Full admin, user management, audit list |

---

## Things that look editable but aren't (on purpose)

- **`Species.iucn_status`** — mirror of latest accepted assessment.
  Route all changes through `ConservationAssessment`.
- **Watersheds, Protected areas** — HyBAS / WDPA mirrors. Re-imported by
  devs.
- **Sync jobs, Audit entries, Audit logs** — append-only logs.
- **`SpeciesLocality.location_generalized`,
  `SpeciesLocality.drainage_basin_name`** — computed on save.
- **`HoldingRecord.reporter`** — auto-filled from the logged-in user on
  create.
