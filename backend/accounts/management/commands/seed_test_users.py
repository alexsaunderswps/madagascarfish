"""Seed deterministic Tier 2 / Tier 3 / Tier 5 users for the Playwright e2e.

Idempotent: running multiple times is a no-op once the users exist.
Refuses to run unless ``settings.ALLOW_TEST_HELPERS`` is True.

The Tier 3 user belongs to a seeded "E2E Test Zoo" institution so the
coordinator dashboard's institution-scoped queries have a target. The
Tier 2 user has no institution (researcher path).
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from populations.models import Institution

# Single shared password for all e2e users. Long enough to satisfy
# password-validation (>=12 chars), explicitly recognizable as test data.
E2E_PASSWORD = "e2e-test-password-1234"

E2E_INSTITUTION_NAME = "E2E Test Zoo"


def _ensure_institution() -> Institution:
    inst, _ = Institution.objects.get_or_create(
        name=E2E_INSTITUTION_NAME,
        defaults={"institution_type": "zoo", "country": "Madagascar"},
    )
    return inst


def _ensure_user(
    *,
    email: str,
    name: str,
    access_tier: int,
    institution: Institution | None = None,
    is_staff: bool = False,
) -> tuple[User, bool]:
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "name": name,
            "access_tier": access_tier,
            "is_active": True,
            "is_staff": is_staff,
            "institution": institution,
        },
    )
    if created:
        user.set_password(E2E_PASSWORD)
        user.save(update_fields=["password"])
    return user, created


class Command(BaseCommand):
    help = (
        "Seed deterministic Tier 2 / Tier 3 / Tier 5 e2e users "
        "(test helper; ALLOW_TEST_HELPERS must be True)."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        if not getattr(settings, "ALLOW_TEST_HELPERS", False):
            raise CommandError(
                "ALLOW_TEST_HELPERS is not enabled. This command is for "
                "dev/CI use only and refuses to run otherwise."
            )

        institution = _ensure_institution()

        results: list[tuple[str, bool]] = []
        _, created = _ensure_user(
            email="researcher-e2e@example.com",
            name="E2E Researcher",
            access_tier=2,
        )
        results.append(("researcher-e2e@example.com", created))

        _, created = _ensure_user(
            email="coordinator-e2e@example.com",
            name="E2E Coordinator",
            access_tier=3,
            institution=institution,
        )
        results.append(("coordinator-e2e@example.com", created))

        _, created = _ensure_user(
            email="admin-e2e@example.com",
            name="E2E Admin",
            access_tier=5,
            is_staff=True,
        )
        results.append(("admin-e2e@example.com", created))

        for email, created in results:
            verb = "created" if created else "already present"
            self.stdout.write(f"  {email}: {verb}")
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(results)} e2e users."))
