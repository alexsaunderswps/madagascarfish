"""Husbandry & Breeding Guidance models.

Gate 08 — see docs/planning/specs/gate-08-husbandry-backend.md.

`SpeciesHusbandry` is one-to-one with `species.Species` and holds all
hobbyist-facing husbandry fields. Difficulty is surfaced as seven factor
columns (no aggregate label). Sources are a child table — at least one
is required to publish.

Taxonomy, IUCN status, CARES status, SHOAL priority — NOT denormalized here.
Read through `self.species` at serialization time. This mirrors the
`ConservationAssessment` pattern: husbandry is adjunct content, not a
canonical taxonomic surface.
"""

from __future__ import annotations

from datetime import date, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

# Review becomes "stale" / "overdue" after this many days. 24 months ≈ 730 days
# (we use 730 rather than dateutil relativedelta to keep the boundary
# deterministic for tests — on-day and off-by-one matter per the spec).
REVIEW_STALE_AFTER_DAYS = 730


class SpeciesHusbandry(models.Model):
    class WaterFlow(models.TextChoices):
        STILL = "still", "Still"
        GENTLE = "gentle", "Gentle"
        MODERATE = "moderate", "Moderate"
        STRONG = "strong", "Strong"

    class SpawningMode(models.TextChoices):
        SUBSTRATE_SPAWNER = "substrate_spawner", "Substrate spawner"
        MOUTHBROODER = "mouthbrooder", "Mouthbrooder"
        ANNUAL_KILLI = "annual_killi", "Annual killifish"
        BUBBLE_NEST = "bubble_nest", "Bubble nest"
        LIVEBEARER = "livebearer", "Livebearer"
        OTHER = "other", "Other"

    species = models.OneToOneField(
        "species.Species",
        on_delete=models.CASCADE,
        related_name="husbandry",
    )

    published = models.BooleanField(
        default=False,
        help_text="Gates public API + frontend teaser. Draft records are invisible to the public.",
    )

    # --- Water parameters ---
    water_temp_c_min = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    water_temp_c_max = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    water_ph_min = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    water_ph_max = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    water_hardness_dgh_min = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    water_hardness_dgh_max = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    water_hardness_dkh_min = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    water_hardness_dkh_max = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    water_flow = models.CharField(max_length=20, choices=WaterFlow.choices, blank=True)
    water_notes = models.TextField(blank=True)

    # --- Tank / system ---
    tank_min_volume_liters = models.PositiveIntegerField(null=True, blank=True)
    tank_min_footprint_cm = models.CharField(max_length=50, blank=True)
    tank_aquascape = models.TextField(blank=True)
    tank_substrate = models.TextField(blank=True)
    tank_cover = models.TextField(blank=True)
    tank_notes = models.TextField(blank=True)

    # --- Diet ---
    diet_accepted_foods = models.JSONField(default=list, blank=True)
    diet_live_food_required = models.BooleanField(default=False)
    diet_feeding_frequency = models.CharField(max_length=100, blank=True)
    diet_notes = models.TextField(blank=True)

    # --- Behavior & social structure ---
    behavior_temperament = models.CharField(max_length=200, blank=True)
    behavior_recommended_sex_ratio = models.CharField(max_length=100, blank=True)
    behavior_schooling = models.CharField(max_length=200, blank=True)
    behavior_community_compatibility = models.CharField(max_length=300, blank=True)
    behavior_notes = models.TextField(blank=True)

    # --- Breeding ---
    breeding_spawning_mode = models.CharField(
        max_length=30, choices=SpawningMode.choices, blank=True
    )
    breeding_triggers = models.TextField(blank=True)
    breeding_egg_count_typical = models.CharField(max_length=100, blank=True)
    breeding_fry_care = models.TextField(blank=True)
    breeding_survival_bottlenecks = models.TextField(blank=True)
    breeding_notes = models.TextField(blank=True)

    # --- Difficulty factors (NO aggregate `difficulty` column — locked Q2) ---
    difficulty_adult_size = models.CharField(max_length=200, blank=True)
    difficulty_space_demand = models.CharField(max_length=200, blank=True)
    difficulty_temperament_challenge = models.CharField(max_length=300, blank=True)
    difficulty_water_parameter_demand = models.CharField(max_length=300, blank=True)
    difficulty_dietary_specialization = models.CharField(max_length=300, blank=True)
    difficulty_breeding_complexity = models.CharField(max_length=300, blank=True)
    difficulty_other = models.CharField(max_length=300, blank=True)

    # --- Sourcing ---
    sourcing_cares_registered_breeders = models.BooleanField(default=False)
    sourcing_notes = models.TextField(blank=True)

    # --- Narrative (plain text — no Markdown dependency, per locked decision) ---
    narrative = models.TextField(blank=True)

    # --- Governance ---
    contributors = models.TextField(
        blank=True,
        help_text="Free text at MVP. Structured contributor records are post-MVP (BA §5).",
    )
    last_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_husbandry",
        help_text="Required when published=True.",
    )
    last_reviewed_at = models.DateField(
        null=True, blank=True, help_text="Required when published=True."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "husbandry_specieshusbandry"
        ordering = ("species__scientific_name",)
        verbose_name = "Species husbandry record"
        verbose_name_plural = "Species husbandry records"

    def __str__(self) -> str:
        return f"Husbandry: {self.species.scientific_name}"

    # ---- Governance helpers ----

    @property
    def review_is_stale(self) -> bool:
        """True when last_reviewed_at is older than REVIEW_STALE_AFTER_DAYS.

        Boundary per spec AC-08.7: reviews strictly OLDER than 24 months are
        stale; a review exactly 24 months (730 days) ago is not yet stale.
        """
        if not self.last_reviewed_at:
            # A published record without a reviewed_at is a validation bug — but
            # be defensive: treat as stale so stakeholders notice.
            return True
        return (date.today() - self.last_reviewed_at) > timedelta(days=REVIEW_STALE_AFTER_DAYS)

    def clean(self) -> None:
        """Model-level validation.

        Source-count check happens in `ModelAdmin.save_related` because inlines
        aren't visible here. We still validate reviewer fields here so invalid
        states raised through code paths other than admin (shell, management
        commands, tests) surface the same error.
        """
        super().clean()
        if self.published:
            errors: dict[str, str] = {}
            if self.last_reviewed_by_id is None:
                errors["last_reviewed_by"] = "A reviewer is required to publish a husbandry record."
            if self.last_reviewed_at is None:
                errors["last_reviewed_at"] = (
                    "A review date is required to publish a husbandry record."
                )
            if errors:
                raise ValidationError(errors)


class HusbandrySource(models.Model):
    """Citation attached to a `SpeciesHusbandry` record.

    BA §5 requires at least one source to publish. The source-count check
    lives in `SpeciesHusbandryAdmin.save_related` (inlines aren't available
    at model `clean` time).
    """

    husbandry = models.ForeignKey(
        SpeciesHusbandry,
        on_delete=models.CASCADE,
        related_name="sources",
    )
    label = models.CharField(max_length=500)
    url = models.URLField(blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "husbandry_husbandrysource"
        ordering = ("order", "id")

    def __str__(self) -> str:
        return self.label[:80]
