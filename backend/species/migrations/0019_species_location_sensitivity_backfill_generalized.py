from django.contrib.gis.geos import Point
from django.db import migrations, models

BACKFILL_CHUNK_SIZE = 500


def backfill_generalized_locations(apps, schema_editor):
    """Precompute location_generalized for every existing SpeciesLocality.

    The public map serializer now decides generalized-vs-exact at request
    time based on tier + effective sensitivity. For that decision to be
    safe, every record needs a stored 0.1° point — not just the ones that
    were previously flagged is_sensitive=True.

    Uses Python round() to match SpeciesLocality.save(). (ST_SnapToGrid
    would floor to grid origin, producing different values than save()
    computes for new rows — we'd end up with old and new records rounded
    by different rules.) bulk_update keeps the DB round-trips to
    n/BACKFILL_CHUNK_SIZE instead of n.
    """
    SpeciesLocality = apps.get_model("species", "SpeciesLocality")
    qs = (
        SpeciesLocality.objects.filter(
            location_generalized__isnull=True,
            location__isnull=False,
        )
        .only("id", "location")
        .iterator(chunk_size=BACKFILL_CHUNK_SIZE)
    )
    batch: list = []
    for row in qs:
        row.location_generalized = Point(
            round(row.location.x, 1),
            round(row.location.y, 1),
            srid=4326,
        )
        batch.append(row)
        if len(batch) >= BACKFILL_CHUNK_SIZE:
            SpeciesLocality.objects.bulk_update(batch, ["location_generalized"])
            batch.clear()
    if batch:
        SpeciesLocality.objects.bulk_update(batch, ["location_generalized"])


def reverse_backfill(apps, schema_editor):
    """Clearing generalized points on rollback would be a privacy regression
    (it risks serving exact coords for sensitive species). No-op instead."""
    return


class Migration(migrations.Migration):
    dependencies = [("species", "0018_resynthesize_svg_viewboxes")]

    operations = [
        migrations.AddField(
            model_name="species",
            name="location_sensitivity",
            field=models.CharField(
                choices=[
                    ("auto", "Auto (IUCN-derived)"),
                    ("override_sensitive", "Override — always sensitive"),
                ],
                default="auto",
                help_text=(
                    "Controls whether locality coordinates for this species "
                    "are generalized on the public map. <b>Auto</b> defers "
                    "to IUCN status — CR, EN, and VU are generalized; "
                    "everything else is served exact. "
                    "<b>Override — always sensitive</b> forces "
                    "generalization regardless of status, for cases where "
                    "local experts want stricter protection than IUCN "
                    "implies (e.g. a newly-discovered refugium of a species "
                    "still listed Least Concern). Tier 3+ coordinators see "
                    "exact coordinates in both cases."
                ),
                max_length=30,
            ),
        ),
        migrations.RunPython(
            backfill_generalized_locations,
            reverse_code=reverse_backfill,
        ),
    ]
