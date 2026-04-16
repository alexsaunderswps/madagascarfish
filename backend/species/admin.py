from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
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
    list_display = [
        "species",
        "category",
        "source",
        "review_status",
        "assessment_date",
        "assessor",
        "flagged_by",
        "flagged_date",
    ]
    list_filter = ["source", "review_status", "category"]
    search_fields = ["species__scientific_name", "notes", "criteria"]
    list_select_related = ["species", "flagged_by"]
    readonly_fields = ["flagged_by", "flagged_date", "created_at"]


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
