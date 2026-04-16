from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.http import HttpRequest

from accounts.models import AuditLog, User

# Fields that only superusers may edit — prevents privilege escalation
_PRIVILEGE_FIELDS = ("access_tier", "is_active", "is_staff", "is_superuser")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        "email",
        "name",
        "access_tier",
        "institution",
        "is_active",
        "date_joined",
    ]
    list_filter = ["access_tier", "is_active", "institution"]
    search_fields = ["email", "name"]
    readonly_fields = ["date_joined", "last_login"]
    ordering = ["email"]
    fieldsets = [
        (None, {"fields": ["email", "name", "password"]}),
        ("Access", {"fields": ["access_tier", "institution", "is_active", "is_staff"]}),
        ("Profile", {"fields": ["expertise_areas", "orcid_id"]}),
        ("Dates", {"fields": ["date_joined", "last_login"]}),
    ]
    add_fieldsets = [
        (
            None,
            {
                "classes": ["wide"],
                "fields": [
                    "email",
                    "name",
                    "password1",
                    "password2",
                    "access_tier",
                    "institution",
                ],
            },
        ),
    ]

    def get_readonly_fields(self, request: HttpRequest, obj: User | None = None) -> tuple[str, ...] | list[str]:  # type: ignore[override]
        readonly = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser:
            readonly.extend(f for f in _PRIVILEGE_FIELDS if f not in readonly)
        return readonly


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["action", "model_name", "object_id", "user", "timestamp"]
    list_filter = ["action", "model_name"]
    search_fields = ["model_name", "object_id"]
    list_select_related = ["user"]
    readonly_fields = [
        "user",
        "action",
        "model_name",
        "object_id",
        "timestamp",
        "changes",
        "ip_address",
    ]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: AuditLog | None = None) -> bool:  # type: ignore[override]
        return False

    def has_delete_permission(self, request: HttpRequest, obj: AuditLog | None = None) -> bool:  # type: ignore[override]
        return False
