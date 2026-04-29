# EAZA EEP Entry Guide

Step-by-step walkthrough for entering the two Madagascar-relevant EAZA
Ex-situ Programmes (EEPs) into the registry. Closes Alex-ToDo §2.7.

**Where:** <https://api.malagasyfishes.org/admin/> — sign in as a
Tier 5 superuser account. Production, not local.

**Time:** ~20-30 minutes of admin clicking. Two institution rows, two
program rows.

**Source:** `data/reference/April_2026_8e69dc12b4.pdf` — EAZA Ex-situ
Programme overview, April 2026, page 1, rows 31 (Madagascar
rainbowfishes) and 36 (Cichlids).

---

## 0. What this entry unlocks

Two `CoordinatedProgram` rows + two `Institution` rows tied to the
April 2026 EAZA programme overview.

What it **does** unlock:

- Real, sourced reference data to point at when discussing the
  coordinator dashboard at ABQ — instead of empty state.
- Panel 5 (Transfer activity) program-name surfacing — when a Transfer
  is logged that references one of these programs, the program name
  appears next to it.
- Schema-shape proof — demonstrates the platform models the
  EAZA → species → institution chain correctly. Useful for
  SHOAL / EAZA conversations.

What it **does not** unlock on its own:

- Panel 2 (Studbook status) buckets. Panel 2 reads
  `ExSituPopulation.studbook_managed`, not `CoordinatedProgram` rows.
  So §2.7 alone leaves Panel 2 empty unless an anchor species also has
  a captive population logged. See §3 "Optional follow-on" below.

---

## 1. Pre-flight check

Both anchor species are already in the registry — no need to add them:

- `Bedotia madagascariensis` (Bedotiidae, IUCN: EN)
- `Paretroplus menarambo` (Cichlidae, IUCN: CR)

Neither institution exists yet — both will be created in Step 2.

No existing `CoordinatedProgram` rows in the system; this is the first
entry of its kind.

---

## 2. Create the two institutions

Do these first — Step 3 references them via autocomplete.

### 2a. Bristol Zoo Project

**URL:** `/admin/populations/institution/add/`

| Field | Value |
|---|---|
| Name | `Bristol Zoo Project` |
| Institution type | `zoo` |
| Country | `United Kingdom` |
| City | `Bristol` *(or leave blank if uncertain)* |
| `eaza_member` | ✓ checked |
| `zims_member` | ✓ checked |
| `aza_member` | unchecked |

Click **Save**.

Notes: Bristol Zoo Project is the post-2022 successor to Bristol Zoo
Gardens. It coordinates two Madagascar-relevant EEPs in the April 2026
overview (Bedotiidae rainbowfishes and Valenciidae toothcarps); this
guide covers only the Bedotiidae one.

### 2b. National Aquarium Denmark

**URL:** `/admin/populations/institution/add/`

| Field | Value |
|---|---|
| Name | `National Aquarium Denmark` |
| Institution type | `aquarium` |
| Country | `Denmark` |
| City | `Kastrup` *(operates as Den Blå Planet, near Copenhagen — or leave blank)* |
| `eaza_member` | ✓ checked |
| `zims_member` | ✓ checked |

Click **Save**.

---

## 3. Create the two CoordinatedProgram rows

### 3a. Madagascar rainbowfishes EEP

**URL:** `/admin/populations/coordinatedprogram/add/`

| Field | Value |
|---|---|
| Species | `Bedotia madagascariensis` *(autocomplete)* |
| Name | `EAZA EEP: Madagascar rainbowfishes (Bedotiidae)` |
| Program type | `eep` |
| Status | `active` |
| Coordinating institution | `Bristol Zoo Project` *(autocomplete; created in 2a)* |
| Studbook keeper | leave blank — Charles Fusari is not a registry user |
| Enrolled institutions | leave empty |
| Plan summary | `EAZA EEP for the Bedotiidae rainbowfish family. Coordinator: Charles Fusari (Bristol Zoo Project). IUCN Red List status: EN. Source: April 2026 EAZA Ex-situ Programme overview.` |
| Plan document URL | blank |
| Start date | blank |
| Next review date | blank |

Click **Save**.

### 3b. Madagascar cichlids EEP

**URL:** `/admin/populations/coordinatedprogram/add/`

| Field | Value |
|---|---|
| Species | `Paretroplus menarambo` *(autocomplete)* |
| Name | `EAZA EEP: Cichlids (Cichlidae)` |
| Program type | `eep` |
| Status | `active` |
| Coordinating institution | `National Aquarium Denmark` *(autocomplete; created in 2b)* |
| Studbook keeper | leave blank — Peter Petersen is not a registry user |
| Enrolled institutions | leave empty |
| Plan summary | `EAZA EEP for the Cichlidae family. Coordinator: Peter Petersen (National Aquarium Denmark). IUCN Red List status: CR. Source: April 2026 EAZA Ex-situ Programme overview.` |
| Plan document URL | blank |
| Start date | blank |
| Next review date | blank |

Click **Save**.

---

## 4. Verify

Open `/admin/populations/coordinatedprogram/` — both rows should appear,
with their species and coordinating institution rendered correctly.

Open `/dashboard/coordinator/` — Panel 5 (Transfer activity) will still
be empty (no transfers logged yet). Panel 2 (Studbook status) won't
move from §2.7 alone — that requires §3 below.

---

## 5. Optional follow-on — make Panel 2 move

If you want the dashboard to register a visible change from this entry
session, add one `ExSituPopulation` row alongside each program. ~60
seconds per row once the institutions exist.

### 5a. Bedotia madagascariensis at Bristol Zoo Project

**URL:** `/admin/populations/exsitupopulation/add/`

| Field | Value |
|---|---|
| Species | `Bedotia madagascariensis` *(autocomplete)* |
| Institution | `Bristol Zoo Project` *(autocomplete)* |
| `count_total` | best-known number, or `0` placeholder if unknown |
| `count_male` / `count_female` / `count_unsexed` | leave blank if unknown |
| `breeding_status` | `breeding` if confirmed, otherwise `unknown` |
| `studbook_managed` | ✓ checked *(EEPs run a studbook by definition)* |
| `last_census_date` | today's date |

Click **Save**.

### 5b. Paretroplus menarambo at National Aquarium Denmark

Same form as 5a, but:

| Field | Value |
|---|---|
| Species | `Paretroplus menarambo` |
| Institution | `National Aquarium Denmark` |
| `studbook_managed` | ✓ checked |
| (other fields as in 5a) | |

After saving, Panel 2 on the coordinator dashboard moves both species
from "No captive population" into the **"Studbook-managed"** bucket.

---

## 6. After ABQ — what to revisit

- **Real population counts.** The `count_total = 0` placeholder gets
  refreshed once Charles Fusari / Peter Petersen share actual numbers.
  Either reach out post-workshop or let the rows sit as
  schema-presence markers until ZIMS data flows in.
- **Family-level program modeling.** The data model currently uses
  `CoordinatedProgram.species` as a single FK, so each family-level
  EEP needs an "anchor" species. If post-ABQ work expands the model to
  carry family-level programs (Gate 4 Phase 2 candidate), these rows
  can be migrated to the new shape — keep the original entries
  untouched until then.
- **Other EAZA EEPs of tangential interest.** From the same April 2026
  overview, none of these are Madagascar-endemic, so don't enter them
  against this registry — but useful context if asked at ABQ:
  - Goodeids (Goodeidae) — Chester Zoo, Joe Chattell, EW-EN
  - Sail-fin silversides / Pseudomugilidae — Jens Bohn, CR-DD
  - Toothcarps (Valenciidae) — Bristol Zoo Project, Brian Zimmerman, CR
  - Mudminnows (Umbridae) — Tiergarten Schönbrunn, Anton
    Weissenbacher, VU
