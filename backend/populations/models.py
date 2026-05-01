from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


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
    contact_email = models.EmailField(blank=True, help_text=_("Visible at Tier 3+ only"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "populations_institution"
        ordering = ["name"]

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
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    last_edited_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text=(
            "Set by the institution-scoped edit path only "
            "(populations.views.ExSituPopulationViewSet.perform_update). "
            "NULL means the row has never been edited via the API write surface."
        ),
    )
    last_edited_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    last_edited_by_institution = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        db_table = "populations_exsitupopulation"
        ordering = ["species__scientific_name", "institution__name"]
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
        SSP = "ssp", "AZA Species Survival Plan (SSP)"
        EEP = "eep", "EAZA Ex-situ Programme (EEP)"
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
        help_text=_("Institution holding the studbook / coordination responsibility."),
    )
    studbook_keeper = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coordinated_programs_managed",
        help_text=_("The named studbook keeper, if one is assigned."),
    )
    enrolled_institutions = models.ManyToManyField(
        Institution,
        blank=True,
        related_name="coordinated_programs_enrolled",
        help_text=_("Institutions that have joined the program (not including the coordinator)."),
    )
    target_population_size = models.IntegerField(
        null=True,
        blank=True,
        help_text=_("Optional demographic target per the program's plan."),
    )
    plan_summary = models.TextField(
        blank=True,
        help_text=_("Short human summary of the current plan. Full plan docs link out."),
    )
    plan_document_url = models.URLField(
        blank=True,
        help_text=_("External link to the authoritative plan (PDF, Confluence, etc.)."),
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
        help_text=_("Date the transfer was first proposed / logged."),
    )
    planned_date = models.DateField(null=True, blank=True)
    actual_date = models.DateField(
        null=True,
        blank=True,
        help_text=_("Date the transfer actually completed. Required when status='completed'."),
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
        help_text=_("Optional: the program this transfer serves."),
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


class BreedingRecommendation(models.Model):
    """A formal coordinator recommendation for a species / population.

    Shaped against EAZA Population Management Manual §3.14 (Annual breeding
    and transfer recommendations) and AZA SSP Handbook Chapter 4 (Breeding
    and Transfer Plans). Three primary recommendation categories map to
    EAZA's breed / non-breed / transfer cut — with a catch-all 'other' for
    anything that doesn't fit cleanly.

    This is the coordinator's to-do list: what should happen with which
    population, with what priority, by when. Surfaces on the coordinator
    dashboard as an open-recommendations panel.
    """

    class RecommendationType(models.TextChoices):
        BREED = "breed"
        NON_BREED = "non_breed", "Non-breed (hold)"
        TRANSFER = "transfer"
        OTHER = "other"

    class Priority(models.TextChoices):
        CRITICAL = "critical"
        HIGH = "high"
        MEDIUM = "medium"
        LOW = "low"

    class Status(models.TextChoices):
        OPEN = "open"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed"
        SUPERSEDED = "superseded"
        CANCELLED = "cancelled"

    species = models.ForeignKey(
        "species.Species",
        on_delete=models.PROTECT,
        related_name="breeding_recommendations",
    )
    coordinated_program = models.ForeignKey(
        "populations.CoordinatedProgram",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="breeding_recommendations",
        help_text=_("The program this recommendation was issued under, if any."),
    )
    recommendation_type = models.CharField(max_length=20, choices=RecommendationType.choices)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    source_population = models.ForeignKey(
        ExSituPopulation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="breeding_recommendations_source",
        help_text=(
            "The specific population this recommendation concerns, when applicable. "
            "Null for species-wide recommendations."
        ),
    )
    target_institution = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="breeding_recommendations_target",
        help_text=(
            "The institution the recommendation is directed to — e.g. 'breed at "
            "Bristol', 'transfer to Cologne'. Null for coordinator-wide calls."
        ),
    )
    rationale = models.TextField(
        blank=True,
        help_text=(
            "Why this recommendation. Copy from the SSP / EEP plan, planning "
            "meeting minutes, or coordinator's own reasoning."
        ),
    )
    issued_date = models.DateField(
        help_text=_("When the recommendation was issued. Required."),
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        help_text=_("Target date for action, if the plan specifies one."),
    )
    outcome_notes = models.TextField(
        blank=True,
        help_text=_("Free text — what happened. Filled in at resolution."),
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="breeding_recommendations_issued",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="breeding_recommendations_resolved",
    )
    resolved_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "populations_breedingrecommendation"
        ordering = ["-issued_date", "-priority"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["species", "status"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.get_recommendation_type_display()} — "
            f"{self.species} ({self.get_status_display()})"
        )


class BreedingEvent(models.Model):
    """Time-series reproductive / demographic events per population.

    Covers the studbook-style event log: spawning, hatching, mortality,
    acquisition, disposition. Count deltas are signed — a mortality of
    three males becomes ``count_delta_male = -3``. Applied as-is to
    ``ExSituPopulation`` counts by an operator, not auto-recomputed here;
    this table is the ledger, not the running total.

    Field shape aligns with ZIMS studbook event types and the SPARKS-era
    data-entry guidelines. Extends naturally if new event categories are
    needed later (add to the enum).
    """

    class EventType(models.TextChoices):
        SPAWNING = "spawning"
        HATCHING = "hatching"
        MORTALITY = "mortality"
        ACQUISITION = "acquisition"
        DISPOSITION = "disposition"
        OTHER = "other"

    population = models.ForeignKey(
        ExSituPopulation,
        on_delete=models.CASCADE,
        related_name="breeding_events",
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    event_date = models.DateField()
    count_delta_male = models.IntegerField(
        null=True,
        blank=True,
        help_text=_("Signed change in male count. Negative = loss."),
    )
    count_delta_female = models.IntegerField(null=True, blank=True)
    count_delta_unsexed = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="breeding_events_reported",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "populations_breedingevent"
        ordering = ["-event_date", "-created_at"]
        indexes = [
            models.Index(fields=["population", "-event_date"]),
            models.Index(fields=["event_type", "-event_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_event_type_display()} — {self.population} ({self.event_date})"
