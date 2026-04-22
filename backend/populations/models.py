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


class CoordinatedProgram(models.Model):
    """Formal breeding / conservation program for a single species.

    Captures the "who runs this" layer above ExSituPopulation — AZA SSP,
    EAZA EEP, CARES listing, or an independent regional program. One row per
    species per program; a species can have multiple program rows if it's
    tracked under different frameworks simultaneously.
    """

    class ProgramType(models.TextChoices):
        SSP = "ssp", "AZA Species Survival Plan"
        EEP = "eep", "EAZA Ex-situ Programme"
        CARES = "cares", "CARES Priority Species"
        INDEPENDENT = "independent", "Independent coordinated program"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        PLANNING = "planning"
        ACTIVE = "active"
        PAUSED = "paused"
        DEPRECATED = "deprecated"

    species = models.ForeignKey(
        "species.Species",
        on_delete=models.CASCADE,
        related_name="coordinated_programs",
    )
    program_type = models.CharField(max_length=20, choices=ProgramType.choices)
    name = models.CharField(
        max_length=300,
        help_text=(
            "Human-readable program name, e.g. 'AZA SSP: Madagascar Rainbowfish'. "
            "Shown on the coordinator dashboard."
        ),
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNING)
    coordinating_institution = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coordinated_programs_led",
        help_text="Institution holding the studbook / coordination responsibility.",
    )
    studbook_keeper = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coordinated_programs_managed",
        help_text="The named studbook keeper, if one is assigned.",
    )
    enrolled_institutions = models.ManyToManyField(
        Institution,
        blank=True,
        related_name="coordinated_programs_enrolled",
        help_text="Institutions that have joined the program (not including the coordinator).",
    )
    target_population_size = models.IntegerField(
        null=True,
        blank=True,
        help_text="Optional demographic target per the program's plan.",
    )
    plan_summary = models.TextField(
        blank=True,
        help_text="Short human summary of the current plan. Full plan docs link out.",
    )
    plan_document_url = models.URLField(
        blank=True,
        help_text="External link to the authoritative plan (PDF, Confluence, etc.).",
    )
    start_date = models.DateField(null=True, blank=True)
    next_review_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "populations_coordinatedprogram"
        constraints = [
            models.UniqueConstraint(
                fields=["species", "program_type"],
                name="unique_species_programtype",
            ),
        ]
        ordering = ["species__scientific_name", "program_type"]

    def __str__(self) -> str:
        return f"{self.name} ({self.species})"


class Transfer(models.Model):
    """Movement of animals between institutions.

    Covers the full life-cycle: proposed → approved → in-transit → completed,
    or cancelled at any point. A coordinator browsing the dashboard can see
    what's planned, what's in motion, and what's stuck waiting for permits.
    """

    class Status(models.TextChoices):
        PROPOSED = "proposed"
        APPROVED = "approved"
        IN_TRANSIT = "in_transit", "In transit"
        COMPLETED = "completed"
        CANCELLED = "cancelled"

    species = models.ForeignKey(
        "species.Species",
        on_delete=models.PROTECT,
        related_name="transfers",
    )
    source_institution = models.ForeignKey(
        Institution,
        on_delete=models.PROTECT,
        related_name="transfers_out",
    )
    destination_institution = models.ForeignKey(
        Institution,
        on_delete=models.PROTECT,
        related_name="transfers_in",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROPOSED)
    proposed_date = models.DateField(
        help_text="Date the transfer was first proposed / logged.",
    )
    planned_date = models.DateField(null=True, blank=True)
    actual_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date the transfer actually completed. Required when status='completed'.",
    )
    count_male = models.IntegerField(null=True, blank=True)
    count_female = models.IntegerField(null=True, blank=True)
    count_unsexed = models.IntegerField(null=True, blank=True)
    cites_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text=(
            "CITES permit or equivalent reference number for threatened species. "
            "Blank for non-CITES-listed species."
        ),
    )
    coordinated_program = models.ForeignKey(
        CoordinatedProgram,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transfers",
        help_text="Optional: the program this transfer serves.",
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transfers_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "populations_transfer"
        ordering = ["-proposed_date"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(source_institution=models.F("destination_institution")),
                name="transfer_source_destination_distinct",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.species}: {self.source_institution} → {self.destination_institution} "
            f"({self.get_status_display()})"
        )


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
