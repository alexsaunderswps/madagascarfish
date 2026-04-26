"""Tests for the `seed_demo_coordination` management command.

The command is workshop-demo scaffolding (see ABQ June 1–5, 2026), so the
tests focus on the contracts that matter to operators:

- It only writes when there's threatened-species + population data to
  attach to (no spurious rows on a fresh DB).
- ``--clear`` only deletes demo-tagged rows; real operator-entered rows
  pass through untouched.
- A second run is idempotent (no duplicates from the natural-key checks).
- ``--dry-run`` rolls back cleanly.
"""

from __future__ import annotations

from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command

from populations.management.commands.seed_demo_coordination import DEMO_MARKER
from populations.models import (
    BreedingEvent,
    BreedingRecommendation,
    CoordinatedProgram,
    ExSituPopulation,
    Institution,
    Transfer,
)
from species.models import Species


# ---------------------------------------------------------------------------
# fixtures: enough plumbing for the command to find candidate species + pops
# ---------------------------------------------------------------------------


@pytest.fixture
def threatened_species_with_pops(db: None) -> dict[str, Species]:
    """Three threatened species, each with at least one population, across
    enough institutions for transfers to have a source/destination pair."""
    species = {
        "menarambo": Species.objects.create(
            scientific_name="Paretroplus menarambo",
            taxonomic_status="described",
            family="Cichlidae",
            genus="Paretroplus",
            endemic_status="endemic",
            iucn_status="CR",
        ),
        "maromandia": Species.objects.create(
            scientific_name="Paretroplus maromandia",
            taxonomic_status="described",
            family="Cichlidae",
            genus="Paretroplus",
            endemic_status="endemic",
            iucn_status="CR",
        ),
        "geayi": Species.objects.create(
            scientific_name="Bedotia geayi",
            taxonomic_status="described",
            family="Bedotiidae",
            genus="Bedotia",
            endemic_status="endemic",
            iucn_status="EN",
        ),
    }
    institutions = [
        Institution.objects.create(
            name="Bristol Zoo Project", institution_type="zoo", country="GB"
        ),
        Institution.objects.create(
            name="National Aquarium Denmark", institution_type="aquarium", country="DK"
        ),
        Institution.objects.create(
            name="J. Smith (CARES)", institution_type="hobbyist_keeper", country="US"
        ),
    ]
    # Each species held at two of the three institutions; one is breeding.
    for sp, (a, b) in zip(species.values(), [(0, 1), (0, 2), (1, 2)]):
        ExSituPopulation.objects.create(
            species=sp,
            institution=institutions[a],
            count_total=10,
            breeding_status="breeding",
            last_census_date=date(2026, 3, 15),
        )
        ExSituPopulation.objects.create(
            species=sp,
            institution=institutions[b],
            count_total=8,
            breeding_status="non-breeding",
            last_census_date=date(2026, 3, 15),
        )
    return species


# ---------------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------------


def _run(*args: str) -> str:
    out = StringIO()
    call_command("seed_demo_coordination", *args, stdout=out)
    return out.getvalue()


@pytest.mark.django_db
def test_no_data_means_no_writes() -> None:
    """A fresh DB with no populations produces zero demo rows — the
    command never invents species/institutions/populations on its own."""
    _run()
    assert CoordinatedProgram.objects.count() == 0
    assert Transfer.objects.count() == 0
    assert BreedingRecommendation.objects.count() == 0
    assert BreedingEvent.objects.count() == 0


@pytest.mark.django_db
def test_seeds_programs_transfers_recs_events(threatened_species_with_pops):
    out = _run()
    # We expect at least one of each kind, given three threatened species
    # with pops across two institutions each.
    assert CoordinatedProgram.objects.count() >= 3
    assert Transfer.objects.count() >= 1
    assert BreedingRecommendation.objects.count() >= 1
    assert BreedingEvent.objects.count() >= 1
    # All demo rows are tagged.
    assert all(DEMO_MARKER in p.plan_summary for p in CoordinatedProgram.objects.all())
    assert all(DEMO_MARKER in t.notes for t in Transfer.objects.all())
    assert all(DEMO_MARKER in r.rationale for r in BreedingRecommendation.objects.all())
    assert all(DEMO_MARKER in e.notes for e in BreedingEvent.objects.all())
    assert "demo seed summary" in out


@pytest.mark.django_db
def test_idempotent_second_run(threatened_species_with_pops):
    _run()
    p1 = CoordinatedProgram.objects.count()
    t1 = Transfer.objects.count()
    r1 = BreedingRecommendation.objects.count()
    e1 = BreedingEvent.objects.count()
    _run()
    # Second run finds existing demo rows by natural key + marker and skips.
    assert CoordinatedProgram.objects.count() == p1
    assert Transfer.objects.count() == t1
    assert BreedingRecommendation.objects.count() == r1
    assert BreedingEvent.objects.count() == e1


@pytest.mark.django_db
def test_clear_deletes_only_demo_rows(threatened_species_with_pops):
    species = threatened_species_with_pops["menarambo"]
    inst = Institution.objects.first()

    # An operator-entered program that must survive --clear.
    real_program = CoordinatedProgram.objects.create(
        species=species,
        program_type=CoordinatedProgram.ProgramType.SSP,
        name="Real AZA SSP — operator-entered",
        plan_summary="Real plan, no marker.",
        coordinating_institution=inst,
    )

    _run()
    assert CoordinatedProgram.objects.count() >= 4  # 3 demo + 1 real
    _run("--clear")
    # Real row passes through; demo rows recreated, plus the real one.
    assert CoordinatedProgram.objects.filter(pk=real_program.pk).exists()
    assert CoordinatedProgram.objects.filter(plan_summary__startswith=DEMO_MARKER).count() >= 3


@pytest.mark.django_db
def test_clear_does_not_delete_rows_that_merely_quote_the_marker(
    threatened_species_with_pops,
):
    """A real row that quotes ``[DEMO_SEED]`` mid-text — for example, a
    coordinator's review note saying 'replaced the [DEMO_SEED] scaffold' —
    must survive --clear. The marker is anchored at field-start, not
    substring-matched (security review H2)."""
    species = threatened_species_with_pops["menarambo"]
    inst = Institution.objects.first()
    survivor = CoordinatedProgram.objects.create(
        species=species,
        program_type=CoordinatedProgram.ProgramType.SSP,
        name="Operator program quoting the marker",
        plan_summary=f"This row replaced the {DEMO_MARKER} scaffold last week.",
        coordinating_institution=inst,
    )
    _run()
    _run("--clear")
    assert CoordinatedProgram.objects.filter(pk=survivor.pk).exists(), (
        "row that merely quotes the marker mid-text must survive --clear"
    )


@pytest.mark.django_db
def test_dry_run_writes_nothing(threatened_species_with_pops):
    out = _run("--dry-run")
    assert "dry-run" in out
    assert CoordinatedProgram.objects.count() == 0
    assert Transfer.objects.count() == 0
    assert BreedingRecommendation.objects.count() == 0
    assert BreedingEvent.objects.count() == 0


@pytest.mark.django_db
def test_seed_argument_makes_runs_deterministic(threatened_species_with_pops):
    """Passing the same --seed twice produces the same recommendation set."""
    _run("--seed", "42")
    rec_types_first = sorted(
        BreedingRecommendation.objects.values_list("recommendation_type", flat=True)
    )
    _run("--clear", "--seed", "42")
    rec_types_second = sorted(
        BreedingRecommendation.objects.values_list("recommendation_type", flat=True)
    )
    assert rec_types_first == rec_types_second
