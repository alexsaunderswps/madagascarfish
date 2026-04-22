"""Tests for the seed_populations management command."""

from __future__ import annotations

from datetime import date
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from populations.models import ExSituPopulation, Institution
from species.models import Species


@pytest.fixture
def species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def species_two(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        taxonomic_status="described",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status="EN",
    )


def _write_csv(tmp_path: Path, rows: list[dict[str, str]]) -> Path:
    path = tmp_path / "populations.csv"
    fields = sorted({k for row in rows for k in row})
    with path.open("w", newline="") as fh:
        import csv as _csv

        writer = _csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return path


@pytest.mark.django_db
class TestSeedPopulations:
    def test_missing_csv_path_errors(self, tmp_path: Path) -> None:
        with pytest.raises(CommandError, match="CSV not found"):
            call_command("seed_populations", csv=str(tmp_path / "nope.csv"))

    def test_missing_required_columns_errors(self, tmp_path: Path) -> None:
        path = tmp_path / "bad.csv"
        path.write_text("foo,bar\n1,2\n")
        with pytest.raises(CommandError, match="missing required columns"):
            call_command("seed_populations", csv=str(path))

    def test_creates_institution_and_population(
        self,
        tmp_path: Path,
        species: Species,
    ) -> None:
        csv_path = _write_csv(
            tmp_path,
            [
                {
                    "institution_name": "J. Smith (CARES)",
                    "institution_type": "hobbyist_keeper",
                    "country": "United States",
                    "species_scientific_name": "Paretroplus menarambo",
                    "count_total": "10",
                    "count_male": "4",
                    "count_female": "5",
                    "count_unsexed": "1",
                    "breeding_status": "breeding",
                    "studbook_managed": "false",
                    "last_census_date": "2026-04-15",
                }
            ],
        )
        call_command("seed_populations", csv=str(csv_path))
        inst = Institution.objects.get(name="J. Smith (CARES)")
        assert inst.institution_type == "hobbyist_keeper"
        pop = ExSituPopulation.objects.get(species=species, institution=inst)
        assert pop.count_total == 10
        assert pop.breeding_status == "breeding"
        assert pop.last_census_date == date(2026, 4, 15)

    def test_idempotent_rerun_updates_not_duplicates(
        self,
        tmp_path: Path,
        species: Species,
    ) -> None:
        csv_path = _write_csv(
            tmp_path,
            [
                {
                    "institution_name": "ABQ BioPark",
                    "institution_type": "aquarium",
                    "country": "United States",
                    "species_scientific_name": "Paretroplus menarambo",
                    "count_total": "10",
                }
            ],
        )
        call_command("seed_populations", csv=str(csv_path))
        # Rewrite with a new count.
        csv_path.write_text(csv_path.read_text().replace("10", "15"))
        call_command("seed_populations", csv=str(csv_path))
        assert Institution.objects.filter(name="ABQ BioPark").count() == 1
        assert ExSituPopulation.objects.filter(species=species).count() == 1
        assert ExSituPopulation.objects.get(species=species).count_total == 15

    def test_dedupes_institution_across_rows(
        self,
        tmp_path: Path,
        species: Species,
        species_two: Species,
    ) -> None:
        csv_path = _write_csv(
            tmp_path,
            [
                {
                    "institution_name": "J. Smith (CARES)",
                    "institution_type": "hobbyist_keeper",
                    "country": "US",
                    "species_scientific_name": "Paretroplus menarambo",
                    "count_total": "10",
                },
                {
                    "institution_name": "J. Smith (CARES)",
                    "institution_type": "hobbyist_keeper",
                    "country": "US",
                    "species_scientific_name": "Bedotia geayi",
                    "count_total": "6",
                },
            ],
        )
        call_command("seed_populations", csv=str(csv_path))
        assert Institution.objects.filter(name="J. Smith (CARES)").count() == 1
        assert ExSituPopulation.objects.count() == 2

    def test_dry_run_does_not_persist(
        self,
        tmp_path: Path,
        species: Species,
    ) -> None:
        csv_path = _write_csv(
            tmp_path,
            [
                {
                    "institution_name": "Ghost Keeper",
                    "institution_type": "hobbyist_keeper",
                    "country": "US",
                    "species_scientific_name": "Paretroplus menarambo",
                    "count_total": "10",
                }
            ],
        )
        call_command("seed_populations", csv=str(csv_path), dry_run=True)
        assert Institution.objects.filter(name="Ghost Keeper").count() == 0
        assert ExSituPopulation.objects.count() == 0

    def test_missing_species_skipped_not_fatal(
        self,
        tmp_path: Path,
        species: Species,
    ) -> None:
        csv_path = _write_csv(
            tmp_path,
            [
                {
                    "institution_name": "Real Keeper",
                    "institution_type": "hobbyist_keeper",
                    "country": "US",
                    "species_scientific_name": "Paretroplus menarambo",
                    "count_total": "5",
                },
                {
                    "institution_name": "Missing Species Keeper",
                    "institution_type": "hobbyist_keeper",
                    "country": "US",
                    "species_scientific_name": "Totally fake species",
                    "count_total": "1",
                },
            ],
        )
        err = StringIO()
        call_command("seed_populations", csv=str(csv_path), stderr=err)
        # First row landed; second was skipped.
        assert ExSituPopulation.objects.count() == 1
        assert "species not found" in err.getvalue()

    def test_invalid_enum_skipped(
        self,
        tmp_path: Path,
        species: Species,
    ) -> None:
        csv_path = _write_csv(
            tmp_path,
            [
                {
                    "institution_name": "Bad Type",
                    "institution_type": "not_a_real_type",
                    "country": "US",
                    "species_scientific_name": "Paretroplus menarambo",
                }
            ],
        )
        err = StringIO()
        call_command("seed_populations", csv=str(csv_path), stderr=err)
        assert ExSituPopulation.objects.count() == 0
        assert "institution_type" in err.getvalue()

    def test_defaults_applied_when_optional_fields_blank(
        self,
        tmp_path: Path,
        species: Species,
    ) -> None:
        csv_path = _write_csv(
            tmp_path,
            [
                {
                    "institution_name": "Minimal Keeper",
                    "species_scientific_name": "Paretroplus menarambo",
                }
            ],
        )
        call_command("seed_populations", csv=str(csv_path))
        inst = Institution.objects.get(name="Minimal Keeper")
        assert inst.institution_type == "hobbyist_keeper"
        assert inst.country == "Unknown"
        pop = ExSituPopulation.objects.get(institution=inst)
        assert pop.breeding_status == "unknown"
        assert pop.studbook_managed is False

    def test_booleans_flex_on_input(
        self,
        tmp_path: Path,
        species: Species,
    ) -> None:
        csv_path = _write_csv(
            tmp_path,
            [
                {
                    "institution_name": "SB Managed",
                    "institution_type": "zoo",
                    "country": "US",
                    "species_scientific_name": "Paretroplus menarambo",
                    "studbook_managed": "yes",
                }
            ],
        )
        call_command("seed_populations", csv=str(csv_path))
        pop = ExSituPopulation.objects.get(institution__name="SB Managed")
        assert pop.studbook_managed is True
