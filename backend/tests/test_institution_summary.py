"""Tests for the institution-dashboard aggregate panel.

Endpoint: ``GET /api/v1/institution-summary/[?institution_id=N]``

Coverage:
- Auth: anonymous → 401, Tier 1 → 403, Tier 2 with no institution → 403.
- Tier 2 sees their own institution; can't read other institutions even
  via ``?institution_id``.
- Tier 3+ can read any institution and defaults to their own.
- Aggregates: per-species share %, global count, institutions holding,
  recent breeding-event count.
- Census-freshness rollup distinguishes fresh / stale / never-censused.
- Breakdown sorted by share descending.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from populations.models import BreedingEvent, ExSituPopulation, Institution
from species.models import Species

ENDPOINT = "/api/v1/institution-summary/"


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def institution_a(db: None) -> Institution:
    return Institution.objects.create(name="Aquarium A", institution_type="aquarium", country="US")


@pytest.fixture
def institution_b(db: None) -> Institution:
    return Institution.objects.create(name="Aquarium B", institution_type="aquarium", country="US")


@pytest.fixture
def institution_c(db: None) -> Institution:
    return Institution.objects.create(name="Aquarium C", institution_type="aquarium", country="DE")


@pytest.fixture
def species_paretroplus(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def species_bedotia(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        taxonomic_status="described",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status="EN",
    )


def _user(
    *,
    email: str,
    tier: int,
    institution: Institution | None = None,
    is_active: bool = True,
) -> User:
    return User.objects.create_user(
        email=email,
        password="securepass12345",
        name=email.split("@")[0],
        access_tier=tier,
        is_active=is_active,
        institution=institution,
    )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAuth:
    def test_anonymous_unauthorized(self, api_client: APIClient) -> None:
        assert api_client.get(ENDPOINT).status_code == 401

    def test_tier1_forbidden(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="t1@example.com", tier=1))
        assert api_client.get(ENDPOINT).status_code == 403

    def test_tier2_no_institution_forbidden(self, api_client: APIClient) -> None:
        api_client.force_authenticate(user=_user(email="t2@example.com", tier=2))
        assert api_client.get(ENDPOINT).status_code == 403

    def test_tier2_cannot_query_other_institution(
        self, api_client: APIClient, institution_a: Institution, institution_b: Institution
    ) -> None:
        api_client.force_authenticate(
            user=_user(email="t2cross@example.com", tier=2, institution=institution_a)
        )
        resp = api_client.get(f"{ENDPOINT}?institution_id={institution_b.pk}")
        assert resp.status_code == 403

    def test_tier3_no_institution_query_required(self, api_client: APIClient) -> None:
        # Tier 3 with no institution AND no query param → 404 (nothing to summarize).
        api_client.force_authenticate(user=_user(email="coord@example.com", tier=3))
        assert api_client.get(ENDPOINT).status_code == 404

    def test_tier3_can_query_any_institution(
        self, api_client: APIClient, institution_a: Institution, institution_b: Institution
    ) -> None:
        api_client.force_authenticate(
            user=_user(email="coord2@example.com", tier=3, institution=institution_a)
        )
        resp = api_client.get(f"{ENDPOINT}?institution_id={institution_b.pk}")
        assert resp.status_code == 200
        assert resp.json()["institution"]["id"] == institution_b.pk

    def test_tier3_default_to_own_institution(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        api_client.force_authenticate(
            user=_user(email="coord3@example.com", tier=3, institution=institution_a)
        )
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == 200
        assert resp.json()["institution"]["id"] == institution_a.pk


# ---------------------------------------------------------------------------
# Aggregate logic
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAggregates:
    def test_share_percentage_computed_correctly(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        species_paretroplus: Species,
    ) -> None:
        # A has 18, B has 82 → A's share is 18%.
        ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_a, count_total=18
        )
        ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_b, count_total=82
        )
        api_client.force_authenticate(
            user=_user(email="agg@example.com", tier=2, institution=institution_a)
        )
        body = api_client.get(ENDPOINT).json()
        breakdown = body["species_breakdown"]
        assert len(breakdown) == 1
        row = breakdown[0]
        assert row["this_institution_count"] == 18
        assert row["global_count"] == 100
        assert row["share_pct"] == 18.0
        assert row["institutions_holding"] == 2

    def test_zero_global_count_renders_zero_share(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species_paretroplus: Species,
    ) -> None:
        # Population row exists but count_total is NULL — share computed as 0.0.
        ExSituPopulation.objects.create(species=species_paretroplus, institution=institution_a)
        api_client.force_authenticate(
            user=_user(email="zero@example.com", tier=2, institution=institution_a)
        )
        body = api_client.get(ENDPOINT).json()
        row = body["species_breakdown"][0]
        assert row["this_institution_count"] == 0
        assert row["global_count"] == 0
        assert row["share_pct"] == 0.0

    def test_breakdown_sorted_by_share_descending(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        species_paretroplus: Species,
        species_bedotia: Species,
    ) -> None:
        # Paretroplus: A holds 18 of 100 = 18%
        ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_a, count_total=18
        )
        ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_b, count_total=82
        )
        # Bedotia: A holds 30 of 50 = 60% — should sort first.
        ExSituPopulation.objects.create(
            species=species_bedotia, institution=institution_a, count_total=30
        )
        ExSituPopulation.objects.create(
            species=species_bedotia, institution=institution_b, count_total=20
        )
        api_client.force_authenticate(
            user=_user(email="sort@example.com", tier=2, institution=institution_a)
        )
        body = api_client.get(ENDPOINT).json()
        breakdown = body["species_breakdown"]
        assert breakdown[0]["species"]["scientific_name"] == "Bedotia geayi"
        assert breakdown[0]["share_pct"] == 60.0
        assert breakdown[1]["species"]["scientific_name"] == "Paretroplus menarambo"

    def test_recent_breeding_events_counted_globally(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        species_paretroplus: Species,
    ) -> None:
        pop_a = ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_a, count_total=18
        )
        pop_b = ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_b, count_total=82
        )
        # 2 events at A, 3 at B. The species' recent count should be 5.
        for _ in range(2):
            BreedingEvent.objects.create(
                population=pop_a, event_type="hatching", event_date=date(2026, 4, 1)
            )
        for _ in range(3):
            BreedingEvent.objects.create(
                population=pop_b, event_type="hatching", event_date=date(2026, 4, 2)
            )
        # An event >365 days ago should NOT be counted.
        BreedingEvent.objects.create(
            population=pop_a,
            event_type="hatching",
            event_date=date(2024, 1, 1),
        )
        api_client.force_authenticate(
            user=_user(email="ev@example.com", tier=2, institution=institution_a)
        )
        body = api_client.get(ENDPOINT).json()
        row = body["species_breakdown"][0]
        assert row["recent_breeding_events"] == 5

    def test_totals_block(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species_paretroplus: Species,
        species_bedotia: Species,
    ) -> None:
        today = timezone.now().date()
        fresh = today - timedelta(days=100)
        stale = today - timedelta(days=500)

        pop_fresh = ExSituPopulation.objects.create(
            species=species_paretroplus,
            institution=institution_a,
            count_total=18,
            last_census_date=fresh,
        )
        ExSituPopulation.objects.create(
            species=species_bedotia,
            institution=institution_a,
            count_total=30,
            last_census_date=stale,  # >365d old → counts as stale
        )
        BreedingEvent.objects.create(
            population=pop_fresh, event_type="hatching", event_date=date(2026, 4, 1)
        )
        api_client.force_authenticate(
            user=_user(email="tot@example.com", tier=2, institution=institution_a)
        )
        body = api_client.get(ENDPOINT).json()
        totals = body["totals"]
        assert totals["populations"] == 2
        assert totals["species"] == 2
        assert totals["fresh_census_count"] == 1
        assert totals["stale_census_count"] == 1
        assert totals["breeding_events_last_12_months"] == 1

    def test_null_last_census_counts_as_stale(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species_paretroplus: Species,
    ) -> None:
        ExSituPopulation.objects.create(
            species=species_paretroplus,
            institution=institution_a,
            count_total=18,
            last_census_date=None,
        )
        api_client.force_authenticate(
            user=_user(email="never@example.com", tier=2, institution=institution_a)
        )
        body = api_client.get(ENDPOINT).json()
        totals = body["totals"]
        assert totals["fresh_census_count"] == 0
        assert totals["stale_census_count"] == 1


@pytest.mark.django_db
class TestEdgeCases:
    def test_institution_with_no_populations(
        self, api_client: APIClient, institution_c: Institution
    ) -> None:
        api_client.force_authenticate(
            user=_user(email="empty@example.com", tier=2, institution=institution_c)
        )
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == 200
        body = resp.json()
        assert body["totals"]["populations"] == 0
        assert body["species_breakdown"] == []

    def test_invalid_institution_id(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        api_client.force_authenticate(
            user=_user(email="bad@example.com", tier=3, institution=institution_a)
        )
        resp = api_client.get(f"{ENDPOINT}?institution_id=not-a-number")
        assert resp.status_code == 404

    def test_nonexistent_institution_id(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        api_client.force_authenticate(
            user=_user(email="nx@example.com", tier=3, institution=institution_a)
        )
        resp = api_client.get(f"{ENDPOINT}?institution_id=999999")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestRecentActivity:
    def test_empty_when_no_audit_entries(
        self, api_client: APIClient, institution_a: Institution
    ) -> None:
        api_client.force_authenticate(
            user=_user(email="empty-feed@example.com", tier=2, institution=institution_a)
        )
        body = api_client.get(ENDPOINT).json()
        assert body["recent_activity"] == []

    def test_includes_population_edits_at_own_institution(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species_paretroplus: Species,
    ) -> None:
        from audit.models import AuditEntry

        pop = ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_a, count_total=10
        )
        keeper = _user(email="actor1@example.com", tier=2, institution=institution_a)
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_user=keeper,
            actor_institution_id=institution_a.pk,
            action=AuditEntry.Action.UPDATE,
            before={"count_total": 10},
            after={"count_total": 12},
            reason="",
        )
        api_client.force_authenticate(user=keeper)
        body = api_client.get(ENDPOINT).json()
        feed = body["recent_activity"]
        assert len(feed) == 1
        row = feed[0]
        assert row["target_type"] == "populations.ExSituPopulation"
        assert row["actor_email"] == "actor1@example.com"
        assert row["is_own_institution"] is True
        assert "Paretroplus menarambo" in row["target_label"]
        assert row["changes_summary"] == "count_total"

    def test_includes_coordinator_override_at_my_institution(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        species_paretroplus: Species,
    ) -> None:
        # A coordinator (institution_b) edits a population at institution_a.
        # The owner-side viewer (institution_a) sees the row in their feed
        # with is_own_institution=False — surfacing "coordinator did this."
        from audit.models import AuditEntry

        pop = ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_a, count_total=10
        )
        coord = _user(email="coord-edit@example.com", tier=3, institution=institution_b)
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_user=coord,
            actor_institution_id=institution_b.pk,
            action=AuditEntry.Action.UPDATE,
            before={"count_total": 10},
            after={"count_total": 12},
            reason="",
        )
        # Viewer is at institution_a, the population's owner
        viewer = _user(email="viewer@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=viewer)
        body = api_client.get(ENDPOINT).json()
        feed = body["recent_activity"]
        assert len(feed) == 1
        assert feed[0]["actor_email"] == "coord-edit@example.com"
        assert feed[0]["is_own_institution"] is False

    def test_excludes_other_institutions_targets(
        self,
        api_client: APIClient,
        institution_a: Institution,
        institution_b: Institution,
        species_paretroplus: Species,
    ) -> None:
        from audit.models import AuditEntry

        # An audit row for a population at institution_b — neither the
        # actor nor the target is at institution_a, so viewer at A sees
        # nothing.
        pop = ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_b, count_total=20
        )
        keeper_b = _user(email="bee@example.com", tier=2, institution=institution_b)
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=pop.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_user=keeper_b,
            actor_institution_id=institution_b.pk,
            action=AuditEntry.Action.UPDATE,
            before={"count_total": 20},
            after={"count_total": 22},
            reason="",
        )
        viewer = _user(email="viewer-a@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=viewer)
        body = api_client.get(ENDPOINT).json()
        assert body["recent_activity"] == []

    def test_capped_at_limit(
        self,
        api_client: APIClient,
        institution_a: Institution,
        species_paretroplus: Species,
    ) -> None:
        from audit.models import AuditEntry

        pop = ExSituPopulation.objects.create(
            species=species_paretroplus, institution=institution_a, count_total=10
        )
        for i in range(40):
            AuditEntry.objects.create(
                target_type="populations.ExSituPopulation",
                target_id=pop.pk,
                actor_type=AuditEntry.ActorType.USER,
                actor_institution_id=institution_a.pk,
                action=AuditEntry.Action.UPDATE,
                before={"count_total": 10 + i},
                after={"count_total": 11 + i},
                reason="",
            )
        keeper = _user(email="lots@example.com", tier=2, institution=institution_a)
        api_client.force_authenticate(user=keeper)
        body = api_client.get(ENDPOINT).json()
        # Default limit is 25.
        assert len(body["recent_activity"]) == 25
