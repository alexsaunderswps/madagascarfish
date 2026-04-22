# Population Data Entry Guide

How to enter ex-situ population data so it surfaces on the Coordinator
Dashboard at `/dashboard/coordinator`.

**Admin URL:** https://api.malagasyfishes.org/admin/

---

## 0. What data lives where

At the top level, five models connect to make a coordinator view:

| Model | What it is | Who writes it |
|---|---|---|
| `Species` | The ~79 endemics | Seeded from CSV; curated by admin |
| `Institution` | A zoo / aquarium / hobbyist keeper / research org | You, through admin |
| `ExSituPopulation` | "Institution X holds species Y" — one per species-institution pair | You, through admin |
| `HoldingRecord` | Optional census snapshot for an `ExSituPopulation`, with counts on a date | You, or auto when you update population counts |
| `CoordinatedProgram` | Formal program (AZA SSP / EAZA EEP / CARES / independent) around a species | You, through admin |
| `Transfer` | Movement of animals between institutions — lifecycle from proposed → completed | You, through admin |

`CoordinatedProgram` and `Transfer` land in Gate 4. This guide covers
both the Gate 3 models (Species / Institution / ExSituPopulation /
HoldingRecord) and the Gate 4 additions.

---

## 1. Where each panel gets its data

| Panel | Reads from | Driven by which field(s) |
|---|---|---|
| **1 — Coverage gap** | `Species` ← *absence of* `ExSituPopulation` | `Species.iucn_status ∈ {CR, EN, VU}` AND no `ExSituPopulation` rows reference the species. Endemic toggle filters `Species.endemic_status`. |
| **2 — Studbook status** | `ExSituPopulation` grouped by species | `studbook_managed` (boolean) + `breeding_status` (enum). See §5 "How a species lands in each bucket." |
| **3 — Sex-ratio risk** | `ExSituPopulation` (one row per population) | `count_male`, `count_female`, `count_unsexed`. Flag thresholds in code: skew > 1:4, or unsexed fraction > 50%. |
| **4 — Stale census** | `ExSituPopulation` + `HoldingRecord` | `max(last_census_date, most recent HoldingRecord.date)`. Flag if that signal is > 12 months old, or never set. |

DD companion card on Panel 1 reads `Species.iucn_status = DD` — no population data needed.

**Species records are already seeded.** You don't need to add species; the
~79 endemics from `madagascar_freshwater_fish_seed.csv` are already in
the registry with IUCN / CARES / endemic status populated. Dashboard
panels light up as soon as you start adding `Institution` and
`ExSituPopulation` rows.

---

## 2. Prerequisites

- A Tier 3+ staff account (or superuser) in Django admin.
- A shared understanding of what counts as an "institution" — see §4 for
  the CARES-as-individuals pattern.

---

## 3. Institution types

`Institution.institution_type` is an enum. Pick the closest match —
this doesn't affect any gating today, but it does determine the label
the panels and directory show next to the name.

| Value | Intended for |
|---|---|
| `zoo` | Accredited zoo |
| `aquarium` | Accredited public aquarium |
| `research_org` | University lab, research station |
| `hobbyist_program` | Coordinated hobbyist program (the CARES umbrella, Citizen Conservation, regional breeding networks) |
| `hobbyist_keeper` | **Individual hobbyist** — a single person maintaining a population. Use this for CARES participants you're tracking as individuals. |
| `ngo` | Conservation NGO running captive work |
| `government` | Government fisheries agency |

Individual CARES keepers should go in as `hobbyist_keeper`, not
`hobbyist_program` — see §4.

---

## 4. CARES individual keepers (the common case)

**The pattern:** each CARES hobbyist keeper is their own `Institution`
row with `institution_type = hobbyist_keeper`. Each population that
keeper holds is its own `ExSituPopulation` row linking species →
keeper.

This keeps per-keeper fragility visible on the dashboard — Panel 2
"Holdings only" and Panel 3 "Sex-ratio risk" show the keeper name and
flag them independently, which is the whole point of treating them as
individuals rather than a bucket.

### Minimum fields for a keeper

| Field | What to enter |
|---|---|
| `name` | How the keeper wants to be credited. Full name, handle, or program ID — your call, but be consistent. |
| `institution_type` | `hobbyist_keeper` |
| `country` | Country of the keeper |
| `city` | Optional; omit if privacy-sensitive |
| `contact_email` | Visible **Tier 3+ only** per the model's help_text. Safe to fill in if the keeper consented. Leave blank otherwise. |
| `website` | Usually blank for individuals |
| `zims_member` / `eaza_member` / `aza_member` | Leave unchecked for individual keepers |
| `species360_id` | Leave blank |

### Suggested name convention

For individual keepers, a legible format beats a perfect one. Some
options that read well in dashboard tables:

- `J. Smith (CARES)` — initial + surname + program tag
- `Smith Household — CARES` — household attribution
- `CARES #4172` — program ID, if the keeper prefers anonymity

Pick a convention and stick to it per data-entry session. The name is
what appears on the dashboard's sex-ratio and stale-census tables, so
readability for a coordinator scanning at a workshop matters more than
formal correctness.

### Privacy posture

- `Institution.contact_email` is only serialized at Tier 3+ — public
  site hides it. Fine to store keeper emails here **with consent**.
- Keeper *addresses* are not in the model. If you need to track
  location, use `country` + `city` only.
- If a keeper wants to be fully anonymous, use a program-ID name and
  leave `contact_email` blank. The dashboard only ever displays
  `Institution.name`.

---

## 5. Workflow: record an ex-situ population

For every species-holder pair you want to surface on the dashboard:

1. Confirm the **species** exists in **Species → Species**. It almost
   certainly does; the registry has every described and undescribed
   endemic.
2. Confirm the **institution/keeper** exists in **Populations →
   Institutions**. If not, add it per §4.
3. Go to **Populations → Ex situ populations → Add**.
4. Fill in:

| Field | Notes |
|---|---|
| `species` | Autocomplete — type scientific name |
| `institution` | Autocomplete — type institution/keeper name |
| `count_total` | Total count; required-ish (nullable in the schema but Panel 3 reads it) |
| `count_male` / `count_female` / `count_unsexed` | M.F.U — fill all three when known. Dashboard shows `male.female.unsexed`. Leave all three blank for unsexed-only or unknown populations. |
| `date_established` | When this population was founded at this institution. Optional but useful. |
| `founding_source` | e.g. "wild-caught Nosivolo 2019", "split from Cologne F2". Free text. |
| `breeding_status` | `breeding` / `non-breeding` / `unknown`. See §6 for how this interacts with `studbook_managed`. |
| `studbook_managed` | Check **only** if there's a formal studbook keeper assigned and a coordinated plan. For CARES populations this is usually **unchecked** — that's what puts them in Panel 2's "breeding, not studbook" bucket, which is intentional. |
| `last_census_date` | Date you last counted the population. **Panel 4 watches this field** — if it's more than 12 months old, the population shows up as stale. |
| `notes` | Free text. Anything a coordinator should know. |

5. Save.
6. (Optional but recommended) On the species or institution list view,
   run the **"Revalidate public pages"** action. Without this, the
   public site's ISR cache may take up to an hour to show the new
   population. Admin saves on Species/Genus revalidate automatically;
   saves on Institution/ExSituPopulation do not yet — this is a minor
   gap to be closed later.

---

## 6. How a species lands in each Panel 2 bucket

For any species with ≥1 `ExSituPopulation` row:

| If… | Bucket |
|---|---|
| At least one population has `studbook_managed = True` | **Studbook-managed** |
| None studbook, but ≥1 has `breeding_status = 'breeding'` | **Breeding, not studbook** |
| None studbook, none breeding | **Holdings only** |

Species with zero `ExSituPopulation` rows are counted as
**No captive population** — those are the same species Panel 1 lists.

If a CARES keeper has a breeding population of a CR species and isn't
part of a studbook, that population lands the species in "Breeding,
not studbook" — which is the signal the four-bucket panel exists to
surface. Don't check `studbook_managed` to "promote" a keeper into
the tidier bucket; leave it accurate.

---

## 7. Workflow: logging a census snapshot

You have two options for recording "I counted this population on date
X and got these numbers":

### Option A — just update the ExSituPopulation (simplest)

Edit the `ExSituPopulation` row directly: change `count_total` /
`count_male` / `count_female` / `count_unsexed`, update
`last_census_date` to today, save. Panel 4 will no longer flag it as
stale.

**Use this when:** you don't need a history — you only care about the
current state.

### Option B — add a HoldingRecord (for time-series)

Open the `ExSituPopulation` row → scroll to the **Holding records**
inline at the bottom → add a row with the census date and new counts
→ save.

`HoldingRecord` is ordered by `-date`, so the most recent one is what
Panel 4 treats as the "latest holding" signal. You can leave
`last_census_date` stale as long as there's a recent `HoldingRecord`;
Panel 4 uses `max(last_census_date, latest holding)`.

**Use this when:** you want to track how a population has changed
over time (mortality events, breeding events, new acquisitions).

For the workshop demo, Option A is sufficient. Option B becomes more
useful once you're collecting CARES data quarterly and want to see
population trajectories.

---

## 8. Troubleshooting

### A population I added isn't showing up on the dashboard

1. Admin save succeeded? Check that the row exists at **Populations →
   Ex situ populations**.
2. The Coordinator Dashboard page is force-dynamic (re-fetches every
   request), but the Django API response itself may be cached. Wait a
   minute and refresh.
3. If you're looking at Panel 2 (studbook status), confirm the species
   you'd expect shows up in a bucket by looking at the four counts at
   the top — a new holding increments the bucket count even if the
   species list under it is long.

### A species I added a population for is still in Panel 1

Panel 1 shows species with **zero** populations. If you added a
population and the species still appears, reload the page (force
refresh). If it persists, double-check the `ExSituPopulation` row
actually points at the right species (autocomplete sometimes selects
a near-match).

### Panel 4 says a population is stale but I just updated it

Ensure you updated `last_census_date`, not just `count_total`. Panel 4
ignores count changes — it watches the date field.

### Panel 3 doesn't flag a population I expect to see

Confirm `count_male`, `count_female`, and `count_unsexed` are all
populated (not null). If all three are null, Panel 3 can't compute a
ratio and skips the row.

---

## 8.5 Gate 4 additions — CoordinatedProgram + Transfer

These two models capture the "who runs this" and "what's moving" layers
above `ExSituPopulation`. Added in Gate 4 Phase 1. Admin surfaces live
alongside the existing population models.

### CoordinatedProgram

One row per species per program framework. A species can appear in
multiple programs simultaneously (e.g. AZA SSP and CARES), but only
once per `program_type`.

**When to add one:** when a species has a formal breeding / conservation
program tracking it (AZA SSP, EAZA EEP, CARES priority listing, or an
independent regional program).

**Admin:** `/admin/populations/coordinatedprogram/add/`

Key fields:
- `species` — autocomplete
- `program_type` — `ssp` / `eep` / `cares` / `independent` / `other`
- `name` — human-readable, shown on the dashboard. Format guidance:
  *"AZA SSP: Common Name"*, *"EAZA EEP: Common Name"*,
  *"CARES: Common Name"*
- `status` — `planning` / `active` / `paused` / `deprecated`
- `coordinating_institution` — who holds the studbook
- `studbook_keeper` — if a named user is assigned
- `enrolled_institutions` (M2M) — partner zoos / keepers
- `target_population_size`, `plan_summary`, `plan_document_url`,
  `start_date`, `next_review_date` — plan-level metadata

### Transfer

One row per planned or completed animal movement between two
institutions.

**When to add one:** any time animals move between `Institution`
rows — whether that's a formal SSP transfer, a hobbyist moving a
founder pair, or an accession from the wild (with the collecting
institution as source). Use `status` to indicate where the transfer is
in its lifecycle.

**Admin:** `/admin/populations/transfer/add/`

Key fields:
- `species` / `source_institution` / `destination_institution` — all
  autocomplete. Source ≠ destination (enforced at the DB level).
- `status` — `proposed` / `approved` / `in_transit` / `completed` / `cancelled`
- `proposed_date` — when the transfer was first logged. Required.
- `planned_date` — when it's *scheduled* to happen. Optional.
- `actual_date` — when it *actually* completed. Set this when status
  moves to `completed`.
- `count_male` / `count_female` / `count_unsexed` — M.F.U convention
- `cites_reference` — permit number for CITES-listed species. Blank
  otherwise.
- `coordinated_program` — link to the program this transfer serves,
  if applicable.
- `notes` — anything else. Holding pens, quarantine details, etc.

**`created_by` auto-fills** to the admin user on save — not editable.

### Why these are separate from `ExSituPopulation`

`ExSituPopulation` is *current state* (counts per species per
institution today). `Transfer` is *movement* — even if the counts
don't change (e.g. a 1:1 swap), the transfer still happened. Both
matter to a coordinator. Don't manually edit `ExSituPopulation`
counts to reflect a transfer; log the `Transfer` row and update the
population's counts separately when the animals arrive.

---

## 9. Bulk import — `seed_populations`

For bulk CARES loads, use the `seed_populations` management command
instead of clicking each row through admin.

### CSV shape

One row = one population. Institutions are deduplicated by
`institution_name` — three rows with the same name create one
Institution and three populations attached to it.

| Column | Required | Notes |
|---|---|---|
| `institution_name` | yes | The dedup key |
| `institution_type` | no | Default `hobbyist_keeper`. Enum: `zoo`, `aquarium`, `research_org`, `hobbyist_program`, `hobbyist_keeper`, `ngo`, `government` |
| `country` | no | Default `"Unknown"` |
| `city` | no | |
| `contact_email` | no | Tier 3+ only on display |
| `species_scientific_name` | yes | Must already exist in the registry |
| `count_total` / `count_male` / `count_female` / `count_unsexed` | no | Integers, blanks OK |
| `breeding_status` | no | Enum: `breeding` / `non-breeding` / `unknown`. Default `unknown` |
| `studbook_managed` | no | Boolean. Accepts `true/false/yes/no/1/0`. Default `false` |
| `last_census_date` / `date_established` | no | `YYYY-MM-DD` |
| `founding_source`, `notes` | no | Free text |

Convention for CARES hobbyist rows: `institution_type=hobbyist_keeper`,
`studbook_managed=false`, set `last_census_date` to the date your
CARES data was collected.

### Example row

```csv
institution_name,institution_type,country,species_scientific_name,count_total,count_male,count_female,count_unsexed,breeding_status,studbook_managed,last_census_date
J. Smith (CARES),hobbyist_keeper,United States,Paretroplus menarambo,10,4,5,1,breeding,false,2026-04-15
```

### Running it on staging

SSH in and drop the CSV at `data/seed/populations.csv` on the host
(SCP from your laptop or edit with `nano` on the server):

```bash
ssh deploy@46.224.196.197
cd /home/deploy/madagascarfish/deploy/staging

# Dry-run first — parse + validate, roll back all DB changes
docker compose exec -T web python manage.py seed_populations \
  --csv /data/seed/populations.csv --dry-run

# Review the output, then the real run
docker compose exec -T web python manage.py seed_populations \
  --csv /data/seed/populations.csv
```

The command is **idempotent**: re-running with the same CSV updates
existing rows rather than duplicating them. Dedup keys are
`Institution.name` and `(species, institution)` for populations.

### Error handling

- Rows with invalid enums or missing required fields are **skipped
  individually** — the rest of the CSV still loads. Errors print to
  stderr (first 50, then a suppressed-count line).
- Rows referencing a species scientific name that's not in the
  registry are skipped with a `species not found` error.

### What it does NOT do

- Doesn't touch `HoldingRecord` — populations get current-state
  counts, historical census snapshots are admin-only.
- Doesn't touch `CoordinatedProgram` or `Transfer` — those stay
  admin-only.

---

## 10. See also

- [`OPERATIONS.md`](../OPERATIONS.md) — staging runbook, shared
  secrets, revalidate webhook
- [`ADMIN_GUIDE.md`](../ADMIN_GUIDE.md) — general admin reference,
  not population-specific
- [`CLAUDE.md`](../CLAUDE.md) — access tiers, sensitive data rules
