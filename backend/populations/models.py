from __future__ import annotations

from django.conf import settings
from django.db import models


class ExSituPopulationQuerySet(models.QuerySet["ExSituPopulation"]):
    def for_tier(self, tier: int) -> ExSituPopulationQuerySet:
        """Tier 3+ sees all records; below Tier 3 sees nothing."""
        if tier >= 3:
            return self.all()
        return self.none()


class Institution(models.Model):
    class InstitutionType(models.TextChoices):
        ZOO = "zoo"
        AQUARIUM = "aquarium"
        RESEARCH_ORG = "research_org"
        HOBBYIST_PROGRAM = "hobbyist_program", "Hobbyist program (CARES, Citizen Conservation)"
        HOBBYIST_KEEPER = "hobbyist_keeper", "Hobbyist keeper (individual)"
        NGO = "ngo"
        GOVERNMENT = "government"

    name = models.CharField(max_length=300)
    institution_type = models.CharField(max_length=30, choices=InstitutionType.choices)
    country = models.CharField(max_length=100)
    city = models.CharField(max_length=100, blank=True)
    zims_member = models.BooleanField(default=False)
    species360_id = models.CharField(max_length=50, blank=True)
    eaza_member = models.BooleanField(default=False)
    aza_member = models.BooleanField(default=False)
    website = models.URLField(blank=True)
    contact_email = models.EmailField(blank=True, help_text="Visible at Tier 3+ only")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "populations_institution"

    def __str__(self) -> str:
        return self.name


class ExSituPopulation(models.Model):
    class BreedingStatus(models.TextChoices):
        BREEDING = "breeding"
        NON_BREEDING = "non-breeding"
        UNKNOWN = "unknown"

    objects = ExSituPopulationQuerySet.as_manager()

    species = models.ForeignKey(
        "species.Species", on_delete=models.CASCADE, related_name="ex_situ_populations"
    )
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="ex_situ_populations"
    )
    count_total = models.IntegerField(null=True, blank=True)
    count_male = models.IntegerField(null=True, blank=True)
    count_female = models.IntegerField(null=True, blank=True)
    count_unsexed = models.IntegerField(null=True, blank=True)
    date_established = models.DateField(null=True, blank=True)
    founding_source = models.CharField(max_length=300, blank=True)
    breeding_status = models.CharField(
        max_length=20, choices=BreedingStatus.choices, default=BreedingStatus.UNKNOWN
    )
    studbook_managed = models.BooleanField(default=False)
    last_census_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "populations_exsitupopulation"
        constraints = [
            models.UniqueConstraint(
                fields=["species", "institution"],
                name="unique_species_institution",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.species} at {self.institution}"


class HoldingRecord(models.Model):
    population = models.ForeignKey(
        ExSituPopulation, on_delete=models.CASCADE, related_name="holding_records"
    )
    date = models.DateField()
    count_total = models.IntegerField()
    count_male = models.IntegerField(null=True, blank=True)
    count_female = models.IntegerField(null=True, blank=True)
    count_unsexed = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="holding_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "populations_holdingrecord"
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"{self.population} — {self.date}"
