from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from audit.models import AuditEntry


@admin.register(AuditEntry)
class AuditEntryAdmin(admin.ModelAdmin):
    list_display = [
        "timestamp",
        "target_type",
        "target_id",
        "field",
        "action",
        "actor_type",
        "actor_user",
        "actor_institution",
        "actor_system",
    ]
    list_filter = ["target_type", "actor_type", "action", "actor_institution", "timestamp"]
    search_fields = [
        "target_type",
        "target_id",
        "actor_user__email",
        "actor_user__name",
        "actor_institution__name",
        "actor_system",
        "reason",
    ]
    readonly_fields = [
        "target_type",
        "target_id",
        "field",
        "actor_type",
        "actor_user",
        "actor_institution",
        "actor_system",
        "action",
        "before",
        "after",
        "reason",
        "sync_job",
        "timestamp",
    ]
    date_hierarchy = "timestamp"
    ordering = ["-timestamp"]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: AuditEntry | None = None) -> bool:
        # Allow viewing the detail page; block actual edits via readonly_fields.
        return super().has_view_permission(request, obj)

    def has_delete_permission(self, request: HttpRequest, obj: AuditEntry | None = None) -> bool:
        return False

    def has_view_permission(self, request: HttpRequest, obj: AuditEntry | None = None) -> bool:
        # Tier 5 (superuser / admin) only for the global list. Tier 3 scoped
        # inline access lives on the Species change form (gate 06b commit 6).
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        tier = getattr(user, "access_tier", 0)
        return int(tier) >= 5
