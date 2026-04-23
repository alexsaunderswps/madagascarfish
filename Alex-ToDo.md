# Alex's To-Do List

This document is the single running punch list of things only you can do —
configuration steps that need your hands on a credential, data entry that
needs your domain judgment, or reference lookups that help steer the next
round of development. I'll maintain it as items land or become obsolete.

**How to use this file:**

- Items are grouped by type, not by priority. The **Priority** line inside
  each item is what ranks them.
- Each item says what to do, why it matters, and how to verify it's done.
- **Don't delete completed items** — move them to the "Done" section at
  the bottom with a short note on what it unlocked.

**Last updated:** 2026-04-23 (reference PDFs dropped into `data/reference/`;
§3 restructured to show which arrived, new §2.7 added with concrete
EAZA-derived programs to seed).

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

**Concrete steps to start (manual admin path):**

1. Sign in to <https://api.malagasyfishes.org/admin/> as a Tier 5
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

4. After a batch of entries, the admin save hook now auto-triggers
   "Revalidate public pages" — the public site and dashboard refresh
   immediately instead of waiting up to an hour for ISR.

**How to verify:** open `/dashboard/coordinator` — Panel 2 should move
species out of "No captive population" into whichever bucket fits
(holdings-only, breeding-not-studbook, or studbook-managed).

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

1. <https://api.malagasyfishes.org/admin/species/specieslocality/>
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

1. <https://api.malagasyfishes.org/admin/populations/coordinatedprogram/add/>
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

**See also §2.7 below — a starter list of real EEPs you can seed
straight from the April 2026 EAZA programme overview.**

---

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

1. <https://api.malagasyfishes.org/admin/populations/transfer/add/>
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

---

### 2.6 Audit existing `studbook_managed` checkboxes

**Priority:** low. Panel 2's "Studbook-managed" bucket reads this flag
directly. If any existing `ExSituPopulation` rows have it set
incorrectly (e.g. CARES populations that should be in
"breeding_not_studbook"), the bucket counts will be misleading.

**Steps:**

1. <https://api.malagasyfishes.org/admin/populations/exsitupopulation/>
2. Filter: **"Studbook managed: Yes"**
3. For each row, ask yourself: "Is there a formal studbook keeper
   assigned and a coordinated plan?" If no, uncheck.

**How to verify:** Panel 2 on the coordinator dashboard shows counts
that match your mental model.

---

### 2.7 Seed real EAZA EEPs from the April 2026 programme overview

**Priority:** medium-high for ABQ. These are **real, public** program
entries — not demo data — and they make Panel 2 and Panel 5 feel
meaningfully populated even before CARES data lands.

**Source:** `data/reference/April_2026_8e69dc12b4.pdf` (EAZA Ex-situ
Programme overview, April 2026, rows 31 and 36 on page 1). These are
the only two EEPs that directly touch Madagascar endemic freshwater
fish families on the list.

**Rows to enter** (all via
<https://api.malagasyfishes.org/admin/populations/coordinatedprogram/add/>):

| Field | Value #1 | Value #2 |
|---|---|---|
| Species | Pick one Bedotiidae species as the anchor (e.g. *Bedotia madagascariensis*) — or the whole family if we model that later | Pick one Paretroplus species as the anchor (e.g. *Paretroplus menarambo*) |
| Program type | `eep` | `eep` |
| Name | `EAZA EEP: Madagascar rainbowfishes (Bedotiidae)` | `EAZA EEP: Cichlids (Cichlidae)` |
| Status | `active` | `active` |
| Coordinating institution | Create `Bristol Zoo Project` (type `zoo`, country `United Kingdom`) if not present | Create `National Aquarium Denmark` (type `aquarium`, country `Denmark`) |
| Studbook keeper | Blank unless Charles Fusari / Peter Petersen get accounts | Blank |
| Plan summary | "EAZA EEP for the Bedotiidae rainbowfish family. Coordinator: Charles Fusari (Bristol Zoo Project). IUCN: EN. As of April 2026 EAZA overview." | "EAZA EEP for the Cichlidae family. Coordinator: Peter Petersen (National Aquarium Denmark). IUCN: CR. As of April 2026 EAZA overview." |
| Start date | Blank (not given in the overview) | Blank |

**Note:** Our `CoordinatedProgram.species` is currently a single FK, so
"family-level" EEPs need a stand-in species row. Pick the one most
representative or that you have the most captive data for. Post-ABQ we
can extend the model to carry family-level programs (Gate 4 Phase 2
decision).

**Other EAZA EEPs worth noting (from the same overview):**

Not Madagascar-endemic but tangentially relevant:

- **Goodeids (Goodeidae)** — Chester Zoo, Joe Chattell, EW-EN. Good
  reference for CARES-adjacent hobbyist programs; see
  `Action-Plan-for-the-Conservation-of-Mexicos-Goodeid-Fishes-23-33.pdf`.
- **Sail-fin silversides / Pseudomugilidae** — Jens Bohn, CR-DD.
- **Toothcarps (Valenciidae)** — Bristol Zoo Project, Brian Zimmerman, CR.

These are not Madagascar species, so don't enter them against our
registry — but they're useful context if someone at ABQ asks "who else
runs freshwater-fish EEPs."

**How to verify:** `/dashboard/coordinator` Panel 2 shows non-zero
"Studbook-managed" or "Breeding, not studbook" counts; Panel 5
"in flight" stays empty until you log Transfers.

---

### 2.8 Enter BreedingRecommendation rows

**Priority:** medium for ABQ demo narrative. Panel 6 on the coordinator
dashboard ("Open breeding recommendations") only renders what's in this
table — empty until you log.

**What it is:** `BreedingRecommendation` is the coordinator's to-do
list. Landed in Gate 4 Phase 2. Each row captures one recommendation
for a species (or a specific population of that species) with a
priority, type, and lifecycle status. Shaped against the EAZA
Population Management Manual §3.14 three-category cut and the AZA SSP
Handbook Chapter 4 Breeding and Transfer Plans structure.

**When to add a row:**

- A coordinated program (SSP / EEP / CARES) has published a plan and
  recommends a specific species-level action (breed, hold, transfer).
- A working-group meeting produced an action item with an owner and
  a due date.
- You as coordinator want to log "this population needs breeding
  intervention" so it surfaces on the dashboard for follow-up.

**Steps:**

1. <https://api.malagasyfishes.org/admin/populations/breedingrecommendation/add/>
2. Fill in the **What** section:
   - **Species**: autocomplete
   - **Recommendation type**: `breed` / `non_breed` / `transfer` / `other`.
     (Use `transfer` when the plan calls for moving animals; a matching
     Transfer row in §2.5 is the operational execution.)
   - **Priority**: `critical` / `high` / `medium` / `low`.
     Critical lights up red on the dashboard; use sparingly.
   - **Rationale**: free text — why this recommendation exists. Copy
     from SSP/EEP plan, working-group minutes, or your own note.
3. **Who / where** (all optional):
   - **Coordinated program**: link to the SSP/EEP/CARES row this
     recommendation was issued under, if any (§2.4 entries).
   - **Source population**: the specific `ExSituPopulation` this
     applies to, when the rec is population-specific (e.g. "breed
     Bristol's menarambo pair").
   - **Target institution**: who the rec is directed to, when it's
     directed. Null for coordinator-wide calls.
4. **Lifecycle**:
   - **Status**: start at `open`; flip to `in_progress` when the
     target institution starts work; `completed` / `superseded` /
     `cancelled` are terminal.
   - **Issued date**: required. When the recommendation was issued.
   - **Due date**: optional. If set AND in the past, the dashboard
     tags the row as overdue.
   - **Resolved date** / **outcome notes**: fill in at terminal
     transition.
5. Save. `issued_by` auto-fills to you on create; `resolved_by`
   auto-fills when you move status to a terminal state.

**How to verify:** `/dashboard/coordinator` → Panel 6 "Open breeding
recommendations" shows the row sorted by priority (critical first).
Completed / superseded / cancelled rows drop out of the panel.

---

### 2.9 Log BreedingEvent rows as events happen

**Priority:** low for ABQ but high ongoing — this is the ledger that
makes longitudinal analysis possible post-ABQ.

**What it is:** `BreedingEvent` is the per-population event log.
Landed in Gate 4 Phase 2. One row per discrete event: spawning,
hatching, mortality, acquisition, disposition. Count deltas are
**signed** — a three-male mortality is `count_delta_male = -3`, a
thirty-fry hatch is `count_delta_unsexed = +30`. The table is a
ledger; it doesn't auto-update `ExSituPopulation.count_*`.

**When to add a row:**

- A spawning / hatching event occurs (fish ex-situ is almost
  exclusively oviparous — log both the spawn and later the hatch
  as separate rows).
- A mortality event (individual or group).
- Animals arrive from another institution or the wild (acquisition).
- Animals leave (disposition) outside the Transfer lifecycle — e.g.
  euthanasia, escape, loss to natural cause.

**Steps:**

1. <https://api.malagasyfishes.org/admin/populations/breedingevent/add/>
2. Fill in:
   - **Population**: autocomplete (species at institution).
   - **Event type**: the six-value enum above.
   - **Event date**: when it actually happened.
   - **Count deltas** (all signed, all optional):
     - A spawning with no immediate recruit: leave deltas blank.
     - A hatching that produced 30 fry: `count_delta_unsexed = 30`.
     - A mortality of 2 females + 1 male: `count_delta_male = -1`,
       `count_delta_female = -2`.
     - An acquisition of 5 males + 5 females: `count_delta_male = 5`,
       `count_delta_female = 5`.
   - **Notes**: anything relevant. Water conditions, clutch size,
     mortality cause.
3. Save. `reporter` auto-fills to you.

**What this does NOT do:** the event row is the ledger — it doesn't
adjust the running `ExSituPopulation.count_total` / `count_male` /
etc. Update those separately in the population's admin page after
logging the event. The split is intentional: events are immutable
history; counts are current state.

**How to verify:** open the population in admin
(`/admin/populations/exsitupopulation/<id>/`) — the inline at the
bottom of the page lists the population's breeding events in
reverse-chronological order.

**No dashboard panel yet.** Events are for the record, not the
coordinator triage view. A Gate 4 Phase 3 "recent reproductive
activity" panel is plausible once you have enough events logged
that it'd read as a trend line instead of a sparse list.

---

### 2.10 Reconcile SHOAL priority flags using the worklist report

**Priority:** medium. Not blocking ABQ, but gets the public species
directory and dashboard captions accurate about which species carry
SHOAL's priority flag.

**What it is:** a read-only management command (`shoal_priority_report`)
that diffs `data/reference/ActiveShoalPriorityMadagascar.csv` against
the registry and prints three lists. It makes no writes — you use the
output as a worklist to manually flip `Species.shoal_priority` in
admin, reviewing each flip against the current SHOAL website or
published list.

**Why the manual gate:** the CSV has no version / provenance metadata,
taxonomy drift (`Pachypanchax omalonota` vs `omalonotus`) will cause
false negatives on direct string match, and 8 species currently
flagged in the registry aren't in the CSV. An auto-sync risks
silently un-flagging species that should stay flagged.

**Run it** (on staging or locally):

```bash
docker compose exec -T web python manage.py shoal_priority_report \
  --csv /data/reference/ActiveShoalPriorityMadagascar.csv
```

The output has three sections:

- **In CSV, not flagged True in registry** — candidates to flip True.
- **Flagged True in registry, not in CSV** — candidates to review (flip
  False? or CSV is stale?).
- **In CSV, not in registry at all** — likely taxonomy drift or missing
  species in our seed; investigate before adding.

**Workflow:**

1. Run the command. Save the output.
2. For each entry in list #1: open
   `/admin/species/species/?q=<scientific name>` and flip
   `shoal_priority = True` if SHOAL's current website still lists them.
3. For each entry in list #2: check if SHOAL removed them in a newer
   list. If yes, flip False. If unclear, leave as-is.
4. For each entry in list #3: check taxonomy (is it a synonym of
   something we have?) — the `Pachypanchax omalonota` vs `omalonotus`
   pattern is the most likely culprit. If it's a real missing species,
   it should be added via the species seed process, not this command.

**When to re-run:** when SHOAL publishes an updated priority list.
Annually at most.

---

## 3. Reference documents

### 3.1 Received and parsed (April 2026 batch)

The following arrived in `data/reference/` on 2026-04-23 and have been
skimmed. Each closes a previous "need" item in this section.

| File | What it is | What it unlocks |
|---|---|---|
| `April_2026_8e69dc12b4.pdf` | EAZA Ex-situ Programme overview, April 2026 — the live registry of every EEP with coordinator + institution + IUCN status | **§2.7 above** — two concrete EEPs to seed right now (Bedotiidae, Cichlidae). Supersedes the §3.2 ask. |
| `aza_ssp_handbook.pdf` | AZA Species Survival Plan Program Handbook (2024 revision) | Settles §3.1. Phase 2 model shape for `BreedingRecommendation` will follow the "Breeding and Transfer Plan" structure from Chapter 4; sustainability designations (green/yellow/red SSP) informs a future enum. |
| `EAZA_Population_Management_Manual_V6_2_67db7a6627.pdf` | EAZA Population Management Manual V6.2 (Jan 2025) | Settles §3.2. Introduces the TAG → EEP → Species Committee hierarchy and the Long-Term Management Plan (LTMP) concept; also distinguishes EEP (intensive) from ESB (European Studbook, less intensive). Phase 2 may add `program_type='esb'` and an optional TAG layer above `CoordinatedProgram`. |
| `starting_a_new_aza_studbook_in_zims_for_studbooks_2023.pdf` | ZIMS for Studbooks — SSP startup workflow | Partial for §3.3. Covers the operator workflow, not the field-level schema. |
| `how_to_publish_a_studbook_using_zims_for_studbooks_mac.pdf` | ZIMS for Studbooks — publication workflow | Same as above. |
| `guidelines_for_data_entry_and_maintenance_1996.pdf` | Studbook data entry guidelines (1996, SPARKS era) | Dated but useful — the per-animal field list is essentially stable. Informs `BreedingEvent` shape. |
| `Action-Plan-for-the-Conservation-of-Mexicos-Goodeid-Fishes-23-33.pdf` | Goodeid Action Plan 2023-2033 | Domain analog — Mexican Goodeids are a parallel hobbyist-heavy CARES-adjacent case. Useful for workshop narrative but doesn't change the data model. |
| `ActiveShoalPriorityMadagascar.csv` | SHOAL Priority Species — active Madagascar subset (44 rows) | Settles §3.6. A `reconcile_shoal_priority` management command can diff this against the registry and flip `Species.shoal_priority=True` for matches. Good half-day task when you want to run it. |

**What this let me do:** Gate 4 Phase 2 landed on 2026-04-23 with
`BreedingRecommendation` + `BreedingEvent` models shaped against the
AZA Breeding and Transfer Plan structure (Chapter 4 of the SSP
Handbook) and the EAZA annual recommendations categories (breed /
non-breed / transfer, per §3.14 of the EAZA manual). Data entry
workflows for both are in §2.8 and §2.9 above.

### 3.2 Still outstanding

| Ask | Priority | Notes |
|---|---|---|
| **Current CARES priority species list — CSV** | high | The EAZA overview isn't this. Need the authoritative CARES list as a CSV (or URL) so I can diff against `Species.cares_status` and reconcile. If you have access to the CARES database or maintainer, request. |
| **PMx / PMxWeb input format** | low | Only matters if we want the platform to export directly into PMx for demographic analysis. Not blocking ABQ or Phase 2. |
| **ZIMS field dictionary (not just workflow)** | low-medium | The two ZIMS PDFs cover the operator workflow. A per-module field schema (CSV export column list or PDF dictionary) would let us shape models to be ZIMS-exportable in the future. Nice to have, not essential. |

---

## 4. Workshop prep (ABQ, June 1-5, 2026)

### 4.1 Dry-run the coordinator dashboard demo

**Priority:** high, closer to event.

**Steps:** walk through `/dashboard/coordinator` end-to-end with real
seeded data, ideally in the week before ABQ. Check:

- All five panels populated and telling a coherent story (Panel 5 is
  Transfer activity; don't forget it)
- "Show N more" on Panel 1 works with realistic list lengths
- Tier 3+ gating works (log in as a non-admin tier 3 user too)
- M.F.U formatting on Panel 3 reads sensibly with real ratios
- Panel 4 catches populations you know are overdue
- Coordinator nav link highlights correctly when you're on the page
  (and doesn't double-highlight with Dashboard)

**How to verify:** the person demoing (presumably you) can talk through
each panel without awkward empty states or visible bugs.

### 4.2 Decide whether to keep the Coordinator nav link visible at ABQ

**Priority:** low. The link is live as of PR #102 — anyone on the site
sees it. You can still hide it before the demo if the "invited to see
this" framing matters more than discoverability.

**If you want to hide it for ABQ:** ping me and I'll drop the nav entry
on a short branch; can put it back after the workshop. Keeping it
visible is the default.

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

Completed items are archived here. We keep the full how-to for each so
there's a runbook to refer back to when something needs to be re-done
(e.g. secret rotation). Newest at the top.

### 1.2 Verify the revalidate webhook is configured — DONE

**Completed:** 2026-04-22.
**Unlocks:** admin saves on Species / Genus / Institution /
ExSituPopulation / SiteMapAsset immediately refresh the public site
and coordinator dashboard; no more 1h ISR stale window.

Runbook in case of secret rotation (same pattern as 1.1, different
names):

- **Vercel env:** `REVALIDATE_SECRET` = `<secret>`
- **Staging `.env`:**

  ```
  NEXT_REVALIDATE_URL=https://malagasyfishes.org/api/revalidate
  NEXT_REVALIDATE_SECRET=<same value as Vercel's REVALIDATE_SECRET>
  ```

- `docker compose up -d --force-recreate web`

**Verification:** edit any species in admin and save. The green banner
should read "Revalidated N path(s)." If it says "Revalidate is not
configured..." the backend env vars aren't set or the container wasn't
recreated. OPERATIONS.md §11.1.

### 1.1 Set `COORDINATOR_API_TOKEN` on Vercel + staging backend — DONE

**Completed:** 2026-04-22.
**Unlocks:** `/dashboard/coordinator` renders panel data from the
Tier 3+ API endpoints without a user session (service-token SSR).

Runbook in case of secret rotation:

1. Generate a secret on your laptop:

   ```bash
   openssl rand -hex 32
   ```

2. **Vercel** (Project Settings → Environment Variables):
   - Key: `COORDINATOR_API_TOKEN`
   - Value: the hex string
   - Environments: **Production** (+ Preview if you want preview
     branches to fetch coordinator data)
   - Save, then redeploy the project.

3. **Staging backend** — SSH in and edit the compose `.env`:

   ```bash
   ssh deploy@46.224.196.197
   cd /home/deploy/madagascarfish/deploy/staging
   nano .env
   ```

   Add / update:

   ```
   COORDINATOR_API_TOKEN=<same hex string>
   ```

   Save, then recreate the web container:

   ```bash
   docker compose up -d --force-recreate web
   ```

**Verification:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer <your token>" \
  https://api.malagasyfishes.org/api/v1/coordinator-dashboard/stale-census/
```

Should print `200`. Without the header it should print `403`.

Full runbook: OPERATIONS.md §11.2.

### 2.2 Re-upload silhouettes for Paretroplus menarambo + P. nourissati — DONE

**Completed:** 2026-04-22.
**Unlocks:** species-specific silhouettes render on the directory card
and profile page for both species; no more placeholder fish.

The admin SVG file picker (PR #86) made this a drag-and-drop: open the
species in `/admin/species/species/`, use the "Upload .svg file
(optional)" field in the Silhouette section, save.

### 3.1 / 3.2 / 3.3 (partial) / 3.6 reference documents — DONE on 2026-04-23

See §3.1 above for the received-docs table. Remaining outstanding
asks moved to §3.2.
