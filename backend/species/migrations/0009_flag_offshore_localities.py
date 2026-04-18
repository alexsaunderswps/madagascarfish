"""Flag existing locality records east of Madagascar's coast for review.

Any SpeciesLocality with longitude > 50.6°E is in the open Indian Ocean.
These are almost certainly transcription errors in the source citation (wrong
hemisphere for a coastal site, digit-swap in a GBIF record, etc.). We keep
the rows — they may be resolvable — but hide them from the public map via
`needs_review=True` until a human verifies the coordinates.

See docs/planning/business-analysis/map-ux-decisions-2026-04-18.md §6.
"""

from django.db import migrations

OFFSHORE_LNG_THRESHOLD = 50.6


def flag_offshore(apps, schema_editor):
    SpeciesLocality = apps.get_model("species", "SpeciesLocality")
    for loc in SpeciesLocality.objects.all():
        if loc.location is None:
            continue
        if loc.location.x > OFFSHORE_LNG_THRESHOLD and not loc.needs_review:
            loc.needs_review = True
            loc.review_notes = (
                f"Auto-flagged on migration 0009: longitude {loc.location.x:.3f}°E "
                f"is east of Madagascar's coast (threshold "
                f"{OFFSHORE_LNG_THRESHOLD}°E). Source: {loc.source_citation}. "
                f"Verify coordinates before surfacing publicly."
            )
            loc.save(update_fields=["needs_review", "review_notes"])


def unflag(apps, schema_editor):
    # Reverse: clear only the auto-flagged notes we wrote, to avoid clobbering
    # human-authored review notes on the same rows.
    SpeciesLocality = apps.get_model("species", "SpeciesLocality")
    SpeciesLocality.objects.filter(
        review_notes__startswith="Auto-flagged on migration 0009"
    ).update(needs_review=False, review_notes="")


class Migration(migrations.Migration):

    dependencies = [
        ("species", "0008_specieslocality_needs_review"),
    ]

    operations = [
        migrations.RunPython(flag_offshore, reverse_code=unflag),
    ]
