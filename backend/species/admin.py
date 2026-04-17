from django import forms
from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from django.core.exceptions import PermissionDenied
from django.http import HttpRequest

from species.models import (
    CommonName,
    ConservationAssessment,
    ProtectedArea,
    Species,
    SpeciesLocality,
    Taxon,
    Watershed,
)


class ConservationAssessmentAdminForm(forms.ModelForm):
    # Free-text reason captured on the admin form (not a model field). Required only
    # for manual_expert creates. Surfaces in the audit log via the save_model hook
    # once the audit-actor context is wired (commits 4–5).
    reason = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 2}),
        required=False,
        help_text=(
            "Required when source is 'manual_expert'. Recorded in the audit log "
            "as the justification for the override."
        ),
    )

    class Meta:
        model = ConservationAssessment
        fields = "__all__"

    def clean(self) -> dict[str, object]:
        cleaned = super().clean() or {}
        if cleaned.get("source") == ConservationAssessment.Source.MANUAL_EXPERT:
            missing = [
                field
                for field in ("category", "assessor", "assessment_date", "notes")
                if not cleaned.get(field)
            ]
            for field in missing:
                self.add_error(field, f"`{field}` is required when source is `manual_expert`.")
            if not cleaned.get("reason"):
                self.add_error(
                    "reason",
                    "`reason` is required when creating a manual_expert assessment.",
                )
        return cleaned


class ConservationAssessmentInline(admin.TabularInline):
    model = ConservationAssessment
    extra = 1
    fields = [
        "category",
        "source",
        "review_status",
        "criteria",
        "assessor",
        "assessment_date",
        "review_notes",
        "flagged_by",
        "flagged_date",
        "notes",
    ]
    readonly_fields = ["flagged_by", "flagged_date"]


class CommonNameInline(admin.TabularInline):
    model = CommonName
    extra = 1
    fields = ["name", "language", "is_preferred"]


class SpeciesLocalityInline(admin.TabularInline):
    model = SpeciesLocality
    extra = 0
    fields = [
        "locality_name",
        "locality_type",
        "presence_status",
        "water_body",
        "drainage_basin",
        "year_collected",
        "source_citation",
        "coordinate_precision",
        "is_sensitive",
    ]
    readonly_fields = ["drainage_basin", "is_sensitive"]
    show_change_link = True


@admin.register(Species)
class SpeciesAdmin(admin.ModelAdmin):
    list_display = [
        "scientific_name",
        "taxonomic_status",
        "family",
        "genus",
        "endemic_status",
        "iucn_status",
        "cares_status",
        "shoal_priority",
    ]
    list_filter = [
        "taxonomic_status",
        "iucn_status",
        "cares_status",
        "endemic_status",
        "family",
        "shoal_priority",
    ]
    search_fields = [
        "scientific_name",
        "provisional_name",
        "common_names__name",
    ]
    list_select_related = ["taxon"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [ConservationAssessmentInline, CommonNameInline, SpeciesLocalityInline]


@admin.register(ConservationAssessment)
class ConservationAssessmentAdmin(admin.ModelAdmin):
    form = ConservationAssessmentAdminForm
    list_display = [
        "species",
        "category",
        "source",
        "review_status",
        "assessment_date",
        "assessor",
        "created_by",
        "flagged_by",
        "flagged_date",
    ]
    list_filter = ["source", "review_status", "category"]
    search_fields = ["species__scientific_name", "notes", "criteria"]
    list_select_related = ["species", "flagged_by", "created_by"]
    readonly_fields = [
        "flagged_by",
        "flagged_date",
        "created_at",
        "conflict_acknowledged_assessment_ids",
    ]

    def _user_tier(self, request: HttpRequest) -> int:
        user = request.user
        if user.is_authenticated and hasattr(user, "access_tier"):
            return int(user.access_tier)  # type: ignore[union-attr]
        return 0

    def has_add_permission(self, request: HttpRequest) -> bool:
        if not super().has_add_permission(request):
            return False
        # Manual_expert authorship requires Tier 3+. Other sources are admin-only
        # in practice (created by iucn_sync); we allow Tier 3+ to add any source
        # and rely on the source dropdown + form validation for governance.
        return self._user_tier(request) >= 3

    def save_model(
        self,
        request: HttpRequest,
        obj: ConservationAssessment,
        form: forms.ModelForm,
        change: bool,
    ) -> None:
        if obj.source == ConservationAssessment.Source.MANUAL_EXPERT:
            if self._user_tier(request) < 3:
                raise PermissionDenied(
                    "Tier 3 (Conservation Coordinator) or higher is required to "
                    "author a manual_expert assessment."
                )
            if obj.created_by_id is None:
                obj.created_by = request.user  # type: ignore[assignment]
        super().save_model(request, obj, form, change)


@admin.register(Taxon)
class TaxonAdmin(admin.ModelAdmin):
    list_display = ["name", "rank", "parent"]
    list_filter = ["rank"]
    search_fields = ["name"]
    list_select_related = ["parent"]


@admin.register(SpeciesLocality)
class SpeciesLocalityAdmin(GISModelAdmin):
    list_display = [
        "species",
        "locality_name",
        "locality_type",
        "presence_status",
        "water_body",
        "drainage_basin",
        "year_collected",
        "coordinate_precision",
    ]
    list_filter = [
        "locality_type",
        "presence_status",
        "water_body_type",
        "coordinate_precision",
        "is_sensitive",
        "drainage_basin",
    ]
    search_fields = [
        "locality_name",
        "water_body",
        "species__scientific_name",
        "source_citation",
        "collector",
    ]
    readonly_fields = [
        "location_generalized",
        "drainage_basin_name",
        "created_at",
        "updated_at",
    ]
    raw_id_fields = ["species", "drainage_basin"]

    def get_readonly_fields(
        self, request: HttpRequest, obj: object = None
    ) -> tuple[str, ...] | list[str]:
        readonly = list(super().get_readonly_fields(request, obj))
        # Only superusers can toggle is_sensitive — controls coordinate visibility
        if not request.user.is_superuser:
            if "is_sensitive" not in readonly:
                readonly.append("is_sensitive")
        return readonly


@admin.register(Watershed)
class WatershedAdmin(admin.ModelAdmin):
    list_display = ["name", "pfafstetter_level", "pfafstetter_code", "area_sq_km"]
    list_filter = ["pfafstetter_level"]
    search_fields = ["name"]
    readonly_fields = ["hybas_id", "geometry", "created_at"]


@admin.register(ProtectedArea)
class ProtectedAreaAdmin(admin.ModelAdmin):
    list_display = ["name", "designation", "iucn_category", "status", "area_km2"]
    list_filter = ["designation", "iucn_category", "status"]
    search_fields = ["name"]
    readonly_fields = ["wdpa_id", "geometry", "created_at"]
