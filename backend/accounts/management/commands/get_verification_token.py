"""Print the email-verification token for a given account.

Used by the Gate 11 Playwright e2e to bypass the real email vendor —
the test creates a user via /signup, then calls this command to obtain
the same TimestampSigner-signed token that registration would have
emailed, and uses it directly against /verify.

Refuses to run unless ``settings.ALLOW_TEST_HELPERS`` is True. Printing
a verification token to stdout is fine in dev/CI but a credential leak
in production, hence the explicit gate.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.signing import TimestampSigner

from accounts.models import User

_signer = TimestampSigner()


class Command(BaseCommand):
    help = (
        "Print the verification token for a user account "
        "(test helper; ALLOW_TEST_HELPERS must be True)."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--email",
            required=True,
            help="Email of the user to mint a verification token for.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        if not getattr(settings, "ALLOW_TEST_HELPERS", False):
            raise CommandError(
                "ALLOW_TEST_HELPERS is not enabled. This command is for "
                "dev/CI use only and refuses to run otherwise."
            )

        email = options["email"].strip().lower()
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as exc:
            raise CommandError(f"No user with email {email!r}.") from exc

        if user.is_active:
            raise CommandError(
                f"User {email!r} is already active — verification was "
                "already completed (or the user was created active)."
            )

        token = _signer.sign(str(user.pk))
        # Print only the token so test code can capture stdout cleanly.
        # `self.stdout.write` would add a trailing newline; that's fine,
        # callers should `.strip()`.
        self.stdout.write(token)
