import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("species", "0006_conservationstatusconflict"),
    ]

    operations = [
        migrations.AlterField(
            model_name="conservationstatusconflict",
            name="iucn_assessment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="iucn_conflicts",
                to="species.conservationassessment",
            ),
        ),
        migrations.RemoveIndex(
            model_name="conservationstatusconflict",
            name="species_con_status_f675d8_idx",
        ),
        migrations.AddIndex(
            model_name="conservationstatusconflict",
            index=models.Index(
                fields=["status", "detected_at"], name="species_con_status_detect_idx"
            ),
        ),
    ]
