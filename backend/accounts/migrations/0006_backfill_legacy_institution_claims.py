"""Backfill synthetic APPROVED claims for legacy users with institution set.

Per Gate 13 architecture §11.1, users that already have `User.institution`
set (typical of dev fixtures and staging seed data) get a synthetic
`PendingInstitutionClaim(status=APPROVED)` row so the `/me/`
`institution_membership` resolver doesn't hit the "user has institution
but no claim row" edge case described in architecture §6.2.

Production has no real users yet (per `auth-c-d.md` §10), so this is
mostly belt-and-suspenders. Idempotent: skips users that already have
any claim on the same institution.
"""

from django.db import migrations


def backfill_claims(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    PendingInstitutionClaim = apps.get_model("accounts", "PendingInstitutionClaim")
    qs = User.objects.filter(institution__isnull=False).only("id", "institution_id", "date_joined")
    for user in qs.iterator():
        if PendingInstitutionClaim.objects.filter(
            user_id=user.id, institution_id=user.institution_id
        ).exists():
            continue
        PendingInstitutionClaim.objects.create(
            user_id=user.id,
            institution_id=user.institution_id,
            status="approved",
            requested_at=user.date_joined,
            reviewed_at=user.date_joined,
            reviewed_by=None,
            requester_note="",
            review_notes="Synthetic claim backfilled by Gate 13 migration.",
        )


def reverse_backfill(apps, schema_editor):
    PendingInstitutionClaim = apps.get_model("accounts", "PendingInstitutionClaim")
    PendingInstitutionClaim.objects.filter(
        review_notes="Synthetic claim backfilled by Gate 13 migration."
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_pendinginstitutionclaim"),
    ]

    operations = [
        migrations.RunPython(backfill_claims, reverse_backfill),
    ]
