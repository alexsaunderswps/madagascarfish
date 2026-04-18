"""Add needs_review + review_notes to SpeciesLocality.

Quarantine flag that hides a record from the public map without deleting it.
See docs/planning/business-analysis/map-ux-decisions-2026-04-18.md §6.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("species", "0007_dismiss_safety_fixes"),
    ]

    operations = [
        migrations.AddField(
            model_name="specieslocality",
            name="needs_review",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="specieslocality",
            name="review_notes",
            field=models.TextField(
                blank=True,
                help_text=(
                    "Why this record is flagged (e.g. 'coordinates place point in open "
                    "ocean; source GBIF record pending re-verification'). Shown only in admin."
                ),
            ),
        ),
    ]
