from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.db.models import QuerySet
from django.http import HttpRequest

from populations.models import ExSituPopulation, HoldingRecord, Institution


class HoldingRecordInline(admin.TabularInline):
    model = HoldingRecord
    extra = 1
    fields = [
        "date",
        "count_total",
        "count_male",
        "count_female",
        "count_unsexed",
        "notes",
        "reporter",
    ]
    readonly_fields = ["reporter"]


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "institution_type",
        "country",
        "city",
        "zims_member",
        "eaza_member",
        "aza_member",
    ]
    list_filter = [
        "institution_type",
        "country",
        "zims_member",
        "eaza_member",
        "aza_member",
    ]
    search_fields = ["name", "city", "country"]


@admin.register(ExSituPopulation)
class ExSituPopulationAdmin(admin.ModelAdmin):
    list_display = [
        "species",
        "institution",
        "count_total",
        "count_male",
        "count_female",
        "breeding_status",
        "studbook_managed",
        "last_census_date",
    ]
    list_filter = ["breeding_status", "studbook_managed", "institution"]
    search_fields = ["species__scientific_name", "institution__name"]
    list_select_related = ["species", "institution"]
    inlines = [HoldingRecordInline]

    def _is_institution_scoped(self, request: HttpRequest) -> bool:
        """Tier 3-4 users can only write to their own institution's records."""
        user = request.user
        return (
            user.is_authenticated
            and hasattr(user, "access_tier")
            and 3 <= user.access_tier <= 4  # type: ignore[union-attr]
            and user.institution_id is not None  # type: ignore[union-attr]
        )

    def get_queryset(self, request: HttpRequest) -> QuerySet:
        qs = super().get_queryset(request)
        if self._is_institution_scoped(request):
            return qs.filter(institution_id=request.user.institution_id)  # type: ignore[union-attr]
        return qs

    def has_change_permission(  # type: ignore[override]
        self, request: HttpRequest, obj: ExSituPopulation | None = None
    ) -> bool:
        if not super().has_change_permission(request, obj):
            return False
        if obj is not None and self._is_institution_scoped(request):
            return obj.institution_id == request.user.institution_id  # type: ignore[union-attr]
        return True

    def has_delete_permission(  # type: ignore[override]
        self, request: HttpRequest, obj: ExSituPopulation | None = None
    ) -> bool:
        if not super().has_delete_permission(request, obj):
            return False
        if obj is not None and self._is_institution_scoped(request):
            return obj.institution_id == request.user.institution_id  # type: ignore[union-attr]
        return True

    def save_model(
        self, request: HttpRequest, obj: ExSituPopulation, form: object, change: bool
    ) -> None:
        if self._is_institution_scoped(request):
            # For updates, check the original DB value — form binding may have changed institution
            if change:
                original = ExSituPopulation.objects.get(pk=obj.pk)
                if original.institution_id != request.user.institution_id:  # type: ignore[union-attr]
                    raise PermissionDenied("You can only modify records for your own institution.")
            # For creates, verify the target institution matches the user's
            if obj.institution_id != request.user.institution_id:  # type: ignore[union-attr]
                raise PermissionDenied("You can only create records for your own institution.")
        super().save_model(request, obj, form, change)

    def save_formset(
        self, request: HttpRequest, form: object, formset: object, change: bool
    ) -> None:
        instances = formset.save(commit=False)  # type: ignore[union-attr]
        for obj in instances:
            if isinstance(obj, HoldingRecord) and obj.pk is None:
                obj.reporter = request.user  # type: ignore[assignment]
            obj.save()
        formset.save_m2m()  # type: ignore[union-attr]
