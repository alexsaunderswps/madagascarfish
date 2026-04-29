"""
Admin registration for `TranslationStatus`.

Read-only in Gate L1. The side-by-side review screen and write actions
(approve / send-back / advance status) are L3 work per architect doc §5.
"""

from django.contrib import admin

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
    readonly_fields = (
        "content_type",
        "object_id",
        "field",
        "locale",
        "status",
        "mt_provider",
        "mt_translated_at",
        "writer_reviewed_at",
        "human_approved_at",
        "human_approved_by",
        "notes",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request) -> bool:
        # L1: rows are created manually only via shell/management
        # commands. The MT pipeline + side-by-side editor lands in L3.
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
