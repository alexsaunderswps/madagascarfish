from django.contrib import admin

from integration.models import SyncJob


@admin.register(SyncJob)
class SyncJobAdmin(admin.ModelAdmin):
    list_display = [
        "job_type",
        "status",
        "started_at",
        "completed_at",
        "records_processed",
        "records_created",
        "records_updated",
        "records_skipped",
    ]
    list_filter = ["job_type", "status"]
    readonly_fields = [
        "job_type",
        "status",
        "started_at",
        "completed_at",
        "records_processed",
        "records_created",
        "records_updated",
        "records_skipped",
        "error_log",
    ]

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object = None) -> bool:
        return False

    def has_delete_permission(self, request: object, obj: object = None) -> bool:
        return False
