"""Data migration — populate Genus rows from distinct Species.genus strings
and fill Species.genus_fk. Asserts one-to-one genus→family integrity, i.e.
that no two species sharing a genus string disagree on family. If that
assertion fails the migration aborts; operators must reconcile the data
before reapplying.
"""

from __future__ import annotations

from collections import defaultdict

from django.db import migrations


def populate_genera(apps, schema_editor):
    Species = apps.get_model("species", "Species")
    Genus = apps.get_model("species", "Genus")

    # Collect {genus_name: {families}} so we can detect conflicts in one pass.
    families_by_genus: dict[str, set[str]] = defaultdict(set)
    for sp in Species.objects.all().only("genus", "family"):
        if sp.genus:
            families_by_genus[sp.genus].add(sp.family or "")

    conflicts = {g: fams for g, fams in families_by_genus.items() if len(fams) > 1}
    if conflicts:
        details = "; ".join(
            f"{g}: {sorted(fams)}" for g, fams in sorted(conflicts.items())
        )
        raise RuntimeError(
            "Genus→family integrity violated: one genus string maps to "
            f"multiple families. Reconcile before migrating. Conflicts: {details}"
        )

    # Create Genus rows and build a name→id map in one pass.
    genus_id_by_name: dict[str, int] = {}
    for name, fams in families_by_genus.items():
        family = next(iter(fams))
        obj, _ = Genus.objects.get_or_create(
            name=name, defaults={"family": family}
        )
        # Backfill family if somehow a prior run left it blank.
        if not obj.family and family:
            obj.family = family
            obj.save(update_fields=["family"])
        genus_id_by_name[name] = obj.pk

    # Fill Species.genus_fk in bulk via per-genus updates (fewer queries than
    # one-per-species and avoids pulling the full Species queryset into Python).
    for name, genus_id in genus_id_by_name.items():
        Species.objects.filter(genus=name, genus_fk__isnull=True).update(
            genus_fk_id=genus_id
        )


def unpopulate_genera(apps, schema_editor):
    Species = apps.get_model("species", "Species")
    Genus = apps.get_model("species", "Genus")
    Species.objects.update(genus_fk=None)
    Genus.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("species", "0013_add_genus_model_nullable_fk"),
    ]

    operations = [
        migrations.RunPython(populate_genera, unpopulate_genera),
    ]
