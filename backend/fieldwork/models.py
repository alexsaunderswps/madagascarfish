from django.db import models


class FieldProgram(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active"
        COMPLETED = "completed"
        PLANNED = "planned"

    name = models.CharField(max_length=300)
    description = models.TextField()
    lead_institution = models.ForeignKey(
        "populations.Institution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_programs",
    )
    region = models.CharField(max_length=200, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    focal_species = models.ManyToManyField(
        "species.Species", blank=True, related_name="field_programs"
    )
    partner_institutions = models.ManyToManyField(
        "populations.Institution", blank=True, related_name="partner_programs"
    )
    funding_sources = models.TextField(blank=True)
    website = models.URLField(blank=True)

    class Meta:
        db_table = "fieldwork_fieldprogram"

    def __str__(self) -> str:
        return self.name
