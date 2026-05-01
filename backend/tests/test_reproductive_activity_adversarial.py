"""
Adversarial / edge-case tests for Panel 7 — Recent Reproductive Activity.
Tests written from acceptance criteria, NOT from implementation internals.

Covers:
- 90-day window boundary: exactly day 90 included, day 91 excluded
- Future-dated events: documented behavior (included or filtered?)
- Deleted-institution FK semantics (CASCADE on population.institution)
- recent_species cap of 5 when >=6 distinct species share a bucket
- Events with all count_delta_* = None serialize without crashing
- Tier 4 user with institution=NULL gets 200 (Tier 3+ gate)
- Inactive coordinator gets 403 via real credential-based auth
- Inactive coordinator gets 403 via force_authenticate too — regression
  guard for the explicit ``is_active`` check in
  ``TierOrServiceTokenPermission``. Without it, a deactivated user
  whose session bypasses ``EmailBackend.authenticate`` could keep tier
  access. See ``test_permission_class_checks_is_active_directly``.
- SQL injection via Authorization header does not grant access
- result_limit=30 returns the MOST RECENT 30 events, not the oldest
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from populations.models import (
    BreedingEvent,
    ExSituPopulation,
    Institution,
)
from species.models import Species
from species.views_coordinator_dashboard import (
    REPRODUCTIVE_ACTIVITY_RESULT_LIMIT,
    REPRODUCTIVE_ACTIVITY_WINDOW_DAYS,
)

ENDPOINT = "/api/v1/coordinator-dashboard/reproductive-activity/"
LOGIN_ENDPOINT = "/api/v1/auth/login/"


# ---------------------------------------------------------------------------
# shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def institution(db: None) -> Institution:
    return Institution.objects.create(name="Test Zoo", institution_type="zoo", country="MG")


@pytest.fixture
def tier3_user(institution: Institution) -> User:
    return User.objects.create_user(
        email="coord@example.com",
        password="securepass12345",
        name="Coordinator",
        access_tier=3,
        is_active=True,
        institution=institution,
    )


@pytest.fixture
def tier4_user(db: None) -> User:
    """Tier 4 with institution=NULL — valid scenario per the access model."""
    return User.objects.create_user(
        email="pm@example.com",
        password="securepass12345",
        name="Program Manager",
        access_tier=4,
        is_active=True,
        institution=None,
    )


@pytest.fixture
def base_species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="CR",
    )


@pytest.fixture
def population(base_species: Species, institution: Institution) -> ExSituPopulation:
    return ExSituPopulation.objects.create(
        species=base_species,
        institution=institution,
        count_total=12,
        breeding_status="breeding",
    )


# ---------------------------------------------------------------------------
# 1. 90-day window boundary
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestWindowBoundary:
    """The window filter uses __gte so the boundary day itself is included."""

    def test_event_exactly_at_boundary_included(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        """An event on today - 90 days is inside the window (gte, not gt)."""
        boundary_date = date.today() - timedelta(days=REPRODUCTIVE_ACTIVITY_WINDOW_DAYS)
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.SPAWNING,
            event_date=boundary_date,
            count_delta_unsexed=5,
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()

        assert body["total_events"] == 1, "Event exactly at day 90 must be included"
        assert body["by_event_type"]["spawning"]["count"] == 1

    def test_event_one_day_outside_boundary_excluded(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        """An event on today - 91 days is outside the window and must be excluded."""
        outside_date = date.today() - timedelta(days=REPRODUCTIVE_ACTIVITY_WINDOW_DAYS + 1)
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.SPAWNING,
            event_date=outside_date,
            count_delta_unsexed=5,
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()

        assert body["total_events"] == 0, "Event at day 91 must be excluded"
        assert body["by_event_type"]["spawning"]["count"] == 0

    def test_boundary_and_outside_together(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        """One event at boundary (included) + one outside (excluded) = total_events==1."""
        boundary_date = date.today() - timedelta(days=REPRODUCTIVE_ACTIVITY_WINDOW_DAYS)
        outside_date = date.today() - timedelta(days=REPRODUCTIVE_ACTIVITY_WINDOW_DAYS + 1)
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=boundary_date,
            count_delta_unsexed=3,
        )
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=outside_date,
            count_delta_unsexed=3,
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()

        assert body["total_events"] == 1


# ---------------------------------------------------------------------------
# 2. Future-dated events
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestFutureDatedEvents:
    """Document whether future events (event_date > today) appear in results.

    The window filter is event_date >= window_start, with no upper bound.
    Future-dated events therefore pass the filter and ARE included.
    This test documents the current behavior so a future spec change
    (adding an upper bound) is caught explicitly.
    """

    def test_future_event_is_included_in_results(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        """Future events currently pass the >=window_start filter — document this."""
        future_date = date.today() + timedelta(days=10)
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.SPAWNING,
            event_date=future_date,
            count_delta_unsexed=2,
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()

        # This asserts the ACTUAL behavior. If the spec later requires
        # future events to be excluded, this test will fail and alert the team.
        assert body["total_events"] == 1, (
            "Future-dated events currently appear in results (no upper bound on window filter). "
            "If this fails, the endpoint has added an upper-bound filter — update the spec."
        )
        assert body["results"][0]["event_date"] == future_date.isoformat()

    def test_future_event_appears_in_by_event_type_rollup(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        """Future-dated events count in the by_event_type rollup as well."""
        future_date = date.today() + timedelta(days=5)
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.ACQUISITION,
            event_date=future_date,
            count_delta_unsexed=4,
        )
        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()

        assert body["by_event_type"]["acquisition"]["count"] == 1


# ---------------------------------------------------------------------------
# 3. Institution CASCADE FK semantics
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestInstitutionCascade:
    """ExSituPopulation.institution is CASCADE. Deleting the institution
    removes the population rows which removes the BreedingEvent rows.
    The endpoint must return cleanly with zero results (not 5xx) after that."""

    def test_deleting_institution_cascades_to_events(
        self,
        api_client: APIClient,
        tier3_user: User,
        base_species: Species,
    ) -> None:
        # Create a separate institution + population + event (not using the
        # shared fixtures so we can delete this institution independently).
        ephemeral_inst = Institution.objects.create(
            name="Ephemeral Aquarium", institution_type="aquarium", country="FR"
        )
        pop = ExSituPopulation.objects.create(
            species=base_species,
            institution=ephemeral_inst,
            count_total=5,
            breeding_status="unknown",
        )
        BreedingEvent.objects.create(
            population=pop,
            event_type=BreedingEvent.EventType.HATCHING,
            event_date=date.today() - timedelta(days=5),
            count_delta_unsexed=10,
        )

        # Verify the event exists before deletion.
        assert BreedingEvent.objects.count() == 1

        # Delete the institution — CASCADE should remove population + event.
        ephemeral_inst.delete()

        assert ExSituPopulation.objects.count() == 0
        assert BreedingEvent.objects.count() == 0

        # Endpoint must still return 200 with empty payload.
        api_client.force_authenticate(user=tier3_user)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["total_events"] == 0
        assert body["results"] == []


# ---------------------------------------------------------------------------
# 4. recent_species cap at 5 with >=6 distinct species in the same bucket
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRecentSpeciesCap:
    """When >=6 distinct species have events of the same type,
    recent_species must be capped at exactly 5 entries."""

    def test_recent_species_hard_cap_at_5(
        self,
        api_client: APIClient,
        tier3_user: User,
        institution: Institution,
    ) -> None:
        families = [
            "Bedotiidae",
            "Cichlidae",
            "Aplocheilidae",
            "Anchariidae",
            "Cichlidae",
            "Bedotiidae",
        ]
        genera = [
            "Bedotia",
            "Paretroplus",
            "Pachypanchax",
            "Ancharius",
            "Ptychochromis",
            "Rheocles",
        ]
        names = [
            "Bedotia geayi",
            "Paretroplus menarambo",
            "Pachypanchax sakaramyi",
            "Ancharius fuscus",
            "Ptychochromis oligacanthus",
            "Rheocles wrightae",
        ]

        today = date.today()
        for i, sci_name in enumerate(names):
            sp = Species.objects.create(
                scientific_name=sci_name,
                taxonomic_status="described",
                family=families[i],
                genus=genera[i],
                endemic_status="endemic",
            )
            pop = ExSituPopulation.objects.create(
                species=sp,
                institution=institution,
                count_total=5,
                breeding_status="breeding",
            )
            BreedingEvent.objects.create(
                population=pop,
                event_type=BreedingEvent.EventType.MORTALITY,
                event_date=today - timedelta(days=i + 1),
                count_delta_unsexed=-1,
            )

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()

        bucket = body["by_event_type"]["mortality"]
        assert bucket["count"] == 6, "All 6 events should count in the rollup"
        assert len(bucket["recent_species"]) == 5, (
            "recent_species must be capped at 5 even when 6 species are present"
        )
        # Each entry in the list should be a distinct scientific name.
        assert len(set(bucket["recent_species"])) == 5, "No duplicates in recent_species"


# ---------------------------------------------------------------------------
# 5. All count_delta_* = None serializes cleanly
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestNullCountDeltas:
    """An event with count_delta_male/female/unsexed all NULL must serialize
    to JSON without crashing (None -> null, not a 5xx)."""

    def test_all_count_deltas_null_no_crash(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        BreedingEvent.objects.create(
            population=population,
            event_type=BreedingEvent.EventType.OTHER,
            event_date=date.today() - timedelta(days=1),
            count_delta_male=None,
            count_delta_female=None,
            count_delta_unsexed=None,
            notes="",
        )
        api_client.force_authenticate(user=tier3_user)
        resp = api_client.get(ENDPOINT)

        assert resp.status_code == status.HTTP_200_OK
        row = resp.json()["results"][0]
        assert row["count_delta_male"] is None
        assert row["count_delta_female"] is None
        assert row["count_delta_unsexed"] is None
        assert row["notes"] == ""


# ---------------------------------------------------------------------------
# 6. Tier 4 user with institution=NULL gets 200
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestTier4NullInstitution:
    """Tier 4 users satisfy the Tier 3+ gate regardless of institution field."""

    def test_tier4_no_institution_gets_200(
        self,
        api_client: APIClient,
        tier4_user: User,
    ) -> None:
        assert tier4_user.institution_id is None, "Fixture must have institution=NULL"
        api_client.force_authenticate(user=tier4_user)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_200_OK, (
            "Tier 4 user with institution=NULL must get 200 — institution field "
            "is independent of the tier-based access gate"
        )


# ---------------------------------------------------------------------------
# 7. Inactive coordinator gets 403
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestInactiveUser:
    """``is_active=False`` users must not be able to reach the endpoint by
    any path.

    Two complementary gates: ``EmailBackend.authenticate()`` rejects an
    inactive user's login attempt (so they can't get a fresh token), AND
    ``TierOrServiceTokenPermission`` checks ``request.user.is_active``
    explicitly (so a deactivated user with a force-authenticated session,
    a remembered token, or any other path that skipped the auth backend
    still gets a 403). The permission-class check is the regression guard
    for the latter; see ``test_permission_class_checks_is_active_directly``
    below.
    """

    def test_inactive_user_cannot_obtain_token(
        self,
        api_client: APIClient,
        institution: Institution,
    ) -> None:
        """An inactive user's login attempt must be rejected (401), preventing
        them from ever obtaining a token to authenticate with the endpoint."""
        User.objects.create_user(
            email="inactive@example.com",
            password="securepass12345",
            name="Inactive Coordinator",
            access_tier=3,
            is_active=False,
            institution=institution,
        )
        resp = api_client.post(
            LOGIN_ENDPOINT,
            {"email": "inactive@example.com", "password": "securepass12345"},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED, (
            "Inactive user must be blocked at the login step — no token issued"
        )

    def test_inactive_user_with_token_cannot_reach_endpoint(
        self,
        api_client: APIClient,
        institution: Institution,
    ) -> None:
        """If an active user's token is retained after deactivation, the endpoint
        must block them. Uses TokenAuthentication which calls get_user() and
        checks is_active on the user object before placing it on the request."""
        from rest_framework.authtoken.models import Token

        # Create user as active, mint a token, then deactivate them.
        user = User.objects.create_user(
            email="deactivated@example.com",
            password="securepass12345",
            name="Deactivated",
            access_tier=3,
            is_active=True,
            institution=institution,
        )
        token = Token.objects.create(user=user)
        user.is_active = False
        user.save()

        api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED, (
            "A deactivated user's retained token must be rejected — "
            "DRF TokenAuthentication checks is_active before setting request.user"
        )

    def test_permission_class_checks_is_active_directly(
        self,
        api_client: APIClient,
        institution: Institution,
    ) -> None:
        """``TierOrServiceTokenPermission`` (and its sibling ``TierPermission``)
        gate explicitly on ``request.user.is_active`` so a deactivated
        operator with a force-authenticated session, a remembered SessionID,
        or any other path that bypasses ``EmailBackend.authenticate`` cannot
        keep tier access alive after their account is disabled.
        Regression guard for the security fix in
        ``backend/accounts/permissions.py``."""
        inactive_coord = User.objects.create_user(
            email="inactive2@example.com",
            password="securepass12345",
            name="Inactive Coordinator",
            access_tier=3,
            is_active=False,
            institution=institution,
        )
        api_client.force_authenticate(user=inactive_coord)
        resp = api_client.get(ENDPOINT)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# 8. SQL injection via Authorization header
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAuthorizationHeaderInjection:
    """The service-token path reads the Authorization header and does a
    constant-time compare. Injected SQL/special chars must not grant access."""

    def test_sql_injection_in_bearer_token_rejected(
        self,
        api_client: APIClient,
        settings: object,
    ) -> None:
        settings.COORDINATOR_API_TOKEN = "real-secret-token"  # type: ignore[attr-defined]
        injection_payloads = [
            "' OR '1'='1",
            "real-secret-token' OR '1'='1",
            "real-secret-token; DROP TABLE auth_user; --",
            "Bearer real-secret-token",  # double-Bearer nesting
            "",
        ]
        for payload in injection_payloads:
            resp = api_client.get(ENDPOINT, HTTP_AUTHORIZATION=f"Bearer {payload}")
            assert resp.status_code == status.HTTP_401_UNAUTHORIZED, (
                f"Injection payload {payload!r} must not grant access"
            )

    def test_null_byte_in_bearer_token_rejected(
        self,
        api_client: APIClient,
        settings: object,
    ) -> None:
        settings.COORDINATOR_API_TOKEN = "real-secret-token"  # type: ignore[attr-defined]
        resp = api_client.get(ENDPOINT, HTTP_AUTHORIZATION="Bearer real-secret-token\x00extra")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_correct_token_still_grants_access(
        self,
        api_client: APIClient,
        settings: object,
    ) -> None:
        """Sanity: valid token must still work after the injection tests."""
        settings.COORDINATOR_API_TOKEN = "real-secret-token"  # type: ignore[attr-defined]
        resp = api_client.get(ENDPOINT, HTTP_AUTHORIZATION="Bearer real-secret-token")
        assert resp.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# 9. result_limit=30 returns the MOST RECENT events, not the oldest
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestResultOrdering:
    """The cap must retain the newest REPRODUCTIVE_ACTIVITY_RESULT_LIMIT events.
    Creating N+5 events spread over N+5 days verifies that the oldest 5
    are dropped, not the newest 5."""

    def test_most_recent_30_events_returned_not_oldest(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        today = date.today()
        total = REPRODUCTIVE_ACTIVITY_RESULT_LIMIT + 5  # 35

        # Create events with distinct dates so ordering is unambiguous.
        # days_ago=1 is most recent; days_ago=35 is oldest.
        for days_ago in range(1, total + 1):
            BreedingEvent.objects.create(
                population=population,
                event_type=BreedingEvent.EventType.HATCHING,
                event_date=today - timedelta(days=days_ago),
                count_delta_unsexed=days_ago,  # unique value per event
            )

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()

        assert body["total_events"] == total
        results = body["results"]
        assert len(results) == REPRODUCTIVE_ACTIVITY_RESULT_LIMIT

        returned_dates = [r["event_date"] for r in results]

        # Most recent event (days_ago=1) must be present.
        most_recent = (today - timedelta(days=1)).isoformat()
        assert most_recent in returned_dates, "Most recent event must be in capped result list"

        # Oldest event (days_ago=35) must NOT be present.
        oldest = (today - timedelta(days=total)).isoformat()
        assert oldest not in returned_dates, (
            "Oldest event must be dropped when total exceeds result_limit"
        )

        # Results must be ordered newest-first.
        assert returned_dates == sorted(returned_dates, reverse=True), (
            "Results must be ordered newest-first"
        )

    def test_total_events_reflects_all_events_not_just_results(
        self,
        api_client: APIClient,
        tier3_user: User,
        population: ExSituPopulation,
    ) -> None:
        """total_events must count ALL events in the window, not just the capped result list."""
        today = date.today()
        total = REPRODUCTIVE_ACTIVITY_RESULT_LIMIT + 10  # 40

        for i in range(total):
            BreedingEvent.objects.create(
                population=population,
                event_type=BreedingEvent.EventType.MORTALITY,
                event_date=today - timedelta(days=i + 1),
                count_delta_unsexed=-1,
            )

        api_client.force_authenticate(user=tier3_user)
        body = api_client.get(ENDPOINT).json()

        assert body["total_events"] == total, (
            "total_events must reflect all window events, not the capped result count"
        )
        assert len(body["results"]) == REPRODUCTIVE_ACTIVITY_RESULT_LIMIT
