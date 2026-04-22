"""Model-level tests for CoordinatedProgram + Transfer (Gate 4 Phase 1).

Admin and API surface land in follow-on PRs; this file covers the
constraints and basic relational plumbing.
"""

from __future__ import annotations

from datetime import date

import pytest
from django.db import IntegrityError
from django.db.transaction import atomic

from populations.models import (
    CoordinatedProgram,
    Institution,
    Transfer,
)
from species.models import Species


@pytest.fixture
def species_cr(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def inst_a(db: None) -> Institution:
    return Institution.objects.create(
        name="ABQ BioPark",
        institution_type="aquarium",
        country="United States",
    )


@pytest.fixture
def inst_b(db: None) -> Institution:
    return Institution.objects.create(
        name="Cologne Zoo",
        institution_type="zoo",
        country="Germany",
    )


@pytest.mark.django_db
class TestCoordinatedProgram:
    def test_basic_create(self, species_cr: Species, inst_a: Institution) -> None:
        p = CoordinatedProgram.objects.create(
            species=species_cr,
            program_type=CoordinatedProgram.ProgramType.SSP,
            name="AZA SSP: Menarambo",
            status=CoordinatedProgram.Status.ACTIVE,
            coordinating_institution=inst_a,
        )
        assert p.pk is not None
        assert "Menarambo" in str(p)

    def test_unique_species_programtype(self, species_cr: Species, inst_a: Institution) -> None:
        CoordinatedProgram.objects.create(
            species=species_cr,
            program_type=CoordinatedProgram.ProgramType.SSP,
            name="SSP A",
        )
        with pytest.raises(IntegrityError), atomic():
            CoordinatedProgram.objects.create(
                species=species_cr,
                program_type=CoordinatedProgram.ProgramType.SSP,
                name="SSP B",
            )

    def test_same_species_different_programtype_allowed(self, species_cr: Species) -> None:
        CoordinatedProgram.objects.create(
            species=species_cr,
            program_type=CoordinatedProgram.ProgramType.SSP,
            name="AZA SSP",
        )
        # Same species can be on a CARES list AND in an SSP — both valid.
        CoordinatedProgram.objects.create(
            species=species_cr,
            program_type=CoordinatedProgram.ProgramType.CARES,
            name="CARES priority",
        )
        assert CoordinatedProgram.objects.filter(species=species_cr).count() == 2

    def test_enrolled_institutions_m2m(
        self,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        p = CoordinatedProgram.objects.create(
            species=species_cr,
            program_type=CoordinatedProgram.ProgramType.EEP,
            name="EEP",
            coordinating_institution=inst_a,
        )
        p.enrolled_institutions.add(inst_a, inst_b)
        assert p.enrolled_institutions.count() == 2


@pytest.mark.django_db
class TestTransfer:
    def test_basic_create(
        self,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        t = Transfer.objects.create(
            species=species_cr,
            source_institution=inst_a,
            destination_institution=inst_b,
            proposed_date=date(2026, 5, 1),
            status=Transfer.Status.PROPOSED,
        )
        assert t.pk is not None
        assert "→" in str(t)

    def test_source_and_destination_must_differ(
        self,
        species_cr: Species,
        inst_a: Institution,
    ) -> None:
        with pytest.raises(IntegrityError), atomic():
            Transfer.objects.create(
                species=species_cr,
                source_institution=inst_a,
                destination_institution=inst_a,
                proposed_date=date(2026, 5, 1),
            )

    def test_default_status_is_proposed(
        self,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        t = Transfer.objects.create(
            species=species_cr,
            source_institution=inst_a,
            destination_institution=inst_b,
            proposed_date=date(2026, 5, 1),
        )
        assert t.status == Transfer.Status.PROPOSED

    def test_ordering_by_proposed_date_desc(
        self,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        Transfer.objects.create(
            species=species_cr,
            source_institution=inst_a,
            destination_institution=inst_b,
            proposed_date=date(2026, 3, 1),
        )
        Transfer.objects.create(
            species=species_cr,
            source_institution=inst_b,
            destination_institution=inst_a,
            proposed_date=date(2026, 5, 1),
        )
        dates = list(Transfer.objects.values_list("proposed_date", flat=True))
        assert dates == [date(2026, 5, 1), date(2026, 3, 1)]

    def test_linked_to_coordinated_program(
        self,
        species_cr: Species,
        inst_a: Institution,
        inst_b: Institution,
    ) -> None:
        program = CoordinatedProgram.objects.create(
            species=species_cr,
            program_type=CoordinatedProgram.ProgramType.SSP,
            name="SSP",
        )
        t = Transfer.objects.create(
            species=species_cr,
            source_institution=inst_a,
            destination_institution=inst_b,
            proposed_date=date(2026, 5, 1),
            coordinated_program=program,
        )
        assert program.transfers.count() == 1
        assert t.coordinated_program == program
