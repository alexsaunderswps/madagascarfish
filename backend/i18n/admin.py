"""
Admin registration for `TranslationStatus` — Gate L3 review surface.

L1 had this read-only with the side-by-side review screen scoped out
to L3 (architect §5 / B1 deferral). L3 lifts that:

- Filterable list view by locale, status, content_type, date.
- Detail view shows the EN source on the left and the **editable**
  target-locale translation on the right. Saving the form writes the
  edit back to the underlying Species/Taxon row (which fires the
  post_save signal that keeps the TranslationStatus row in sync).
- Three admin actions on selected rows:
    * "Advance to writer-reviewed" (mt_draft → writer_reviewed)
    * "Approve (advance to human-approved)" (writer_reviewed →
      human_approved); also stamps human_approved_by / _at.
    * "Send back to MT draft" (any → mt_draft) for re-review.
- A "Send back to mt_draft" link on the change form for the same
  effect on a single row.

The change form's `target_text` field is a virtual/synthetic field
(not on the model) populated in `get_form` from the underlying
object's `<field>_<locale>` column and persisted in `save_model` by
writing back to that same column. This avoids the round-trip through
the Species/Taxon admin and keeps the reviewer on a single screen.
"""

from __future__ import annotations

from django import forms
from django.contrib import admin, messages
from django.urls import reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from i18n.models import TranslationStatus


class TranslationStatusForm(forms.ModelForm):
    """ModelForm that adds a synthetic `target_text` field. Reads from
    and writes to the underlying Species/Taxon row's
    `<field>_<locale>` column, so the reviewer can edit the
    translation directly on the TranslationStatus change page without
    flipping into a separate admin.

    The `english_source` field is read-only and shows the en column
    for context.
    """

    english_source = forms.CharField(
        label=_("English source"),
        required=False,
        widget=forms.Textarea(
            attrs={
                "rows": 8,
                "readonly": True,
                "style": (
                    "width: 100%; max-width: 100%; "
                    "background: #f8f8f8; "
                    "border: 1px solid #ccc; "
                    "padding: 10px; "
                    "font-family: var(--font-family-monospace, monospace); "
                    "font-size: 13px; "
                    "line-height: 1.45;"
                ),
            }
        ),
        help_text=_(
            "The English source text. Read-only — edit on the underlying "
            "Species or Taxon admin form if the source needs to change."
        ),
    )
    target_text = forms.CharField(
        label=_("Target translation"),
        required=False,
        widget=forms.Textarea(
            attrs={
                "rows": 12,
                "style": (
                    "width: 100%; max-width: 100%; "
                    "background: #fff8e8; "
                    "border: 1px solid #d4ad6a; "
                    "padding: 10px; "
                    "font-size: 13px; "
                    "line-height: 1.45;"
                ),
            }
        ),
        help_text=_(
            "The translation in the target locale. Saving this form "
            "writes the edit back to the underlying object's "
            "&lt;field&gt;_&lt;locale&gt; column. Substantive edits "
            "should be paired with a 'Send back to mt_draft' to "
            "re-route through review."
        ),
    )

    class Meta:
        model = TranslationStatus
        fields = "__all__"


@admin.register(TranslationStatus)
class TranslationStatusAdmin(admin.ModelAdmin):
    form = TranslationStatusForm
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
            _("Side-by-side comparison + inline edit"),
            {
                "fields": ("english_source", "target_text"),
                "description": _(
                    "Edit the translation directly here; saving writes "
                    "it back to the underlying object. The English "
                    "source is read-only."
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

    def get_form(self, request, obj=None, **kwargs):
        """Populate `english_source` and `target_text` from the
        underlying object so the form pre-fills with the current
        values. Without this, the synthetic fields render empty on
        change pages."""
        Form = super().get_form(request, obj, **kwargs)
        if obj is not None and obj.content_object is not None:
            target = obj.content_object
            en_value = getattr(target, f"{obj.field}_en", None) or ""
            loc_value = getattr(target, f"{obj.field}_{obj.locale}", None) or ""
            Form.base_fields["english_source"].initial = en_value
            Form.base_fields["target_text"].initial = loc_value
        return Form

    def save_model(self, request, obj, form, change):
        """When the form saves, write `target_text` back to the
        underlying Species/Taxon row's `<field>_<locale>` column.
        The post_save signal on that model fires automatically and
        keeps any other TranslationStatus rows in sync (no-op for
        this row since we save it after)."""
        target = obj.content_object
        if target is not None and "target_text" in form.cleaned_data:
            new_text = form.cleaned_data["target_text"] or ""
            column = f"{obj.field}_{obj.locale}"
            current = getattr(target, column, None) or ""
            if new_text != current:
                setattr(target, column, new_text)
                target.save(update_fields=[column])
                messages.info(
                    request,
                    _(
                        "Translation content for {model}#{id}.{field} "
                        "({locale}) saved. If the change is substantive, "
                        "consider 'Send back to mt_draft' so it routes "
                        "through review again."
                    ).format(
                        model=obj.content_type.model,
                        id=obj.object_id,
                        field=obj.field,
                        locale=obj.locale,
                    ),
                )
        super().save_model(request, obj, form, change)

    def edit_target_object_link(self, obj: TranslationStatus) -> str:
        """Escape hatch link to the underlying Species/Taxon admin —
        useful when the reviewer needs to also edit the English source
        (which can't be edited inline here) or use the modeltranslation
        locale tabs across all four languages at once."""
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
            label=_(
                "Open underlying {model} admin (opens new tab) — for editing the "
                "English source or using all-locale tabs →"
            ).format(model=obj.content_type.model),
        )

    edit_target_object_link.short_description = _("Underlying admin")  # type: ignore[attr-defined]

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
