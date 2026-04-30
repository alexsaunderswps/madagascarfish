# Coordinator-dashboard demo seed

Hand-sketched populations data for the Tier-3 coordinator dashboard demo
(ABQ BioPark, June 2026). Institutions are real Madagascar freshwater
fish program partners; the **counts and dates are illustrative**, not
ZIMS-accurate. Replace with real numbers before any external sharing.

## Files

- `institutions_populations.csv` — 18 ExSituPopulation rows across 8
  institutions, covering 14 priority species. Idempotent; institution
  names are the dedup key.

## Loading

```bash
# 1. Populations + institutions (one CSV, both layers).
docker compose exec web python manage.py seed_populations \
    --csv /data/seed/coordinator-demo/institutions_populations.csv

# 2. Coordinated programs + transfers + breeding events. Reads the
#    populations seeded above.
docker compose exec web python manage.py seed_demo_coordination
```

## What lights up

After both commands, all seven coordinator-dashboard panels render
non-empty:

- **Coverage Gap** — already populated from species data alone (no
  populations needed).
- **Studbook Status** — the seven studbook-managed populations cluster
  the species into the four buckets (managed / breeding-not-managed /
  holdings-only / no-captive).
- **Sex-Ratio Risk** — three populations are deliberately skewed past
  the threshold (>5:1 M:F) to populate the at-risk panel.
- **Stale Census** — two `last_census_date` values are >18 months old
  to trigger the stale-census threshold.
- **Transfer Activity** — `seed_demo_coordination` produces in-flight
  + recent-completed transfers across the seeded institutions.
- **Open Recommendations** — `seed_demo_coordination` produces a few
  open recommendations attached to populations + programs.
- **Reproductive Activity** — `seed_demo_coordination` records
  spawning + mortality events on a handful of populations.

## Caveats

- **Demo-shaped, not field data.** Don't share publicly without
  swapping in real numbers from ZIMS / partner institutions.
- The CSV deliberately includes hobbyist-keeper rows alongside
  institutional rows so the panel UX exercises the
  `institution_type=hobbyist_keeper` rendering path.
- Counts are within plausible ranges for each species' actual captive
  programs (where known), but specific institution × species pairings
  may not match real-world holdings. Use as demo material only.

## Replace with real data

Once partner institutions confirm holdings:

1. Make a copy of `institutions_populations.csv`.
2. Update counts, census dates, and add/remove rows.
3. Re-run `seed_populations` — the command is idempotent (Institutions
   dedup by name, Populations dedup by `(species, institution)`).
4. Manually update or delete `CoordinatedProgram` /
   `BreedingRecommendation` rows that referenced removed populations.
