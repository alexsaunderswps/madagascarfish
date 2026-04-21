from django.db import migrations


def renormalize(apps, schema_editor):
    from species.models import strip_svg_root_size_attrs

    Species = apps.get_model("species", "Species")
    Genus = apps.get_model("species", "Genus")

    for model in (Species, Genus):
        for row in model.objects.exclude(silhouette_svg="").only("id", "silhouette_svg"):
            cleaned = strip_svg_root_size_attrs(row.silhouette_svg)
            if cleaned != row.silhouette_svg:
                model.objects.filter(pk=row.pk).update(silhouette_svg=cleaned)


class Migration(migrations.Migration):
    dependencies = [("species", "0017_seed_sitemapasset_rows")]

    operations = [
        migrations.RunPython(renormalize, reverse_code=migrations.RunPython.noop),
    ]
