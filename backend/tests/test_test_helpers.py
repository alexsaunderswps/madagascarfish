"""Coverage for the Gate-11-C9 test-helper management commands.

Both `seed_test_users` and `get_verification_token` are gated behind
`settings.ALLOW_TEST_HELPERS`. They MUST refuse to run with a clear
error when that flag is False (the production posture). Both are
otherwise expected to be safe and idempotent.
"""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.core.signing import TimestampSigner
from django.test import override_settings

from accounts.models import User


# --- seed_test_users ---


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=False)
def test_seed_test_users_refuses_when_flag_off() -> None:
    with pytest.raises(CommandError, match="ALLOW_TEST_HELPERS"):
        call_command("seed_test_users")


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_seed_test_users_creates_three_users_with_correct_tiers() -> None:
    out = StringIO()
    call_command("seed_test_users", stdout=out)

    researcher = User.objects.get(email="researcher-e2e@example.com")
    coordinator = User.objects.get(email="coordinator-e2e@example.com")
    admin = User.objects.get(email="admin-e2e@example.com")

    assert researcher.access_tier == 2
    assert researcher.is_active is True
    assert researcher.institution is None

    assert coordinator.access_tier == 3
    assert coordinator.institution is not None
    assert coordinator.institution.name == "E2E Test Zoo"

    assert admin.access_tier == 5
    assert admin.is_staff is True


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_seed_test_users_is_idempotent() -> None:
    call_command("seed_test_users", stdout=StringIO())
    call_command("seed_test_users", stdout=StringIO())  # second call is a no-op
    assert User.objects.filter(email__endswith="@example.com").count() == 3


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_seed_test_users_login_succeeds_with_documented_password() -> None:
    # The published password must work — Playwright relies on it.
    call_command("seed_test_users", stdout=StringIO())
    user = User.objects.get(email="coordinator-e2e@example.com")
    assert user.check_password("e2e-test-password-1234")


# --- get_verification_token ---


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=False)
def test_get_verification_token_refuses_when_flag_off() -> None:
    User.objects.create_user(
        email="pending@example.com", password="x" * 12, name="P", is_active=False
    )
    with pytest.raises(CommandError, match="ALLOW_TEST_HELPERS"):
        call_command("get_verification_token", "--email=pending@example.com")


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_get_verification_token_emits_a_token_that_unsigns_to_user_pk() -> None:
    user = User.objects.create_user(
        email="pending@example.com",
        password="long-strong-password-12",
        name="Pending",
        is_active=False,
    )

    out = StringIO()
    call_command("get_verification_token", "--email=pending@example.com", stdout=out)
    token = out.getvalue().strip()

    # Same TimestampSigner shape as accounts.views.signer; unsigning yields the user pk.
    assert TimestampSigner().unsign(token) == str(user.pk)


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_get_verification_token_errors_when_user_not_found() -> None:
    with pytest.raises(CommandError, match="No user with email"):
        call_command("get_verification_token", "--email=missing@example.com")


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_get_verification_token_errors_when_user_already_active() -> None:
    User.objects.create_user(
        email="done@example.com",
        password="long-strong-password-12",
        name="Done",
        is_active=True,
    )
    with pytest.raises(CommandError, match="already active"):
        call_command("get_verification_token", "--email=done@example.com")


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_get_verification_token_normalizes_email_case_and_whitespace() -> None:
    User.objects.create_user(
        email="pending@example.com",
        password="long-strong-password-12",
        name="Pending",
        is_active=False,
    )
    out = StringIO()
    call_command("get_verification_token", "--email=  Pending@Example.COM  ", stdout=out)
    # If lookup fails, this raises — passing means the email was normalized.
    assert out.getvalue().strip()


# --- /api/v1/auth/_test/verification-token/ HTTP endpoint ---


_TEST_ENDPOINT = "/api/v1/auth/_test/verification-token/"


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=False)
def test_test_endpoint_returns_404_when_flag_off() -> None:
    from rest_framework.test import APIClient

    User.objects.create_user(
        email="pending@example.com", password="x" * 12, name="P", is_active=False
    )
    client = APIClient()
    response = client.get(f"{_TEST_ENDPOINT}?email=pending@example.com")
    assert response.status_code == 404


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_test_endpoint_returns_token_for_pending_user() -> None:
    from rest_framework.test import APIClient

    user = User.objects.create_user(
        email="pending@example.com",
        password="long-strong-password-12",
        name="Pending",
        is_active=False,
    )
    client = APIClient()
    response = client.get(f"{_TEST_ENDPOINT}?email=pending@example.com")
    assert response.status_code == 200
    token = response.json()["token"]
    assert TimestampSigner().unsign(token) == str(user.pk)


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_test_endpoint_returns_404_for_missing_email() -> None:
    from rest_framework.test import APIClient

    response = APIClient().get(f"{_TEST_ENDPOINT}?email=missing@example.com")
    assert response.status_code == 404


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_test_endpoint_returns_404_for_already_active_user() -> None:
    from rest_framework.test import APIClient

    User.objects.create_user(
        email="done@example.com",
        password="long-strong-password-12",
        name="Done",
        is_active=True,
    )
    response = APIClient().get(f"{_TEST_ENDPOINT}?email=done@example.com")
    assert response.status_code == 404


@pytest.mark.django_db
@override_settings(ALLOW_TEST_HELPERS=True)
def test_test_endpoint_returns_404_when_email_query_param_blank() -> None:
    from rest_framework.test import APIClient

    response = APIClient().get(_TEST_ENDPOINT)
    assert response.status_code == 404
