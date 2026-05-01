"""Tests for the public institution profile endpoint.

`GET /api/v1/institutions/<id>/profile/` — public, no auth required.
Returns the institution detail plus aggregate context: species held
(name only), population count, led programs, partner programs.
"""

from __future__ import annotations

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from fieldwork.models import FieldProgram
from populations.models import ExSituPopulation, Institution
from species.models import Species


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def institution_a(db: None) -> Institution:
    return Institution.objects.create(
        name="ABQ BioPark",
        institution_type="aquarium",
        country="US",
        city="Albuquerque",
        website="https://example.org",
        zims_member=True,
    )


@pytest.fixture
def species_x(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def species_y(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        taxonomic_status="described",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status="EN",
    )


@pytest.mark.django_db
class TestProfile:
    def test_anonymous_can_access(self, api_client: APIClient, institution_a: Institution) -> None:
        resp = api_client.get(f"/api/v1/institutions/{institution_a.pk}/profile/")
        assert resp.status_code == status.HTTP_200_OK

    def test_returns_institution_metadata(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        body = api_client.get(f"/api/v1/institutions/{institution_a.pk}/profile/").json()
        assert body["institution"]["name"] == "ABQ BioPark"
        assert body["institution"]["institution_type"] == "aquarium"
        # contact_email + species360_id remain hidden for anonymous (Tier 1).
        assert "contact_email" not in body["institution"]
        assert "species360_id" not in body["institution"]
        assert body["institution"]["zims_member"] is True

    def test_species_held_includes_only_held_species(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species_x: Species,
        species_y: Species,
    ) -> None:
        ExSituPopulation.objects.create(
            species=species_x, institution=institution_a, count_total=18
        )
        # species_y exists but is NOT held by institution_a.
        body = api_client.get(f"/api/v1/institutions/{institution_a.pk}/profile/").json()
        held = body["species_held"]
        assert len(held) == 1
        assert held[0]["scientific_name"] == "Paretroplus menarambo"
        assert held[0]["iucn_status"] == "CR"
        # Counts are deliberately NOT exposed publicly — only species names.
        assert "count_total" not in held[0]

    def test_species_held_deduplicates(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species_x: Species,
    ) -> None:
        # Single ExSituPopulation per (species, institution) due to unique
        # constraint, so dedup is implicit, but assert the response shape
        # carries one row per species regardless.
        ExSituPopulation.objects.create(
            species=species_x, institution=institution_a, count_total=10
        )
        body = api_client.get(f"/api/v1/institutions/{institution_a.pk}/profile/").json()
        assert len(body["species_held"]) == 1

    def test_populations_count(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species_x: Species,
        species_y: Species,
    ) -> None:
        ExSituPopulation.objects.create(species=species_x, institution=institution_a)
        ExSituPopulation.objects.create(species=species_y, institution=institution_a)
        body = api_client.get(f"/api/v1/institutions/{institution_a.pk}/profile/").json()
        assert body["populations_count"] == 2

    def test_led_programs(self, api_client: APIClient, institution_a: Institution) -> None:
        fp = FieldProgram.objects.create(
            name="Manombo monitoring",
            description="Surveys.",
            lead_institution=institution_a,
            status="active",
        )
        body = api_client.get(f"/api/v1/institutions/{institution_a.pk}/profile/").json()
        led = body["led_programs"]
        assert len(led) == 1
        assert led[0] == {"id": fp.pk, "name": "Manombo monitoring", "status": "active"}
        assert body["partner_programs"] == []

    def test_partner_programs(
        self,
        api_client: APIClient,
        institution_a: Institution,
    ) -> None:
        other = Institution.objects.create(
            name="Other lead", institution_type="research_org", country="MG"
        )
        fp = FieldProgram.objects.create(
            name="Partnered survey",
            description="x",
            lead_institution=other,
            status="planned",
        )
        fp.partner_institutions.add(institution_a)
        body = api_client.get(f"/api/v1/institutions/{institution_a.pk}/profile/").json()
        partners = body["partner_programs"]
        assert len(partners) == 1
        assert partners[0]["name"] == "Partnered survey"
        # institution_a is NOT the lead, so led_programs stays empty
        assert body["led_programs"] == []

    def test_empty_institution(self, api_client: APIClient, institution_a: Institution) -> None:
        body = api_client.get(f"/api/v1/institutions/{institution_a.pk}/profile/").json()
        assert body["species_held"] == []
        assert body["populations_count"] == 0
        assert body["led_programs"] == []
        assert body["partner_programs"] == []

    def test_nonexistent_institution_returns_404(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/institutions/99999/profile/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND
