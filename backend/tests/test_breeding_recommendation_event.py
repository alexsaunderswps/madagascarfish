"""Model-level tests for BreedingRecommendation + BreedingEvent
(Gate 4 Phase 2)."""

from __future__ import annotations

from datetime import date

import pytest

from populations.models import (
    BreedingEvent,
    BreedingRecommendation,
    CoordinatedProgram,
    ExSituPopulation,
    Institution,
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
def inst(db: None) -> Institution:
    return Institution.objects.create(
        name="Bristol Zoo Project",
        institution_type="zoo",
        country="United Kingdom",
    )


@pytest.fixture
def population(species_cr: Species, inst: Institution) -> ExSituPopulation:
    return ExSituPopulation.objects.create(
        species=species_cr,
        institution=inst,
        count_total=12,
        count_male=5,
        count_female=6,
        count_unsexed=1,
        breeding_status="breeding",
    )


@pytest.fixture
def program(species_cr: Species, inst: Institution) -> CoordinatedProgram:
    return CoordinatedProgram.objects.create(
        species=species_cr,
        program_type=CoordinatedProgram.ProgramType.EEP,
        name="EAZA EEP: Madagascar rainbowfishes",
        coordinating_institution=inst,
    )


@pytest.mark.django_db
class TestBreedingRecommendation:
    def test_basic_create(self, species_cr: Species, program: CoordinatedProgram) -> None:
        r = BreedingRecommendation.objects.create(
            species=species_cr,
            coordinated_program=program,
            recommendation_type=BreedingRecommendation.RecommendationType.BREED,
            priority=BreedingRecommendation.Priority.HIGH,
            issued_date=date(2026, 4, 1),
            rationale="Genetic bottleneck — expand F2.",
        )
        assert r.pk is not None
        assert r.status == BreedingRecommendation.Status.OPEN  # default
        assert "Breed" in str(r)

    def test_defaults(self, species_cr: Species) -> None:
        r = BreedingRecommendation.objects.create(
            species=species_cr,
            recommendation_type=BreedingRecommendation.RecommendationType.NON_BREED,
            issued_date=date(2026, 4, 1),
        )
        assert r.priority == BreedingRecommendation.Priority.MEDIUM
        assert r.status == BreedingRecommendation.Status.OPEN

    def test_all_recommendation_types(self, species_cr: Species) -> None:
        for rtype in BreedingRecommendation.RecommendationType.values:
            BreedingRecommendation.objects.create(
                species=species_cr,
                recommendation_type=rtype,
                issued_date=date(2026, 4, 1),
            )
        assert BreedingRecommendation.objects.filter(species=species_cr).count() == len(
            BreedingRecommendation.RecommendationType.choices
        )

    def test_terminal_states(self, species_cr: Species) -> None:
        terminal = {
            BreedingRecommendation.Status.COMPLETED,
            BreedingRecommendation.Status.SUPERSEDED,
            BreedingRecommendation.Status.CANCELLED,
        }
        for status in terminal:
            r = BreedingRecommendation.objects.create(
                species=species_cr,
                recommendation_type=BreedingRecommendation.RecommendationType.BREED,
                issued_date=date(2026, 4, 1),
                status=status,
            )
            assert r.status == status

    def test_ordering_newest_issued_first(self, species_cr: Species) -> None:
        BreedingRecommendation.objects.create(
            species=species_cr,
            recommendation_type=BreedingRecommendation.RecommendationType.BREED,
            issued_date=date(2026, 1, 15),
        )
        BreedingRecommendation.objects.create(
            species=species_cr,
            recommendation_type=BreedingRecommendation.RecommendationType.TRANSFER,
            issued_date=date(2026, 4, 15),
        )
        dates = list(BreedingRecommendation.objects.values_list("issued_date", flat=True))
        assert dates == [date(2026, 4, 15), date(2026, 1, 15)]

    def test_linked_to_program(
        self,
        species_cr: Species,
        program: CoordinatedProgram,
    ) -> None:
        r = BreedingRecommendation.objects.create(
            species=species_cr,
            coordinated_program=program,
            recommendation_type=BreedingRecommendation.RecommendationType.BREED,
            issued_date=date(2026, 4, 1),
        )
        assert program.breeding_recommendations.count() == 1
        assert r.coordinated_program == program

    def test_linked_to_population(
        self,
        species_cr: Species,
        population: ExSituPopulation,
    ) -> None:
        r = BreedingRecommendation.objects.create(
            species=species_cr,
            source_population=population,
            recommendation_type=BreedingRecommendation.RecommendationType.BREED,
            issued_date=date(2026, 4, 1),
        )
        assert population.breeding_recommendations_source.count() == 1
        assert r.source_population == population


@pytest.mark.django_db
class TestBreedingEvent:
    def test_basic_create(self, population: ExSituPopulation) -> None:
        e = BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.SPAWNING,
            event_date=date(2026, 4, 10),
            count_delta_unsexed=20,
            notes="First spawning of the season.",
        )
        assert e.pk is not None
        assert "Spawning" in str(e)

    def test_all_event_types(self, population: ExSituPopulation) -> None:
        for etype in BreedingEvent.EventType.values:
            BreedingEvent.objects.create(
                population=population,
                event_type=etype,
                event_date=date(2026, 4, 10),
            )
        assert BreedingEvent.objects.filter(population=population).count() == len(
            BreedingEvent.EventType.choices
        )

    def test_signed_deltas_allowed(self, population: ExSituPopulation) -> None:
        loss = BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.MORTALITY,
            event_date=date(2026, 4, 10),
            count_delta_male=-3,
            count_delta_female=-1,
        )
        gain = BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=date(2026, 4, 15),
            count_delta_unsexed=30,
        )
        assert loss.count_delta_male == -3
        assert loss.count_delta_female == -1
        assert gain.count_delta_unsexed == 30

    def test_ordering_newest_first(self, population: ExSituPopulation) -> None:
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.SPAWNING,
            event_date=date(2026, 2, 1),
        )
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.MORTALITY,
            event_date=date(2026, 4, 1),
        )
        dates = list(BreedingEvent.objects.values_list("event_date", flat=True))
        assert dates == [date(2026, 4, 1), date(2026, 2, 1)]

    def test_population_cascade_delete(
        self,
        population: ExSituPopulation,
    ) -> None:
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.SPAWNING,
            event_date=date(2026, 4, 1),
        )
        population_id = population.id
        population.delete()
        assert BreedingEvent.objects.filter(population_id=population_id).count() == 0

    def test_related_name_on_population(
        self,
        population: ExSituPopulation,
    ) -> None:
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.SPAWNING,
            event_date=date(2026, 4, 1),
        )
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=date(2026, 4, 14),
        )
        assert population.breeding_events.count() == 2
