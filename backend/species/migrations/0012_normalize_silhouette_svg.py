from django.db import migrations


def normalize_existing(apps, schema_editor):
    from species.models import strip_svg_root_size_attrs

    Species = apps.get_model("species", "Species")
    for sp in Species.objects.exclude(silhouette_svg="").only("id", "silhouette_svg"):
        cleaned = strip_svg_root_size_attrs(sp.silhouette_svg)
        if cleaned != sp.silhouette_svg:
            Species.objects.filter(pk=sp.pk).update(silhouette_svg=cleaned)


class Migration(migrations.Migration):
    dependencies = [("species", "0011_species_silhouette_svg")]

    operations = [
        migrations.RunPython(normalize_existing, reverse_code=migrations.RunPython.noop),
    ]
