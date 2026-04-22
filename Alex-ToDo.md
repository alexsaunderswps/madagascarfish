# Alex's To-Do List

This document is the single running punch list of things only you can do —
configuration steps that need your hands on a credential, data entry that
needs your domain judgment, or reference lookups that help steer the next
round of development. I'll maintain it as items land or become obsolete.

**How to use this file:**
- Items are grouped by type, not by priority. The **Priority** column inside
  each section is what ranks them.
- Each item says what to do, why it matters, and how to verify it's done.
- **Don't delete completed items** — strike them through (`~~like this~~`) or
  move them to the "Done" section at the bottom so we can see what was
  actually shipped without a git archaeology dig.

---

## 1. Configuration (operator setup)

### 1.1 Set `COORDINATOR_API_TOKEN` on Vercel + staging backend

**Priority:** high. Without it, `/dashboard/coordinator` shows the orange
"token not configured" banner we just added and all four panels are empty.

**Steps:**

1. Generate a secret on your laptop:
   ```bash
   openssl rand -hex 32
   ```
   Copy the output — same value goes into both places below.

2. **Vercel** (Project Settings → Environment Variables):
   - Key: `COORDINATOR_API_TOKEN`
   - Value: the hex string
   - Environments: check **Production** (and Preview if you want preview
     branches to fetch coordinator data too)
   - Save, then redeploy the project once (Vercel only picks up new env
     vars on a fresh deploy).

3. **Staging backend** — SSH in and edit the compose `.env`:
   ```bash
   ssh deploy@46.224.196.197
   cd /home/deploy/madagascarfish/deploy/staging
   nano .env
   ```
   Add the line:
   ```
   COORDINATOR_API_TOKEN=<same hex string>
   ```
   Save (`Ctrl-O`, Enter, `Ctrl-X`), then recreate the web container so
   Django picks up the new env:
   ```bash
   docker compose up -d --force-recreate web
   ```

**How to verify:** open `https://malagasyfishes.org/dashboard/coordinator`.
No orange banner. Panels render (they may be empty if you haven't seeded
any populations yet — see §2.1). The curl check:
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer <your token>" \
  https://api.malagasyfishes.org/api/v1/coordinator-dashboard/stale-census/
```
should print `200`. Without the header it should print `403`.

**Full runbook for this:** OPERATIONS.md §11.2.

---

### 1.2 Verify the revalidate webhook is configured

**Priority:** medium. Not blocking, but without it every admin save takes
up to an hour to show on the public site.

**Steps:** same pattern as §1.1 but with different names.

- **Vercel env:** `REVALIDATE_SECRET` = `<a different secret you generate>`
- **Staging `.env`:**
  ```
  NEXT_REVALIDATE_URL=https://malagasyfishes.org/api/revalidate
  NEXT_REVALIDATE_SECRET=<same value as Vercel's REVALIDATE_SECRET>
  ```
- `docker compose up -d --force-recreate web`

**How to verify:** edit any species in admin and save. The green banner
should read "Revalidated N path(s)." If it says "Revalidate is not
configured..." the backend env vars aren't set or the container wasn't
recreated.

**Full runbook:** OPERATIONS.md §11.1.

---

## 2. Data entry (your domain judgment)

### 2.1 Enter real CARES population data

**Priority:** high. The coordinator dashboard is a read-only view over
this data — without it, ABQ is a demo of empty panels.

**Workflow overview:** Each CARES hobbyist keeper becomes one `Institution`
row. Each population they hold becomes one `ExSituPopulation` row linking
species → keeper.

**Full walkthrough:** `docs/POPULATION_DATA_GUIDE.md` — every field, every
decision (e.g. when to check `studbook_managed` for a CARES population —
usually unchecked, that's the whole point of the four-bucket split).

**If you have a CSV** (CARES list in spreadsheet form), skip the manual
admin clicking and use the `seed_populations` management command —
see `POPULATION_DATA_GUIDE.md` §9. The CSV schema there maps cleanly
to a CARES-style export (one row per keeper-species pair). Idempotent,
dry-run supported, institutions auto-deduplicated by name.

**Concrete steps to start:**

1. Sign in to https://api.malagasyfishes.org/admin/ as a Tier 5
   (superuser) or Tier 3+ staff account.

2. For each unique CARES keeper on your list:
   - **Populations → Institutions → Add institution**
   - Name: "J. Smith (CARES)" / "Smith household — CARES" / "CARES #4172"
     — whichever the keeper agreed to. **Pick a convention and keep it
     consistent across your whole entry session.**
   - Institution type: **`hobbyist_keeper`** (individual) — not
     `hobbyist_program`, that's reserved for the CARES org umbrella.
   - Country / city as appropriate (leave city blank for privacy)
   - Leave `contact_email` blank unless the keeper consented (it's
     Tier 3+ only but still — consent first)
   - Save

3. For each population that keeper holds:
   - **Populations → Ex situ populations → Add**
   - Species: autocomplete, type scientific name
   - Institution: autocomplete, type the keeper's name
   - `count_total` (required-ish), `count_male`/`female`/`unsexed` if known
   - `breeding_status`: `breeding` / `non-breeding` / `unknown`
   - `studbook_managed`: **usually unchecked** for CARES populations
   - `last_census_date`: **set to today** or the date of your CARES data
   - Save

4. After a batch of entries, click the **"Revalidate public pages"** admin
   action (available on Species / Genus / Institution / ExSituPopulation /
   SiteMapAsset list views) to refresh ISR immediately. Or wait up to
   an hour for it to refresh on its own.

**How to verify:** open `/dashboard/coordinator` — Panel 2 should move
species out of "No captive population" into whichever bucket fits
(holdings-only, breeding-not-studbook, or studbook-managed).

---

### 2.2 Re-upload silhouettes for Paretroplus menarambo + P. nourissati

**Priority:** medium. These profiles currently show a placeholder fish
because the original SVGs were stripped of width/height without a viewBox
being synthesized — fix landed in PR #85 but the corrupted rows need
re-upload to recover.

**Steps:**

1. https://api.malagasyfishes.org/admin/species/species/ → search for
   "menarambo" → open it
2. In the **Silhouette** section, use the **"Upload .svg file (optional)"**
   picker to select the menarambo SVG from wherever you keep them locally
3. Save. You should see the green revalidate banner.
4. Repeat for `Paretroplus nourissati`.
5. Open the public profile `/species/<id>/` — silhouette should render.

**How to verify:** the directory card at `/species/` and the profile at
`/species/<id>/` both show the species-specific SVG instead of the
generic placeholder fish.

---

### 2.3 Reconcile the 54 unmatched drainage basins

**Priority:** low-medium. This is a data-quality item — the seed run
reports `no drainage basin matched: 54`. Those localities exist but
have `drainage_basin = NULL`, so they don't show up on basin-filtered
views and can't be grouped by watershed. Not blocking ABQ.

**Background:** `seed_localities` auto-matches each locality to a
HyBAS Level 6 watershed by spatial containment. 54 rows couldn't be
matched — usually because the coordinate is marginally outside the
basin polygon (coastal points, coordinate imprecision) or the locality
is in a basin HyBAS hasn't split out.

**Steps:**

1. https://api.malagasyfishes.org/admin/species/specieslocality/
2. In the right-hand filter column, check **"Drainage basin: (None)"**
   and **"Needs review: Yes"** — the rows you care about.
3. For each one, open it and look at the `location` field on the map
   picker. The map shows the HyBAS watershed polygons as an overlay
   (if not, zoom in — they can be subtle).
4. If the locality is clearly inside one basin: set `drainage_basin` to
   that basin via the autocomplete, uncheck `needs_review`, save.
5. If the locality is clearly outside all Madagascar basins (e.g. marine
   species, coastal estuary): leave `drainage_basin = NULL`, but uncheck
   `needs_review` with a note in `review_notes` explaining why.
6. If you can't tell: leave it flagged and add a note. Come back later.

**How to verify:** the count of "needs_review = True" in the list filter
drops. Public profiles for those species show their drainage basin on
the distribution panel.

**Realistic scope:** 54 rows is ~30-60 minutes of steady work. Fine to
chip at between other tasks.

---

### 2.4 Enter CoordinatedProgram rows for known SSPs / EEPs / CARES

**Priority:** medium-high for ABQ demo narrative.

**What it is:** `CoordinatedProgram` is the "who runs this species'
program" layer (landed in Gate 4 Phase 1). Each row links a species
to a formal program — AZA SSP, EAZA EEP, CARES priority, or an
independent regional program. Surfaces on Panel 2 (studbook bucketing)
and Panel 5 (transfer activity linked to a program).

**Steps:**

1. https://api.malagasyfishes.org/admin/populations/coordinatedprogram/add/
2. Fill in:
   - **Species**: autocomplete
   - **Program type**: `ssp` / `eep` / `cares` / `independent` / `other`
   - **Name**: human-readable, shown on the dashboard. Suggested format:
     *"AZA SSP: Madagascar Rainbowfish"*, *"CARES: Paretroplus menarambo"*
   - **Status**: `planning` / `active` / `paused` / `deprecated`
   - **Coordinating institution**: who holds the studbook
   - **Studbook keeper**: the named user (if they're in the system)
   - **Enrolled institutions**: partner zoos / keepers (M2M; dual
     listbox widget)
   - **Target population size**, **plan summary**, **plan document URL**,
     **start date**, **next review date** — fill what you know
3. Save.

**How to verify:** no direct panel for CoordinatedProgram itself yet
(Gate 4 Phase 2 candidate). For now, the linkage shows up on
Panel 5 when a Transfer references a program.

**Workflow tip:** if you're entering CARES hobbyist populations and
want the species to show up as "CARES priority" at the program level,
add **one** CoordinatedProgram row per species with
`program_type=cares` — don't create one per keeper.

### 2.5 Enter Transfer rows as you learn of moves

**Priority:** medium. Panel 5 ("Transfer activity") renders whatever
is here — empty until you start logging.

**What it is:** `Transfer` tracks animal movement between institutions
with a lifecycle (proposed → approved → in_transit → completed /
cancelled). Landed in Gate 4 Phase 1.

**When to add a Transfer:**
- A zoo tells you they're planning to move fish to another institution
- A hobbyist moves founders between keepers
- An accession from the wild (use the collecting institution as source)
- A past move you know happened but isn't recorded

**Steps:**

1. https://api.malagasyfishes.org/admin/populations/transfer/add/
2. Fill in:
   - **Species / Source institution / Destination institution** (all
     autocomplete; source must differ from destination — DB-enforced)
   - **Status**: where it is in the lifecycle. `proposed` for something
     discussed but not agreed; `completed` for a past event.
   - **Proposed date** (required): when it was first logged/discussed
   - **Planned date** (optional): scheduled date
   - **Actual date** (required when status = `completed`)
   - **M.F.U counts** if known (males.females.unsexed)
   - **CITES reference**: permit number for CITES-listed species (CR,
     EN, VU are all CITES-relevant for Madagascar endemics). Blank for
     non-CITES cases.
   - **Coordinated program** (optional): if this transfer serves an
     existing SSP/EEP/CARES program row, link it.
   - **Notes**: quarantine info, holding pens, anything relevant
3. Save. `created_by` auto-fills to you.

**How to verify:** `/dashboard/coordinator` → Panel 5 "Transfer
activity" shows the row in "In flight" (if status is
proposed/approved/in_transit) or "Recently completed" (if status=
completed and actual_date is within last 90 days).

### 2.6 Audit existing `studbook_managed` checkboxes

**Priority:** low. Panel 2's "Studbook-managed" bucket reads this flag
directly. If any existing `ExSituPopulation` rows have it set
incorrectly (e.g. CARES populations that should be in
"breeding_not_studbook"), the bucket counts will be misleading.

**Steps:**

1. https://api.malagasyfishes.org/admin/populations/exsitupopulation/
2. Filter: **"Studbook managed: Yes"**
3. For each row, ask yourself: "Is there a formal studbook keeper
   assigned and a coordinated plan?" If no, uncheck.

**How to verify:** Panel 2 on the coordinator dashboard shows counts
that match your mental model.

---

## 3. Reference documents to pull (helps me build)

If you have access to any of these, send them my way and I can shape
Gate 4 Phase 2+ models tighter to what coordinators actually expect.

### 3.1 AZA SSP / Regional Collection Plan template

**Priority:** high for Gate 4 Phase 2.

**What I need:** a current AZA Species Survival Plan template —
specifically the fields the studbook keeper maintains and the structure
of a breeding recommendation. Public samples usually live on AZA's
website but they're often behind member-only logins.

**How it'll help:** tighter `CoordinatedProgram` fields and a realistic
`BreedingRecommendation` shape. Without this, I'm inferring from
conference papers and old SPARKS documentation.

**Concrete asks:**
- One example filled-in SSP plan document
- The SSP Annual Report template (if you can get it)
- The Breeding and Transfer Plan template

---

### 3.2 EAZA EEP Best Practice Guidelines

**Priority:** high for Gate 4 Phase 2.

**What I need:** EAZA publishes
[Best Practice Guidelines per taxon](https://www.eaza.net/conservation/programmes/).
A fish-relevant one (e.g. a cichlid EEP) would give me the European
equivalent structure to AZA's and help me validate the shape.

**Concrete asks:**
- One EAZA EEP Best Practice Guidelines PDF for a freshwater fish
- The current EAZA Monitor (population management software) export
  schema if they publish it

---

### 3.3 ZIMS export schema or field dictionary

**Priority:** medium.

**What I need:** if you or a partner institution has a ZIMS / Species360
account, the **Data Export** section has per-module schemas. The ones
that matter:
- Specimen records (individual-level animal tracking)
- Holding records (location over time)
- Move / Transaction (transfers between institutions)
- Breeding Event records

**How it'll help:** if we want the platform to eventually exchange data
with ZIMS, matching field names and enums reduces friction later.

**Concrete ask:** a CSV export (even with fake data) of each of those
four modules from a ZIMS-enabled institution. PDF field dictionary
also works.

---

### 3.4 PMx / PMxWeb input format

**Priority:** low.

**What I need:** PMx is the demographic analysis tool studbook keepers
run against their data. Its CSV input format is a real constraint on
what we need to track per-animal to be PMx-compatible.

**Concrete ask:** the PMx CSV input spec, or a sample input file. Often
in PMx training materials or SSP coordinator onboarding docs.

---

### 3.5 CARES priority species list — current dataset

**Priority:** high.

**What I need:** the authoritative current CARES list in CSV form. The
species records you're entering populations against should all have
`cares_status` set correctly on the Species row.

**Concrete ask:** the current CARES CSV (or a URL you can point me at).
If it's a list I can pull and diff against what's in the registry, I
can write a management command to reconcile automatically — say the
word.

---

### 3.6 SHOAL 1,000 Fishes Blueprint priority species

**Priority:** low-medium.

**What I need:** the current SHOAL 1,000 Fishes priority list for
Madagascar endemics. `Species.shoal_priority` is a boolean in the
model; it should reflect the current blueprint.

**Concrete ask:** the Madagascar subset of the 1,000 Fishes list.
Probably on shoalconservation.org or available on request. The
conversation SHOAL is hosting at ABQ may be the natural place to ask.

---

## 4. Workshop prep (ABQ, June 1-5, 2026)

### 4.1 Dry-run the coordinator dashboard demo

**Priority:** high, closer to event.

**Steps:** walk through `/dashboard/coordinator` end-to-end with real
seeded data, ideally in the week before ABQ. Check:
- All four panels populated and telling a coherent story
- "Show N more" on Panel 1 works with realistic list lengths
- Tier 3+ gating works (log in as a non-admin tier 3 user too)
- M.F.U formatting on Panel 3 reads sensibly with real ratios
- Panel 4 catches populations you know are overdue

**How to verify:** the person demoing (presumably you) can talk through
each panel without awkward empty states or visible bugs.

---

### 4.2 Decide: do you link `/dashboard/coordinator` from main nav for ABQ?

**Priority:** medium.

**Context:** currently the page is unlinked — you reach it by typing
the URL. We agreed the "obscurity + token" posture is fine through
ABQ. Before the workshop, decide whether the demo goes better linked
from nav (easier to navigate on stage) or unlinked (preserves the
"invited to see this" framing).

**If you decide to link it:** ping me and I'll add a nav entry —
it's a five-line change to `NavLinks.tsx`.

---

## 5. Things I explicitly haven't asked you to do

Listing these so you know they're not on your plate.

- **Backend code**: I write and test all of it in Docker locally.
- **Frontend code**: same — you don't need Node/pnpm running.
- **Migrations**: I generate them locally; they apply on staging
  automatically via the `deploy-staging` GitHub Actions workflow on
  every merge. You don't need to run `migrate` by hand unless the
  deploy workflow fails silently (OPERATIONS.md §12.6).
- **Running the seed**: ditto — the deploy action won't re-seed on
  every merge, but when a seed PR lands you'll see it called out in
  the PR body.
- **Writing tests**: I write the unit and integration tests.

---

## Done

_(Move items here with a strikethrough once completed, so we keep the
receipt without cluttering the active list. First entry will go here
once you close out 1.1.)_
