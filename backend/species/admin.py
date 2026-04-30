from django import forms
from django.contrib import admin, messages
from django.contrib.gis.admin import GISModelAdmin
from django.core.exceptions import PermissionDenied
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone
from django.utils.html import format_html, format_html_join
from django.utils.translation import gettext_lazy as _
from modeltranslation.admin import TabbedTranslationAdmin

from audit.context import audit_actor
from audit.models import AuditEntry
from species.admin_revalidate import _post_revalidate, revalidate_public_pages
from species.models import (
    CommonName,
    ConservationAssessment,
    ConservationStatusConflict,
    Genus,
    ProtectedArea,
    SiteMapAsset,
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
                self.add_error(
                    field,
                    _("`%(field)s` is required when source is `manual_expert`.")
                    % {"field": field},
                )
            if not cleaned.get("reason"):
                self.add_error(
                    "reason",
                    _("`reason` is required when creating a manual_expert assessment."),
                )
        return cleaned


_SILHOUETTE_UPLOAD_HELP = (
    "Pick a .svg file to replace the text below on save. width/height are "
    "stripped automatically; a viewBox is synthesized if the source has "
    "none. Leave empty to keep the pasted text."
)


def _apply_silhouette_upload(form: forms.ModelForm, cleaned: dict[str, object]) -> None:
    """Shared clean-step for Species / Genus admin forms.

    If a file was uploaded, decode it and overwrite ``silhouette_svg`` in
    cleaned_data so the model save hook normalizes it the same way pasted
    text is normalized (width/height stripped, viewBox synthesized).
    """
    uploaded = cleaned.get("silhouette_svg_file")
    if not isinstance(uploaded, UploadedFile):
        return
    try:
        raw = uploaded.read().decode("utf-8")
    except UnicodeDecodeError:
        form.add_error("silhouette_svg_file", "File is not valid UTF-8 text.")
        return
    if "<svg" not in raw.lower():
        form.add_error("silhouette_svg_file", "File does not contain an <svg> element.")
        return
    cleaned["silhouette_svg"] = raw


class SpeciesAdminForm(forms.ModelForm):
    silhouette_svg_file = forms.FileField(
        required=False,
        label="Upload .svg file (optional)",
        help_text=_SILHOUETTE_UPLOAD_HELP,
    )

    class Meta:
        model = Species
        fields = "__all__"

    def clean(self) -> dict[str, object]:
        cleaned = super().clean() or {}
        _apply_silhouette_upload(self, cleaned)
        return cleaned


class GenusAdminForm(forms.ModelForm):
    silhouette_svg_file = forms.FileField(
        required=False,
        label="Upload .svg file (optional)",
        help_text=_SILHOUETTE_UPLOAD_HELP,
    )

    class Meta:
        model = Genus
        fields = "__all__"

    def clean(self) -> dict[str, object]:
        cleaned = super().clean() or {}
        _apply_silhouette_upload(self, cleaned)
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


@admin.register(Genus)
class GenusAdmin(admin.ModelAdmin):
    form = GenusAdminForm
    list_display = ["name", "family", "species_count", "has_silhouette", "updated_at"]
    list_filter = ["family"]
    search_fields = ["name", "family"]
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        ("Identity", {"fields": ("name", "family")}),
        (
            "Silhouette",
            {
                "fields": ("silhouette_svg_file", "silhouette_svg", "silhouette_credit"),
                "description": (
                    "Fallback SVG used on species profiles that have no "
                    "silhouette of their own. Same authoring conventions as "
                    "the Species silhouette field: viewBox required, "
                    'fill="currentColor", omit width/height on the root.'
                ),
            },
        ),
        ("Notes", {"fields": ("notes",)}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
    actions = [revalidate_public_pages]

    @admin.display(description="# species", ordering="species__count")
    def species_count(self, obj: Genus) -> int:
        return obj.species.count()

    @admin.display(boolean=True, description="Silhouette")
    def has_silhouette(self, obj: Genus) -> bool:
        return bool(obj.silhouette_svg)

    def save_model(
        self, request: HttpRequest, obj: Genus, form: forms.ModelForm, change: bool
    ) -> None:
        super().save_model(request, obj, form, change)
        ok, msg = _post_revalidate()
        level = messages.SUCCESS if ok else messages.WARNING
        self.message_user(request, msg, level=level)


@admin.register(SiteMapAsset)
class SiteMapAssetAdmin(admin.ModelAdmin):
    list_display = ["slot", "image_preview", "updated_at"]
    readonly_fields = ["image_preview", "updated_at"]
    fieldsets = (
        (
            "Slot",
            {
                "fields": ("slot", "expected_width_px", "expected_height_px", "usage_notes"),
                "description": (
                    "Fixed slot consumed by a specific page region. Rows are "
                    "pre-seeded; admins edit them rather than creating new ones."
                ),
            },
        ),
        (
            "Image",
            {
                "fields": ("image", "image_preview", "alt_text", "credit"),
                "description": (
                    "Upload a PNG or JPEG at or above the expected dimensions. "
                    "Alt text is required when an image is set — screen-reader "
                    "users rely on it to understand the thumbnail."
                ),
            },
        ),
        ("Timestamps", {"fields": ("updated_at",)}),
    )
    actions = [revalidate_public_pages]

    @admin.display(description="Preview")
    def image_preview(self, obj: SiteMapAsset) -> str:
        if not obj.image:
            return "—"
        return format_html(
            '<img src="{}" style="max-width:240px; max-height:120px; border:1px solid #ccc;" />',
            obj.image.url,
        )

    def save_model(
        self, request: HttpRequest, obj: SiteMapAsset, form: forms.ModelForm, change: bool
    ) -> None:
        super().save_model(request, obj, form, change)
        # Home and Profile pages pull these by slot at render time; revalidate so
        # the new image appears without waiting for the ISR window.
        ok, msg = _post_revalidate()
        level = messages.SUCCESS if ok else messages.WARNING
        self.message_user(request, msg, level=level)


@admin.register(Species)
class SpeciesAdmin(TabbedTranslationAdmin):
    form = SpeciesAdminForm
    list_display = [
        "scientific_name",
        "taxonomic_status",
        "family",
        "genus",
        "endemic_status",
        "iucn_status",
        "cares_status",
        "shoal_priority",
        "location_sensitivity",
    ]
    list_filter = [
        "taxonomic_status",
        "iucn_status",
        "cares_status",
        "endemic_status",
        "family",
        "shoal_priority",
        "location_sensitivity",
        "genus_fk",
    ]
    autocomplete_fields = ["genus_fk"]
    search_fields = [
        "scientific_name",
        "provisional_name",
        "common_names__name",
    ]
    ordering = ["scientific_name"]
    list_select_related = ["taxon", "genus_fk"]
    # iucn_status is a denormalized mirror (see CLAUDE.md "Conservation status
    # sourcing"). Editing it here would bypass the audit trail and the
    # ConservationAssessment review workflow. Change status by creating an
    # assessment row instead.
    readonly_fields = ["iucn_status", "created_at", "updated_at"]
    inlines = [ConservationAssessmentInline, CommonNameInline, SpeciesLocalityInline]
    actions = [revalidate_public_pages]

    def get_readonly_fields(
        self, request: HttpRequest, obj: object = None
    ) -> tuple[str, ...] | list[str]:
        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None and _user_tier(request) >= 3:
            if "recent_iucn_status_audit" not in fields:
                fields.append("recent_iucn_status_audit")
        # location_sensitivity flips coordinate visibility on the public map,
        # so editing it is superuser-only — mirrors the gating on
        # SpeciesLocality.is_sensitive.
        if not request.user.is_superuser and "location_sensitivity" not in fields:
            fields.append("location_sensitivity")
        return fields

    def get_fieldsets(
        self, request: HttpRequest, obj: object = None
    ) -> list[tuple[str | None, dict]]:
        fieldsets = list(super().get_fieldsets(request, obj))
        if obj is not None and _user_tier(request) >= 3:
            fieldsets.append(
                (
                    "Conservation status audit (last 10 changes)",
                    {"fields": ("recent_iucn_status_audit",)},
                )
            )
        return fieldsets

    @admin.display(description="Recent iucn_status changes")
    def recent_iucn_status_audit(self, obj: Species) -> str:
        entries = AuditEntry.objects.filter(
            target_type="Species",
            target_id=obj.pk,
            field="iucn_status",
        ).order_by("-timestamp")[:10]
        if not entries:
            return _("No audit entries recorded.")
        rows = format_html_join(
            "",
            "<tr><td>{}</td><td>{}</td><td>{}→{}</td><td>{}</td><td>{}</td></tr>",
            (
                (
                    e.timestamp.strftime("%Y-%m-%d %H:%M"),
                    e.get_action_display(),
                    (e.before or {}).get("iucn_status") or "—",
                    (e.after or {}).get("iucn_status") or "—",
                    e.actor_user.email if e.actor_user_id else (e.actor_system or "—"),
                    e.reason or "",
                )
                for e in entries
            ),
        )
        return format_html(
            "<table style='border-collapse:collapse' border='1' cellpadding='4'>"
            "<thead><tr><th>When</th><th>Action</th><th>Change</th>"
            "<th>Actor</th><th>Reason</th></tr></thead><tbody>{}</tbody></table>",
            rows,
        )

    def save_model(
        self, request: HttpRequest, obj: Species, form: forms.ModelForm, change: bool
    ) -> None:
        super().save_model(request, obj, form, change)
        ok, msg = _post_revalidate()
        level = messages.SUCCESS if ok else messages.WARNING
        self.message_user(request, msg, level=level)


def _user_tier(request: HttpRequest) -> int:
    user = request.user
    if user.is_authenticated and hasattr(user, "access_tier"):
        return int(user.access_tier)  # type: ignore[union-attr]
    return 0


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
    autocomplete_fields = ["species"]
    list_select_related = ["species", "flagged_by", "created_by"]
    readonly_fields = [
        "flagged_by",
        "flagged_date",
        "created_at",
        "conflict_acknowledged_assessment_ids",
    ]
    actions = [revalidate_public_pages]

    def has_add_permission(self, request: HttpRequest) -> bool:
        if not super().has_add_permission(request):
            return False
        # Manual_expert authorship requires Tier 3+. Other sources are admin-only
        # in practice (created by iucn_sync); we allow Tier 3+ to add any source
        # and rely on the source dropdown + form validation for governance.
        return _user_tier(request) >= 3

    def has_change_permission(
        self, request: HttpRequest, obj: ConservationAssessment | None = None
    ) -> bool:
        if not super().has_change_permission(request, obj):
            return False
        return _user_tier(request) >= 3

    def save_model(
        self,
        request: HttpRequest,
        obj: ConservationAssessment,
        form: forms.ModelForm,
        change: bool,
    ) -> None:
        if obj.source == ConservationAssessment.Source.MANUAL_EXPERT:
            if _user_tier(request) < 3:
                raise PermissionDenied(
                    _(
                        "Tier 3 (Conservation Coordinator) or higher is required to "
                        "author a manual_expert assessment."
                    )
                )
            if obj.created_by_id is None:
                obj.created_by = request.user  # type: ignore[assignment]
        super().save_model(request, obj, form, change)


@admin.register(Taxon)
class TaxonAdmin(TabbedTranslationAdmin):
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
        "needs_review",
    ]
    list_filter = [
        "needs_review",
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
    autocomplete_fields = ["species", "drainage_basin"]
    actions = [revalidate_public_pages]

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
    ordering = ["name"]
    readonly_fields = ["hybas_id", "geometry", "created_at"]


@admin.register(ProtectedArea)
class ProtectedAreaAdmin(admin.ModelAdmin):
    list_display = ["name", "designation", "iucn_category", "status", "area_km2"]
    list_filter = ["designation", "iucn_category", "status"]
    search_fields = ["name"]
    ordering = ["name"]
    readonly_fields = ["wdpa_id", "geometry", "created_at"]


class ConservationStatusConflictAdminForm(forms.ModelForm):
    reconciled_category = forms.ChoiceField(
        choices=[("", "—")] + list(Species.IUCNStatus.choices),
        required=False,
        help_text="Required only when resolution='reconciled'.",
    )

    class Meta:
        model = ConservationStatusConflict
        fields = "__all__"

    def clean(self) -> dict[str, object]:
        cleaned = super().clean() or {}
        if cleaned.get("status") == ConservationStatusConflict.Status.RESOLVED:
            if not cleaned.get("resolution"):
                self.add_error("resolution", "Required when marking resolved.")
            if not cleaned.get("resolution_reason"):
                self.add_error("resolution_reason", "Required when marking resolved.")
            if cleaned.get(
                "resolution"
            ) == ConservationStatusConflict.Resolution.RECONCILED and not cleaned.get(
                "reconciled_category"
            ):
                self.add_error(
                    "reconciled_category",
                    "Required when resolution='reconciled'.",
                )
        return cleaned


@admin.register(ConservationStatusConflict)
class ConservationStatusConflictAdmin(admin.ModelAdmin):
    form = ConservationStatusConflictAdminForm
    list_display = [
        "species",
        "status",
        "resolution",
        "detected_at",
        "resolved_by",
        "resolved_at",
    ]
    list_filter = ["status", "resolution"]
    search_fields = ["species__scientific_name"]
    list_select_related = ["species", "resolved_by"]
    readonly_fields = [
        "species",
        "manual_assessment",
        "iucn_assessment",
        "detected_at",
        "detected_by_sync_job",
        "resolved_by",
        "resolved_at",
    ]

    def has_add_permission(self, request: HttpRequest) -> bool:
        # Conflicts are raised by iucn_sync, not added by hand.
        return False

    def has_delete_permission(
        self, request: HttpRequest, obj: ConservationStatusConflict | None = None
    ) -> bool:
        return False

    def has_view_permission(
        self, request: HttpRequest, obj: ConservationStatusConflict | None = None
    ) -> bool:
        if not super().has_view_permission(request, obj):
            return False
        return _user_tier(request) >= 3

    def has_change_permission(
        self, request: HttpRequest, obj: ConservationStatusConflict | None = None
    ) -> bool:
        if not super().has_change_permission(request, obj):
            return False
        return _user_tier(request) >= 3

    def save_model(
        self,
        request: HttpRequest,
        obj: ConservationStatusConflict,
        form: forms.ModelForm,
        change: bool,
    ) -> None:
        # Only act on the open → resolved transition.
        if not change or obj.status != ConservationStatusConflict.Status.RESOLVED:
            super().save_model(request, obj, form, change)
            return
        reconciled_category = form.cleaned_data.get("reconciled_category") or None
        reason = form.cleaned_data.get("resolution_reason") or ""
        with audit_actor(user=request.user, reason=reason):
            with transaction.atomic():
                obj.resolved_by = request.user  # type: ignore[assignment]
                obj.resolved_at = timezone.now()
                _apply_conflict_resolution(obj, reconciled_category, request.user)
                super().save_model(request, obj, form, change)
                AuditEntry.objects.create(
                    target_type="ConservationStatusConflict",
                    target_id=obj.pk,
                    action=AuditEntry.Action.CONFLICT_RESOLVED,
                    before={"status": "open"},
                    after={"status": "resolved", "resolution": obj.resolution},
                    actor_type=AuditEntry.ActorType.USER,
                    actor_user=request.user,
                    reason=reason,
                )


def _apply_conflict_resolution(
    conflict: ConservationStatusConflict,
    reconciled_category: str | None,
    user: object,
) -> None:
    """Side-effect chain per BA §3 Req 4 resolution-outcome table."""
    manual = conflict.manual_assessment
    iucn = conflict.iucn_assessment
    species = conflict.species
    res = conflict.resolution
    note = (
        f"[conflict {conflict.pk} resolved {timezone.now():%Y-%m-%d} "
        f"by {getattr(user, 'email', user)}: {conflict.resolution_reason}]"
    )

    if res == ConservationStatusConflict.Resolution.ACCEPTED_IUCN:
        manual.review_status = ConservationAssessment.ReviewStatus.SUPERSEDED
        manual.review_notes = (manual.review_notes or "") + "\n" + note
        manual.save()
        iucn.review_status = ConservationAssessment.ReviewStatus.ACCEPTED
        iucn.review_notes = (iucn.review_notes or "") + "\n" + note
        iucn.save()
        species.iucn_status = iucn.category
        species.save(update_fields=["iucn_status", "updated_at"])
    elif res == ConservationStatusConflict.Resolution.RETAINED_MANUAL:
        iucn.review_notes = (iucn.review_notes or "") + "\n" + note
        iucn.save()
        ack = list(manual.conflict_acknowledged_assessment_ids or [])
        if iucn.iucn_assessment_id and iucn.iucn_assessment_id not in ack:
            ack.append(iucn.iucn_assessment_id)
            manual.conflict_acknowledged_assessment_ids = ack
            manual.save()
    elif res == ConservationStatusConflict.Resolution.RECONCILED:
        manual.review_status = ConservationAssessment.ReviewStatus.SUPERSEDED
        manual.review_notes = (manual.review_notes or "") + "\n" + note
        manual.save()
        iucn.review_status = ConservationAssessment.ReviewStatus.SUPERSEDED
        iucn.review_notes = (iucn.review_notes or "") + "\n" + note
        iucn.save()
        new_row = ConservationAssessment.objects.create(
            species=species,
            category=reconciled_category or manual.category,
            source=ConservationAssessment.Source.MANUAL_EXPERT,
            review_status=ConservationAssessment.ReviewStatus.ACCEPTED,
            assessor=getattr(user, "name", "") or getattr(user, "email", ""),
            assessment_date=timezone.now().date(),
            notes=f"Reconciled from conflict {conflict.pk}. {conflict.resolution_reason}",
            created_by=user if hasattr(user, "pk") else None,
        )
        species.iucn_status = new_row.category
        species.save(update_fields=["iucn_status", "updated_at"])
    elif res == ConservationStatusConflict.Resolution.DISMISSED:
        # Conflict.iucn_assessment is on_delete=PROTECT, so null the FK and
        # persist the conflict first, then delete the IUCN row.
        conflict.iucn_assessment = None  # type: ignore[assignment]
        conflict.save(update_fields=["iucn_assessment"])
        iucn.delete()
