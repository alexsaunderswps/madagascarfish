# Data Entry Guide

How to enter and maintain conservation data on the Madagascar Freshwater
Fish Conservation Platform — populations, breeding events, field
programs, and census snapshots — across both the **self-service web
surface** (institution staff at Tier 2) and the **Django admin**
(coordinators at Tier 3+).

**Public site:** https://malagasyfishes.org/
**API + admin:** https://api.malagasyfishes.org/
**Admin URL:** https://api.malagasyfishes.org/admin/

---

## 0. Two data-entry surfaces

The platform offers two paths into the same models. Pick by who you are:

| If you are… | Use… | Why |
|---|---|---|
| Institution staff (CARES keeper, zoo / aquarium employee, NGO field worker) | **Self-service web surface** at `/dashboard/institution/` | One-screen workflows. No admin training required. Audit-logged. |
| Conservation coordinator (Tier 3+) | **Django admin** at `/admin/`, plus the same self-service surfaces | Cross-institution edits, claim approvals, bulk imports, transfer / recommendation lifecycle. |
| One-off bulk load | `seed_populations` management command (§13) | Idempotent CSV import — see §13. |

Both paths write to the same database. Tier 2 keepers maintain their own
institution's data; Tier 3+ coordinators see and edit everything.

**Both paths write to the audit log.** Every change records the actor's
user account, their institution at edit time, and the field-level
before/after — visible in Django admin under *Audit → Audit entries*
and exportable as CSV (§12).

---

## 1. Models, in plain English

| Model | What it is | Who writes it |
|---|---|---|
| `Species` | The ~79 endemic freshwater fish | Seeded; curated by admins |
| `Institution` | A zoo, aquarium, hobbyist keeper, NGO, or research org | Coordinators (admin) |
| `PendingInstitutionClaim` | A user's request to be associated with an institution — coordinator-reviewed | Created automatically at signup; reviewed via admin |
| `ExSituPopulation` | "Institution X holds species Y" — one per species/institution pair | Tier 2 staff (self-service) or coordinators (admin) |
| `HoldingRecord` | Optional historical census snapshot for a population | Coordinators (admin); falls back to `last_census_date` on the parent if unused |
| `BreedingEvent` | Time-series reproductive / demographic event (spawning, hatching, mortality, acquisition, disposition) | Tier 2 staff (self-service) or coordinators |
| `FieldProgram` | In-situ conservation program (monitoring, restoration, community management) | Tier 2 staff at the lead institution, or coordinators |
| `CoordinatedProgram` | Formal ex-situ program framework (AZA SSP / EAZA EEP / CARES / independent) | Coordinators (admin) |
| `Transfer` | Movement of animals between institutions, lifecycle from proposed → completed | Coordinators (admin) |

The species list is preloaded — you don't need to add species. Public
profiles for every endemic species already exist; data entry is about
who holds what, who's running what, and what's happening.

---

## 2. Account creation → institution claim → approved access

The self-service flow starts with a user account that's tied to one
institution. The flow:

1. **Register at `/signup`.** Email, name, password. Optionally select
   an institution from the searchable list ("Aquarium A", "Citizen
   Conservation"…).
2. **Verify your email** via the link the platform sends.
3. **Claim is queued.** Selecting an institution at signup creates a
   `PendingInstitutionClaim` row; `User.institution` stays NULL until a
   coordinator approves it. You can sign in immediately, but the "My
   institution" dashboard isn't visible yet.
4. **Coordinator approves.** A coordinator reviews the claim in admin
   (§3), approves, and you receive an email confirmation.
5. **Self-service unlocks.** Within 5 minutes of next sign-in, the
   "My institution" link appears in the top nav, pointing to
   `/dashboard/institution/`.

If you skipped the institution selection at signup, contact a
coordinator with the institution you'd like to be associated with —
they can create the claim and approve it in one step.

### Claim lifecycle states (visible on `/account`)

| State | Meaning | Next action |
|---|---|---|
| `none` | No claim submitted | Submit one from `/account` (or contact a coordinator) |
| `pending` | Claim awaiting coordinator review | Wait — you'll be emailed when it's reviewed |
| `approved` | Membership active | "My institution" appears in the nav |
| `rejected` | Coordinator declined; reason in the email | Contact the coordinator with more context, or submit a fresh claim for a different institution |
| `withdrawn` | You cancelled a pending claim | Submit a fresh claim |

---

## 3. Coordinator workflow: approving institution claims

Tier 3+ only. Path: **Django admin → Accounts → Pending institution
claims**.

1. List view shows all claims — filter by `status` and `institution`.
2. Select one or more pending rows.
3. Choose **"Approve selected pending claims"** or **"Reject selected
   pending claims"** from the actions dropdown → click *Go*.
4. Approval atomically sets `User.institution`, flips the claim to
   `APPROVED`, captures `reviewed_by` + `reviewed_at`, and emails the
   user.
5. Rejection captures `review_notes` (used as the email rejection
   reason) and leaves `User.institution` NULL.

**You cannot approve your own claim.** The service-layer guard
(`accounts/services.py`) blocks self-approval; ask a fellow coordinator
if you need access to your own institution. Superusers are exempted as
a break-glass.

Add and delete are restricted to superuser only — claims are created
through signup and exist as append-only history. If a row needs
removing, ask a superuser.

---

## 4. Self-service: editing your institution's populations

Path: **Sign in → top-nav avatar / My institution → `/dashboard/institution/`**.

The institution dashboard renders three sections:

1. **Aggregate panel** (top) — populations, species, breeding events
   logged in last 12 months, fresh-census ratio. Per-species share
   bars showing your institution's slice of global captive holdings
   for each species you maintain.
2. **Recent activity feed** — last 25 audit entries for your
   institution. Sky-blue dot = your team; amber dot + "coordinator
   override" tag = a coordinator edited one of your records.
3. **Populations table** — every `ExSituPopulation` your institution
   owns.

### Editing a population

Click the **Edit** link on any row. The form covers eight fields —
the only ones a Tier 2 staffer can write:

| Field | Notes |
|---|---|
| `count_total` | Best total at last census. Integer; blank allowed. |
| `count_male` / `count_female` / `count_unsexed` | M.F.U convention. Fill all three when known; leave all three blank if you can't sex the population. The coordinator dashboard's sex-ratio panel skips populations with all-NULL counts. |
| `breeding_status` | `breeding` / `non-breeding` / `unknown`. Drives the "Breeding, not studbook" bucket on the coordinator dashboard. |
| `last_census_date` | When you last counted. **The coordinator stale-census panel watches this** — populations older than 12 months flag as stale. Update this whenever you do a recount. |
| `notes` | Free text up to 10,000 characters. Anything a coordinator should know. |
| `studbook_managed` | Check **only** if a formal studbook keeper is tracking this population. Most CARES populations are not studbook-managed. Don't promote a population to "studbook" just to get out of a panel — that hides legitimate signal. |

Fields you can't edit through self-service:
- `species`, `institution` (changing these would re-attribute the
  population — coordinator-only).
- `date_established`, `founding_source` (set at creation).
- `last_edited_at` / `last_edited_by_user` / `last_edited_by_institution`
  (denormalized columns set by the audit hook on save).

### What happens when you save

- The row updates in the database.
- One `AuditEntry` row is written with the field-level before/after
  diff and your institution snapshotted onto `actor_institution`.
- The denormalized "last edited by" columns update so the coordinator
  dashboard can show "Last edited: Aquarium A staff · 2 days ago" on
  its stale-census panel.

If you change a field, then save without changing anything else later,
the second save writes no audit row (no-op).

### Adding a brand-new population

Self-service can't create new `ExSituPopulation` rows yet — that goes
through admin (§7) so the coordinator can verify the species/institution
combination. Tier 2 keepers see only populations a coordinator has
already registered for them.

---

## 5. Self-service: logging breeding events

Path: **`/dashboard/institution/breeding-events/`**.

Use this for time-stamped reproductive and demographic events — the
ledger of what happened to which population on which date.

### Event types

| Type | When to use |
|---|---|
| `spawning` | Eggs laid / nest observed; pre-hatch |
| `hatching` | Fry / juveniles emerged; counted |
| `mortality` | Animals lost — record signed negative deltas |
| `acquisition` | Animals brought in (new founders, transfer in) |
| `disposition` | Animals leaving (transfer out, mortality archived elsewhere) |
| `other` | Catch-all — annotate in notes |

### Fields

- **Population** — pick from your institution's populations.
- **Event type** — see above.
- **Event date** — when it happened.
- **Δ Males / Δ Females / Δ Unsexed** — *signed* count deltas.
  Negative for mortalities. Leave blank for events that don't change
  the count (e.g. a spawning that hasn't hatched yet).
- **Notes** — water chemistry, parents, conditions, anything worth
  knowing later.

### Append-only by convention

Events are a ledger. The platform doesn't expose PATCH or DELETE on
breeding events — corrections happen by posting a follow-up event with
explanatory notes. This matches studbook practice.

Server-side: `reporter` is set automatically from your account; you
can't spoof it. Cross-institution attempts (a Tier 2 keeper at
Aquarium A trying to log an event for a population at Aquarium B) are
rejected with 403.

---

## 6. Self-service: managing field programs

Path: **`/dashboard/institution/field-programs/`**.

In-situ work — surveys, monitoring, community management,
reintroduction. The page splits into "Your programs" (where your
institution is lead OR partner) and "Other programs in the registry."

### Creating a new program

Click **+ Start a new field program**. Required: name, region,
status. Optional: description, start date.

Your institution is automatically set as `lead_institution` —
coordinators handle re-attribution if the program later changes hands.

### Editing an existing program

Click **Edit** on a program led by your institution. Editable fields:

- `name`, `description`, `region`
- `status` — `planned` / `active` / `completed`
- `start_date`, `end_date`
- `funding_sources` — free text
- `website` — public-facing URL

Editable by Tier 2 only when your institution is the **lead**. Partner
participation is read-only from this surface; coordinators manage
partner memberships in admin.

### What's NOT editable here

- `lead_institution` — re-attribution would let an institution claim
  another's program. Coordinator-only via admin.
- `focal_species` — many-to-many with `Species`. Coordinator-only.
- `partner_institutions` — many-to-many with `Institution`.
  Coordinator-only.

These three are surfaced as read-only context in the program card.

---

## 7. Coordinator workflow: registering a population (admin)

When a new institution starts holding a species, a coordinator (Tier
3+) registers the population row in admin. After that, the institution
staff edit it through self-service.

1. Confirm the **species** exists at **Species → Species**.
2. Confirm the **institution** exists at **Populations → Institutions**;
   create it if needed (§9).
3. Go to **Populations → Ex situ populations → Add**.
4. Fill in `species`, `institution`, plus the same eight fields a
   Tier 2 staffer would edit (§4).
5. Save.

The institution's keepers can edit the row from `/dashboard/institution/`
on their next sign-in (assuming they have an approved claim).

### Optional: revalidate public pages after a coordinator change

If you want the public dashboard / species profile to update
immediately rather than waiting for ISR, run the **"Revalidate public
pages"** action from the species or institution list. (Saves on
populations don't auto-revalidate yet; this is a known minor gap.)

---

## 8. Recording a census snapshot

Two options for "I counted this population on date X and got these
numbers":

### Option A — update the population (simplest)

Tier 2 keeper or coordinator: edit the population row (self-service or
admin), change the four count fields, set `last_census_date` to today,
save. The coordinator dashboard's stale-census panel re-evaluates on
the next render.

### Option B — add a HoldingRecord (for time-series)

Coordinator only. Open the `ExSituPopulation` row in admin → scroll to
the **Holding records** inline → add a row with the census date and
counts → save.

Panel 4 of the coordinator dashboard reads
`max(last_census_date, latest holding record date)`, so as long as
either signal is recent, the population isn't flagged stale.

For most workflows, Option A is enough. Option B matters when you want
to see a population's trajectory over time.

---

## 9. Coordinator workflow: institution types

`Institution.institution_type` is an enum. Pick the closest match —
this drives the type label shown next to the institution name on the
public dashboard.

| Value | Intended for |
|---|---|
| `zoo` | Accredited zoo |
| `aquarium` | Accredited public aquarium |
| `research_org` | University lab, research station |
| `hobbyist_program` | Coordinated hobbyist program (CARES umbrella, Citizen Conservation, regional breeding networks) |
| `hobbyist_keeper` | **Individual hobbyist** — a single person maintaining a population |
| `ngo` | Conservation NGO running captive work |
| `government` | Government fisheries agency |

Individual CARES keepers should land as `hobbyist_keeper`, not
`hobbyist_program` — it keeps per-keeper fragility visible on the
sex-ratio and stale-census panels.

### CARES keeper minimum-fields

| Field | What to enter |
|---|---|
| `name` | How the keeper wants to be credited. `J. Smith (CARES)` or `CARES #4172` both work — pick a convention and stick to it. |
| `institution_type` | `hobbyist_keeper` |
| `country` | Country of the keeper |
| `city` | Optional; omit if privacy-sensitive |
| `contact_email` | Visible **Tier 3+ only**. Safe to fill in if the keeper consented. |
| `website` | Usually blank for individuals |
| `zims_member` / `eaza_member` / `aza_member` | Leave unchecked for individual keepers |

---

## 10. How the coordinator dashboard reads your data

Quick map from data entry to coordinator-dashboard panels:

| Panel | Reads from | Driven by |
|---|---|---|
| 1 — Coverage gap | `Species` ← *absence of* `ExSituPopulation` | `Species.iucn_status ∈ {CR, EN, VU}` AND no populations |
| 2 — Studbook status | `ExSituPopulation` grouped by species | `studbook_managed` boolean + `breeding_status` enum (§11 buckets) |
| 3 — Sex-ratio risk | `ExSituPopulation` per row | `count_male` / `count_female` / `count_unsexed`. Skew > 1:4 or unsexed > 50% trips a flag |
| 4 — Stale census | `ExSituPopulation` + `HoldingRecord` | `max(last_census_date, latest HoldingRecord.date)`. Stale if > 12 months or never set |
| Transfer activity | `Transfer` | Status filters; 90-day "recent completed" window |
| Open recommendations | `BreedingRecommendation` | Open lifecycle states |
| Reproductive activity | `BreedingEvent` | Last 12 months globally, surfaced per species |
| **Last edited by** column | `ExSituPopulation.last_edited_by_*` | Set by self-service edits and coordinator overrides |
| **Platform pulse banner** | `/api/v1/dashboard/` `contributors` block | 30-day rollup of edits, breeding events, fresh censuses |

DD companion card on Panel 1 reads `Species.iucn_status = DD` — no
population data needed.

---

## 11. Panel-2 buckets — how a species lands in each

For any species with ≥1 `ExSituPopulation` row:

| If… | Bucket |
|---|---|
| At least one population has `studbook_managed = True` | **Studbook-managed** |
| None studbook, but ≥1 has `breeding_status = 'breeding'` | **Breeding, not studbook** |
| None studbook, none breeding | **Holdings only** |

Species with zero populations are counted as **No captive population** —
the same species Panel 1 lists.

A CARES keeper with a breeding population of a CR species and no
studbook lands the species in "Breeding, not studbook." Don't check
`studbook_managed` to "promote" the keeper into the tidier bucket;
leave it accurate. The four-bucket panel exists to surface exactly
this kind of out-of-program effort.

---

## 12. Audit trail and CSV export

Every self-service edit, breeding-event log, field-program create /
update, and coordinator override writes one row to `AuditEntry`.
Visible at:

- **Django admin → Audit → Audit entries** — filterable by
  `target_type`, `actor_type`, `action`, `actor_institution`,
  `timestamp`. Read-only; never editable.
- **Institution dashboard → Recent activity feed** — last 25 entries
  for your institution.

### CSV export (Tier 3+)

For quarterly review or compliance archiving, coordinators can pull a
filtered CSV via:

```
GET /api/v1/audit/export.csv
   ?institution_id=<id>
   &start=YYYY-MM-DD
   &end=YYYY-MM-DD
   &target_type=populations.ExSituPopulation
```

Filters are optional and combinable. `institution_id` matches both
actor-side and target-ownership rows. Default cap is 5000 rows; max
50000.

```bash
curl -H "Authorization: Token $YOUR_DRF_TOKEN" \
  "https://api.malagasyfishes.org/api/v1/audit/export.csv?institution_id=5&start=2026-01-01&end=2026-03-31" \
  -o aquarium-a-2026-q1.csv
```

CSV columns: `timestamp, actor_email, actor_kind, actor_system,
actor_institution, action, target_type, target_id, target_label,
field, before, after, reason`.

---

## 13. Bulk import — `seed_populations`

For bulk CARES loads, use the management command instead of clicking
each row through admin.

### CSV shape

One row = one population. Institutions deduplicate by
`institution_name` — three rows with the same name create one
Institution and three populations under it.

| Column | Required | Notes |
|---|---|---|
| `institution_name` | yes | Dedup key |
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

CARES convention: `institution_type=hobbyist_keeper`,
`studbook_managed=false`, `last_census_date` to the date your CARES
data was collected.

### Example row

```csv
institution_name,institution_type,country,species_scientific_name,count_total,count_male,count_female,count_unsexed,breeding_status,studbook_managed,last_census_date
J. Smith (CARES),hobbyist_keeper,United States,Paretroplus menarambo,10,4,5,1,breeding,false,2026-04-15
```

### Running it on staging

```bash
ssh deploy@46.224.196.197
cd /home/deploy/madagascarfish/deploy/staging

# Dry-run first — parse + validate, roll back all DB changes
docker compose exec -T web python manage.py seed_populations \
  --csv /data/seed/populations.csv --dry-run

# Real run after reviewing the output
docker compose exec -T web python manage.py seed_populations \
  --csv /data/seed/populations.csv
```

The command is **idempotent**: re-running with the same CSV updates
existing rows rather than duplicating them. Dedup keys are
`Institution.name` and `(species, institution)` for populations.

### What it does NOT do

- Doesn't touch `HoldingRecord` — populations get current-state counts;
  historical snapshots are admin-only.
- Doesn't touch `BreedingEvent` — log those through the self-service
  surface or admin per population.
- Doesn't touch `CoordinatedProgram` or `Transfer` — those stay
  admin-only.

---

## 14. Coordinator workflow: CoordinatedProgram + Transfer (admin)

These two models capture the "who runs this" and "what's moving"
layers above `ExSituPopulation`. Admin-only — no self-service surface.

### CoordinatedProgram

One row per species per program framework. A species can appear in
multiple programs simultaneously (AZA SSP and CARES) but only once
per `program_type`.

**When to add one:** when a species has a formal breeding /
conservation program tracking it.

**Admin:** `/admin/populations/coordinatedprogram/add/`

Key fields:
- `species` — autocomplete
- `program_type` — `ssp` / `eep` / `cares` / `independent` / `other`
- `name` — human-readable, shown on the dashboard. Format:
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

**When to add one:** any time animals move between `Institution` rows.

**Admin:** `/admin/populations/transfer/add/`

Key fields:
- `species` / `source_institution` / `destination_institution` — all
  autocomplete; source ≠ destination (DB-enforced)
- `status` — `proposed` / `approved` / `in_transit` / `completed` /
  `cancelled`
- `proposed_date` — required
- `planned_date` — when scheduled to happen (optional)
- `actual_date` — when it actually completed; set this when status
  flips to `completed`
- `count_male` / `count_female` / `count_unsexed` — M.F.U convention
- `cites_reference` — permit number for CITES-listed species
- `coordinated_program` — link to the program this transfer serves
- `notes` — quarantine, holding pens, anything else

`created_by` auto-fills to the admin user; not editable.

### Why these are separate from `ExSituPopulation`

`ExSituPopulation` is current state. `Transfer` is movement — even if
counts don't change (1:1 swap), the transfer still happened. Don't
manually edit population counts to reflect a transfer; log the
`Transfer` row, then update the population's counts separately when
animals arrive.

---

## 15. Public visibility — what your data looks like to the world

### Public dashboard `/dashboard/`

Top-line totals (species, institutions, populations, programs) plus a
**"Who's contributing"** panel showing 30-day pulse counters. No
per-institution breakdowns.

### Public field programs `/field-programs/`

Every program with `lead_institution` set, grouped by status. Lead
institution names link to the institution profile.

### Public institution profiles `/institutions/<id>/`

Per-institution profile showing species held (names + IUCN status,
**not** counts), populations count, programs led, programs partnered.
Counts and demographic detail stay Tier 2+ via the populations
endpoint.

### Public species profile `/species/<id>/`

The "Held at" pill cloud below the captive stats lists each
institution holding the species. Clicking a pill goes to that
institution's profile.

### Darwin Core Archive `/api/v1/dwc/archive.zip`

GBIF-publishable export of locality records. CR/EN/VU species
publish with coordinates generalized to a 0.1° (~11 km) grid; exact
coordinates stay on the platform behind the coordinator gate.

---

## 16. Troubleshooting

### My institution dashboard says "No populations attached yet"

A coordinator hasn't registered any `ExSituPopulation` rows pointing
at your institution. Contact a coordinator with the species you hold
and the count, and ask them to register the row. After that, you'll be
able to edit it from `/dashboard/institution/`.

### "My institution" link isn't appearing

- Confirm your claim is **approved** at `/account` (under "Institution
  membership").
- The session JWT refreshes every 5 minutes from `/me/`. Sign out and
  sign back in if you need it immediately.
- Tier 1 (anonymous) users don't see the link — confirm you're signed
  in.

### A population I edited isn't reflecting on the coordinator dashboard

The coordinator dashboard renders `force-dynamic`, so changes appear
on the next page load. The Django API itself caches some responses;
wait a minute and refresh.

### A species I added a population for is still in Panel 1 (Coverage gap)

Panel 1 shows species with **zero** populations. Confirm the
`ExSituPopulation` row points at the right species — autocomplete
sometimes selects a near-match. Force-refresh the dashboard.

### Panel 4 says a population is stale but I just updated it

Panel 4 watches `last_census_date`, not the count fields. Update
`last_census_date` to today on the population (self-service edit form
or admin). Or add a fresh `HoldingRecord` (admin only).

### Panel 3 doesn't flag a population I expect to see

Confirm `count_male`, `count_female`, and `count_unsexed` are all
populated (not null). If all three are null, Panel 3 can't compute a
ratio and skips the row.

### A breeding event I logged isn't showing up

Refresh the page. Events are append-only — the form clears after a
successful submit; the event lands in the "Recent events" table below
on next render. If it's missing entirely, check the activity feed on
`/dashboard/institution/` for an audit row.

### I made an edit and need to reverse it

There's no undo. Edit again with the old values; the audit log
preserves both the original change and the reversal. For deletions
that need full removal (rare), ask a superuser.

### A coordinator edited my data and I want to know why

The activity feed on `/dashboard/institution/` shows coordinator
overrides with an amber dot and "coordinator override" tag. Click
through to the audit log in admin (or pull the CSV — §12) for full
field-level diffs. Your coordinator should also be reachable for
context.

---

## 17. Tier reference

| Tier | Role | Edit surfaces |
|---|---|---|
| 1 | Public / anonymous | None |
| 2 | Researcher / institution staff | `/dashboard/institution/` (own institution only) |
| 3 | Conservation Coordinator | All Tier 2 surfaces + Django admin (cross-institution) |
| 4 | Program Manager | Same as Tier 3 + studbook-level surfaces |
| 5 | Administrator | Full system access including superuser admin |

Tier is set on `User.access_tier` (admin only). Self-service edits
require Tier 2+; coordinator-tier surfaces require Tier 3+. The
permission classes (`InstitutionScopedPermission`, `TierPermission`)
enforce this server-side regardless of what the frontend renders.

---

## 18. See also

- [`OPERATIONS.md`](../OPERATIONS.md) — staging runbook, beat /
  worker / IUCN-sync, audit CSV examples, GBIF publishing
- [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) — Django-admin task reference
- [`CARES_REDUCED_SCOPE_PLAN.md`](./CARES_REDUCED_SCOPE_PLAN.md) —
  CARES-specific entry workflow
- [`EAZA_EEP_ENTRY_GUIDE.md`](./EAZA_EEP_ENTRY_GUIDE.md) — EAZA EEP
  registration walkthrough
- [`WORKSHOP_DEMO_RUNBOOK.md`](./WORKSHOP_DEMO_RUNBOOK.md) — ABQ
  workshop demo script
- [`CLAUDE.md`](../CLAUDE.md) — access tiers, sensitive data rules,
  audit / mirror policy
