"""
Admin registration for `TranslationStatus` — Gate L3 review surface.

L1 had this read-only with the side-by-side review screen scoped out
to L3 (architect §5 / B1 deferral). L3 lifts that:

- Filterable list view by locale, status, content_type, date.
- Detail view shows the EN source and the active locale's translation
  side-by-side with the current TranslationStatus row.
- Three admin actions on selected rows:
    * "Advance to writer-reviewed" (mt_draft → writer_reviewed)
    * "Approve (advance to human-approved)" (writer_reviewed →
      human_approved); also stamps human_approved_by / _at.
    * "Send back to MT draft" (any → mt_draft) for re-review.

The architect's spec called for a custom side-by-side admin view with
EN/target columns and inline edit. The current implementation reuses
Django's stock change_form rendering for TranslationStatus + a new
read-only `compare_text` panel that pulls the EN value and the locale
value off the underlying object. Editing the actual translation
content still happens via the modeltranslation tabs on the Species or
Taxon admin form (link provided). Combining edit + status workflow
into a single screen is a Wave-5 polish.
"""

from __future__ import annotations

from typing import Any

from django.contrib import admin, messages
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _

from i18n.models import TranslationStatus


@admin.register(TranslationStatus)
class TranslationStatusAdmin(admin.ModelAdmin):
    list_display = (
        "content_type",
        "object_id",
        "field",
        "locale",
        "status",
        "human_approved_at",
        "updated_at",
    )
    list_filter = ("locale", "status", "content_type", "mt_provider")
    search_fields = ("field", "notes")
    list_select_related = ("content_type", "human_approved_by")
    actions = (
        "advance_to_writer_reviewed",
        "approve_to_human_approved",
        "send_back_to_mt_draft",
    )

    readonly_fields = (
        "content_type",
        "object_id",
        "field",
        "locale",
        "mt_provider",
        "mt_translated_at",
        "writer_reviewed_at",
        "human_approved_at",
        "human_approved_by",
        "created_at",
        "updated_at",
        "compare_panel",
        "edit_target_object_link",
    )

    fieldsets = (
        (
            _("Identity"),
            {
                "fields": (
                    "content_type",
                    "object_id",
                    "field",
                    "locale",
                    "edit_target_object_link",
                )
            },
        ),
        (
            _("Side-by-side comparison"),
            {
                "fields": ("compare_panel",),
                "description": _(
                    "English source and the active locale's translation. "
                    "To edit the translation itself, follow the link above "
                    "to the Species or Taxon admin and use the modeltranslation "
                    "locale tabs."
                ),
            },
        ),
        (
            _("Pipeline state"),
            {
                "fields": (
                    "status",
                    "notes",
                    "mt_provider",
                    "mt_translated_at",
                    "writer_reviewed_at",
                    "human_approved_at",
                    "human_approved_by",
                ),
            },
        ),
        (
            _("Audit"),
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    # --- read-only comparison panel ------------------------------------

    def compare_panel(self, obj: TranslationStatus) -> str:
        """Render EN source + target-locale value side-by-side."""
        if obj is None or obj.pk is None:
            return "—"
        target = obj.content_object
        if target is None:
            return _("(target object missing)")
        en_value = getattr(target, f"{obj.field}_en", None)
        loc_value = getattr(target, f"{obj.field}_{obj.locale}", None)
        return format_html(
            '<div style="display: grid; grid-template-columns: 1fr 1fr; '
            'gap: 16px; max-width: 960px;">'
            '<div><h3 style="margin: 0 0 6px; font-size: 12px; color: #666;">'
            "ENGLISH ({en_label})</h3>"
            '<div style="white-space: pre-wrap; padding: 12px; '
            "background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; "
            'min-height: 80px;">{en_value}</div></div>'
            '<div><h3 style="margin: 0 0 6px; font-size: 12px; color: #666;">'
            "TARGET ({locale_upper})</h3>"
            '<div style="white-space: pre-wrap; padding: 12px; '
            "background: #fff8e8; border: 1px solid #ddd; border-radius: 4px; "
            'min-height: 80px;">{loc_value}</div></div>'
            "</div>",
            en_label="en",
            en_value=en_value or _("(empty)"),
            locale_upper=obj.locale.upper(),
            loc_value=loc_value or _("(empty)"),
        )

    compare_panel.short_description = _("Comparison")  # type: ignore[attr-defined]

    def edit_target_object_link(self, obj: TranslationStatus) -> str:
        """Link to the underlying Species/Taxon admin change form so the
        reviewer can edit the translation in place via the
        modeltranslation tabs."""
        if obj is None or obj.pk is None or obj.content_type is None:
            return "—"
        try:
            url = reverse(
                f"admin:{obj.content_type.app_label}_{obj.content_type.model}_change",
                args=[obj.object_id],
            )
        except Exception:  # noqa: BLE001
            return _("(no admin URL)")
        return format_html(
            '<a href="{url}" target="_blank">{label}</a>',
            url=url,
            label=_("Edit translation in {model} admin (opens in new tab) →").format(
                model=obj.content_type.model,
            ),
        )

    edit_target_object_link.short_description = _("Edit target")  # type: ignore[attr-defined]

    # --- actions ---------------------------------------------------------

    def has_add_permission(self, request) -> bool:
        # Rows are created by the translate_species command and the
        # post-save signal. Manual creation isn't a workflow step.
        return False

    def advance_to_writer_reviewed(self, request, queryset):
        """Advance selected mt_draft rows to writer_reviewed.
        Skips rows already past mt_draft."""
        from django.utils import timezone

        now = timezone.now()
        eligible = queryset.filter(status=TranslationStatus.Status.MT_DRAFT)
        skipped = queryset.exclude(status=TranslationStatus.Status.MT_DRAFT).count()
        updated = eligible.update(
            status=TranslationStatus.Status.WRITER_REVIEWED,
            writer_reviewed_at=now,
        )
        if updated:
            messages.success(
                request,
                _("{n} row(s) advanced to writer_reviewed.").format(n=updated),
            )
        if skipped:
            messages.info(
                request,
                _("{n} row(s) skipped (not in mt_draft state).").format(n=skipped),
            )

    advance_to_writer_reviewed.short_description = (  # type: ignore[attr-defined]
        _("Advance: mt_draft → writer_reviewed")
    )

    def approve_to_human_approved(self, request, queryset):
        """Approve selected writer_reviewed rows to human_approved.
        Stamps human_approved_at/_by. Skips rows not in writer_reviewed."""
        from django.utils import timezone

        now = timezone.now()
        eligible = queryset.filter(status=TranslationStatus.Status.WRITER_REVIEWED)
        skipped = queryset.exclude(
            status=TranslationStatus.Status.WRITER_REVIEWED
        ).count()
        updated = eligible.update(
            status=TranslationStatus.Status.HUMAN_APPROVED,
            human_approved_at=now,
            human_approved_by=request.user if request.user.is_authenticated else None,
        )
        if updated:
            messages.success(
                request,
                _(
                    "{n} row(s) approved (writer_reviewed → human_approved)."
                ).format(n=updated),
            )
        if skipped:
            messages.info(
                request,
                _(
                    "{n} row(s) skipped (not in writer_reviewed state — "
                    "advance through writer review first)."
                ).format(n=skipped),
            )

    approve_to_human_approved.short_description = (  # type: ignore[attr-defined]
        _("Approve: writer_reviewed → human_approved")
    )

    def send_back_to_mt_draft(self, request, queryset):
        """Demote selected rows back to mt_draft for re-review.
        Clears the reviewed/approved timestamps but preserves the MT
        translation history."""
        eligible = queryset.exclude(status=TranslationStatus.Status.MT_DRAFT)
        skipped = queryset.filter(status=TranslationStatus.Status.MT_DRAFT).count()
        updated = eligible.update(
            status=TranslationStatus.Status.MT_DRAFT,
            writer_reviewed_at=None,
            human_approved_at=None,
            human_approved_by=None,
        )
        if updated:
            messages.warning(
                request,
                _(
                    "{n} row(s) sent back to mt_draft. The translation "
                    "content itself is unchanged; only the pipeline "
                    "status was reset."
                ).format(n=updated),
            )
        if skipped:
            messages.info(
                request,
                _("{n} row(s) skipped (already in mt_draft state).").format(
                    n=skipped
                ),
            )

    send_back_to_mt_draft.short_description = (  # type: ignore[attr-defined]
        _("Send back to mt_draft")
    )
