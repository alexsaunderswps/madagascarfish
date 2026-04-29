# CARES Reduced-Scope Plan

Plan for the ABQ demo when realistic CARES data is "a few keepers,
mostly cichlids, almost nothing else." Replaces the ambitious framing
in Alex-ToDo §2.1 ("HIGHEST — bulk of the work") with what's actually
achievable + how to make the demo read coherently with the data we'll
really have.

**When:** decide before §4.1 dry-run (week of 2026-05-25). Entry work
itself is ~1-2 hours total.

**Companion docs:**

- `docs/EAZA_EEP_ENTRY_GUIDE.md` — the §2.7 walkthrough this composes with
- `docs/POPULATION_DATA_GUIDE.md` — full field-by-field walkthrough
  for `Institution` / `ExSituPopulation` / `HoldingRecord`
- `docs/WORKSHOP_DEMO_RUNBOOK.md` — the actual demo sequence + recovery
  paths

---

## 0. Reality check

What was assumed in the original §2.1 framing:

- Tens of CARES keepers across multiple Madagascar species families
- Bulk-load via `seed_populations` from a CSV
- Panel 2 (Studbook status) populated across all four buckets
- "Comprehensive coordinator triage view" demo narrative

What is actually true:

- A handful of CARES keepers (single digits)
- A small set of cichlid species — `Paretroplus`, possibly some
  `Ptychochromis`
- Almost no captive populations for other endemic families
  (Bedotiidae, Aplocheilidae, Anchariidae, gobies, cave fish — all
  effectively zero on the CARES side)
- Manual admin entry is more efficient than the CSV path for this
  volume; `seed_populations` is overkill

This is not a failure mode. It's the actual conservation gap the
platform exists to surface. **Lean into it.**

---

## 1. The narrative pivot

Two demo framings are available given the data:

| Framing | What it says | When it works |
|---|---|---|
| "Coordinator triage view" *(original §2.1)* | "Here is the state of ex-situ coordination across Madagascar endemics." | Dense data across all four Panel-2 buckets. **Not us in 2026-06.** |
| "The gap is the story" | "Here is what we can see, what we can't, and where the conservation gap really sits. The empty buckets are the platform's most honest output." | Sparse data, broad coverage gap. **Us.** |

The "gap is the story" framing is **stronger** for an ABQ audience —
SHOAL, AZA / EAZA partners, CARES leads. They already know the gap
exists; what's new is having a public registry that quantifies it.

The Panel 1 hero stat (*"N of M threatened species have no known
captive population"*) does most of the work. Panel 2 supports it.
The other panels round out the platform-shape demonstration.

---

## 2. Minimum viable real-data entries

Three tiers. Do tier 1 always; tier 2 if you have time; tier 3 only if
you genuinely have the data.

### Tier 1 — anchor the EEPs (15 minutes)

Required for the EAZA EEP entries from §2.7 to register as actual
captive populations on the dashboard. Without this, §2.7 alone leaves
Panel 2 still empty.

| Species | Institution | `studbook_managed` |
|---|---|---|
| `Bedotia madagascariensis` | Bristol Zoo Project | ✓ |
| `Paretroplus menarambo` | National Aquarium Denmark | ✓ |

Enter these via §5 of `EAZA_EEP_ENTRY_GUIDE.md`. Use `count_total = 0`
(or your best-known number) — the placeholder is fine. The entry
exists primarily so Panel 2 reads "Studbook-managed: 2" rather than
zero.

### Tier 2 — your real CARES keepers

For each CARES keeper you actually have data for, follow the manual
admin path in `POPULATION_DATA_GUIDE.md` §3 (Institution) + §4
(ExSituPopulation). Realistic scope:

- Maybe 3-5 `Institution` rows of `institution_type=hobbyist_keeper`
- Maybe 5-10 `ExSituPopulation` rows, mostly cichlids
- `studbook_managed = unchecked` (CARES is hobbyist-coordinated, not
  studbook-coordinated by default)
- `breeding_status = breeding` if the keeper confirms active spawning,
  else `unknown`

This is the data you actually have. Entering it puts cichlid species
into Panel 2's "Breeding, not studbook" or "Holdings only" buckets,
which is correct + tells a real story ("hobbyist keepers are doing
the work the zoos aren't").

### Tier 3 — known-public zoo holdings (optional)

If you want to round out the demo with a few more institutions
without inventing data, the following are **public knowledge** as of
2026 (cite `April_2026_8e69dc12b4.pdf` or institutional websites):

- Toyota Aquarium (Japan) — Madagascar cichlid holdings, public
- Vienna Zoo (Tiergarten Schönbrunn) — Madagascar fish holdings, public
- Berlin Aquarium (Zoo Berlin) — Madagascar cichlid holdings, public

Only add these if you can find a source you'd cite at ABQ. Don't
guess. The "gap is the story" narrative is undermined by inflated
data more than by sparse data.

---

## 3. Interaction with the synthetic demo layer

`backend/populations/management/commands/seed_demo_coordination.py`
generates synthetic `CoordinatedProgram` / `Transfer` /
`BreedingRecommendation` / `BreedingEvent` rows tagged with the
`[DEMO_SEED]` marker. The `WORKSHOP_DEMO_RUNBOOK` runs it on the
morning of demo day.

This layer *needs* the Tier-1 + Tier-2 real-data rows above to anchor
against. Specifically:

- Synthetic `BreedingRecommendation` rows pick species + populations
  from whatever real `ExSituPopulation` rows exist. No populations →
  no realistic targets → empty Panel 6.
- Synthetic `Transfer` rows pick source + destination from whatever
  `Institution` rows exist. One institution → no transfers possible.
- Synthetic `BreedingEvent` rows attach to populations. No populations
  → empty Panel 7.

Tier 1 alone (2 institutions, 2 populations) lets the synthetic layer
seed a minimal coherent story. Tier 2 (5-10 populations across 3-5
institutions) gives it noticeably more variety. Tier 3 is gravy.

The synthetic layer is **safe** to run repeatedly — it's idempotent
and rolls back cleanly via `seed_demo_coordination --clear`. Real
operator-entered rows are never matched, never modified, never
deleted.

---

## 4. Panel-by-panel expectations + demo lines

What each panel will look like at ABQ given Tier-1 + Tier-2 entry, and
what to say.

### Panel 1 — Coverage gap

**What it shows:** `~70 of ~75 threatened species have no known
captive population.` (Exact number depends on what you enter.)

**Demo line:** *"This is the headline. Of every threatened endemic
freshwater fish in Madagascar, we have ex-situ coverage on a small
handful. The platform's first job is making this number visible —
because the institutions that could close the gap don't currently
share a registry."*

### Panel 2 — Studbook status

**What it shows:** lopsided buckets — `Studbook-managed: 2` (the EAZA
EEPs), `Breeding, not studbook: ~5` (CARES cichlids), `Holdings only:
~3`, `No captive population: ~70`.

**Demo line:** *"This isn't a uniform picture. Two species are under
formal EAZA studbook management. A handful sit with hobbyist breeders
under the CARES network. Most have no captive population at all. The
platform makes that distribution legible — which is the prerequisite
for any coordinator deciding where to direct effort."*

### Panel 3 — Sex-ratio risk

**What it shows:** maybe 1-2 populations flagged, depending on
whether you enter `count_male` / `count_female` counts.

**Demo line:** if anything is flagged: *"For populations where we have
demographic detail, the platform flags ratio risk. Most of our records
don't have that detail yet — that's an ask of the keeper community."*
If nothing is flagged, skip the panel.

### Panel 4 — Stale census

**What it shows:** likely empty if you enter `last_census_date = today`
on every Tier-1 + Tier-2 row.

**Demo line:** skip the panel, or: *"This panel shows populations whose
census is overdue. Today everything is fresh because we just entered
it. The point is the platform will warn coordinators when records
drift — that's how you keep a registry honest over time."*

### Panel 5 — Transfer activity

**What it shows:** `seed_demo_coordination` provides 2-4 synthetic
in-flight transfers between the institutions you entered. All tagged
`[DEMO_SEED]`.

**Demo line:** *"For the demo we've seeded a few synthetic transfers to
illustrate the lifecycle — proposed, approved, in transit, completed.
In production, coordinators log these as movements happen."*

### Panel 6 — Open breeding recommendations

**What it shows:** 3-4 synthetic recommendations across the priority
levels. Tagged `[DEMO_SEED]`.

**Demo line:** *"This is the coordinator's to-do list. Each
recommendation has a priority, a target institution, and a due date.
Critical recommendations surface first; overdue ones are tagged. This
is the operational core of the dashboard."*

### Panel 7 — Recent reproductive activity

**What it shows:** 5-10 synthetic events — spawnings, hatchings,
mortalities — across the populations you entered.

**Demo line:** *"The event ledger. Spawnings and mortalities are
logged here as they happen, with signed count deltas. Over time this
becomes the longitudinal data layer underneath everything else."*

---

## 5. The honest-vs-padded decision

A judgment call, not a binary.

- **Honest** — enter Tier 1, optionally Tier 2, no Tier 3. Run the
  synthetic layer. Demo says "this is what we can see, much of which
  is empty, and that's the point." Strongest narrative for a
  conservation-funder audience. Risk: panels look sparse on their
  own.
- **Padded** — enter Tier 1 + 2 + 3. Demo looks fuller. Risk: someone
  asks where the Tier-3 data came from, and "I added it from public
  sources to round out the demo" lands awkwardly compared with
  "everything you see is sourced."

Recommendation: **honest**. The audience at ABQ is sophisticated
enough that empty buckets read as *the problem the platform solves*,
not *the platform doesn't have data yet*. Make sure the demo line for
Panel 2 explicitly names the gap as the point — that flips the
read.

---

## 6. Order of operations before ABQ

1. **Now → 2026-05-15.** Enter Tier 1 (alongside §2.7 EAZA EEPs) +
   whatever Tier 2 you have CSV-quality data for. ~1-2 hours total.
2. **Week of 2026-05-25.** Run §4.1 dry-run from the
   `WORKSHOP_DEMO_RUNBOOK`. Decide on Panel 4 (skip vs. include) and
   Panel 3 (skip vs. include) based on what's actually there.
3. **2026-05-31 (one day before).** Run `seed_demo_coordination` on
   staging per the morning-of checklist. Verify all panels render.
4. **2026-06-01 → 2026-06-05.** Demo with confidence in the data
   you have, named for what it is.
