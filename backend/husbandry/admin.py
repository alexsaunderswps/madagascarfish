"""Admin UX for authoring husbandry records.

Fieldsets mirror the authoring template groups (Water / Tank / Diet /
Behavior / Breeding / Difficulty Factors / Sourcing / Narrative /
Governance) so Aleksei can work down the page without hunting for fields.

Publish validation (≥1 source, reviewer + review date populated) fires
in `save_related` because inlines aren't available at model `clean` time.
A stale-review warning banner renders on the change form when
`last_reviewed_at` is older than 24 months.
"""

from __future__ import annotations

from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.http import HttpRequest

from husbandry.models import HusbandrySource, SpeciesHusbandry


class HusbandrySourceInline(admin.TabularInline):
    model = HusbandrySource
    extra = 1
    fields = ["order", "label", "url"]


@admin.register(SpeciesHusbandry)
class SpeciesHusbandryAdmin(admin.ModelAdmin):
    list_display = [
        "species",
        "published",
        "last_reviewed_at",
        "review_is_stale_display",
        "source_count",
    ]
    list_filter = [
        "published",
        "sourcing_cares_registered_breeders",
        "breeding_spawning_mode",
    ]
    search_fields = [
        "species__scientific_name",
        "species__common_names__name",
        "contributors",
    ]
    autocomplete_fields = ["species", "last_reviewed_by"]
    inlines = [HusbandrySourceInline]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        (None, {"fields": ("species", "published")}),
        (
            "Water parameters",
            {
                "fields": (
                    ("water_temp_c_min", "water_temp_c_max"),
                    ("water_ph_min", "water_ph_max"),
                    ("water_hardness_dgh_min", "water_hardness_dgh_max"),
                    ("water_hardness_dkh_min", "water_hardness_dkh_max"),
                    "water_flow",
                    "water_notes",
                )
            },
        ),
        (
            "Tank / system",
            {
                "fields": (
                    "tank_min_volume_liters",
                    "tank_min_footprint_cm",
                    "tank_aquascape",
                    "tank_substrate",
                    "tank_cover",
                    "tank_notes",
                )
            },
        ),
        (
            "Diet",
            {
                "fields": (
                    "diet_accepted_foods",
                    "diet_live_food_required",
                    "diet_feeding_frequency",
                    "diet_notes",
                )
            },
        ),
        (
            "Behavior & social structure",
            {
                "fields": (
                    "behavior_temperament",
                    "behavior_recommended_sex_ratio",
                    "behavior_schooling",
                    "behavior_community_compatibility",
                    "behavior_notes",
                )
            },
        ),
        (
            "Breeding",
            {
                "fields": (
                    "breeding_spawning_mode",
                    "breeding_triggers",
                    "breeding_egg_count_typical",
                    "breeding_fry_care",
                    "breeding_survival_bottlenecks",
                    "breeding_notes",
                )
            },
        ),
        (
            "Difficulty factors",
            {
                "description": (
                    "Describe factors honestly. Do not attempt an overall "
                    "difficulty label — the page deliberately surfaces factors, "
                    "not a verdict."
                ),
                "fields": (
                    "difficulty_adult_size",
                    "difficulty_space_demand",
                    "difficulty_temperament_challenge",
                    "difficulty_water_parameter_demand",
                    "difficulty_dietary_specialization",
                    "difficulty_breeding_complexity",
                    "difficulty_other",
                ),
            },
        ),
        (
            "Sourcing",
            {
                "fields": (
                    "sourcing_cares_registered_breeders",
                    "sourcing_notes",
                )
            },
        ),
        ("Narrative", {"fields": ("narrative",)}),
        (
            "Governance",
            {
                "fields": (
                    "contributors",
                    "last_reviewed_by",
                    "last_reviewed_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(description="Stale?", boolean=True)
    def review_is_stale_display(self, obj: SpeciesHusbandry) -> bool:
        return obj.review_is_stale

    @admin.display(description="Sources")
    def source_count(self, obj: SpeciesHusbandry) -> int:
        return obj.sources.count()

    # ---- Change-form stale banner (Story 08.7) ----

    def change_view(
        self,
        request: HttpRequest,
        object_id: str,
        form_url: str = "",
        extra_context: dict | None = None,
    ):
        extra_context = extra_context or {}
        if object_id:
            obj = self.get_object(request, object_id)
            if obj and obj.last_reviewed_at and obj.review_is_stale:
                messages.warning(
                    request,
                    "Review is overdue; public page will show a 'review pending' note.",
                )
        return super().change_view(request, object_id, form_url, extra_context=extra_context)

    # ---- Publish-time validation (Stories 08.3, 08.4) ----

    def save_related(self, request: HttpRequest, form, formsets, change: bool) -> None:
        """Enforce publish preconditions after inlines are saved.

        - AC-08.3: ≥1 `HusbandrySource` must exist when `published=True`.
        - AC-08.4: `last_reviewed_by` and `last_reviewed_at` must be non-null
          when `published=True`. (Also enforced at the model level but
          restated here so admin produces a form-level error, not a 500.)
        """
        super().save_related(request, form, formsets, change)
        obj: SpeciesHusbandry = form.instance
        if not obj.published:
            return

        errors: list[str] = []
        if obj.last_reviewed_by_id is None:
            errors.append("last_reviewed_by is required to publish.")
        if obj.last_reviewed_at is None:
            errors.append("last_reviewed_at is required to publish.")
        if not obj.sources.exists():
            errors.append("At least one source citation is required to publish.")

        if errors:
            # Revert the publish flag so the record stays draft until fixed.
            SpeciesHusbandry.objects.filter(pk=obj.pk).update(published=False)
            obj.published = False
            for err in errors:
                messages.error(request, err)
            # Raising ValidationError here rolls back the admin response into
            # the change form with the error messages preserved.
            raise ValidationError(errors)
