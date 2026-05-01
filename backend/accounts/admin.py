from __future__ import annotations

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _

from accounts.models import AuditLog, PendingInstitutionClaim, User

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
    autocomplete_fields = ["institution"]
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

    def get_readonly_fields(  # type: ignore[override]
        self, request: HttpRequest, obj: User | None = None
    ) -> tuple[str, ...] | list[str]:
        readonly = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser:
            readonly.extend(f for f in _PRIVILEGE_FIELDS if f not in readonly)
        return readonly


@admin.register(PendingInstitutionClaim)
class PendingInstitutionClaimAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "institution",
        "status",
        "requested_at",
        "reviewed_at",
        "reviewed_by",
    ]
    list_filter = ["status", "institution"]
    search_fields = [
        "user__email",
        "user__name",
        "institution__name",
        "review_notes",
    ]
    autocomplete_fields = ["user", "institution", "reviewed_by"]
    readonly_fields = ["requested_at", "reviewed_at", "reviewed_by"]
    actions = ["approve_selected", "reject_selected"]
    ordering = ["-requested_at"]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user", "institution", "reviewed_by")

    def has_view_permission(self, request: HttpRequest, obj=None) -> bool:
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return int(getattr(user, "access_tier", 0)) >= 3

    def has_change_permission(self, request: HttpRequest, obj=None) -> bool:
        # Tier 3+ can transition claim state via the actions, but the per-row
        # form must not let them rewrite reviewer/timestamps directly. The
        # `readonly_fields` constraint covers this; allow viewing the form.
        return self.has_view_permission(request, obj)

    def has_add_permission(self, request: HttpRequest) -> bool:
        # Claims are created through signup, not in admin. Permitting `add`
        # here would let a Tier 3+ user (or any is_staff user, per Django's
        # default) create a fully-formed APPROVED claim and bypass the
        # signup → review queue. Superuser-only as a break-glass.
        return request.user.is_superuser

    def has_delete_permission(self, request: HttpRequest, obj=None) -> bool:
        # Claims are append-only history. Deleting a row would erase
        # forensic evidence (prior rejection, withdrawn claim). Superuser
        # only as a break-glass for genuine data-correction needs.
        return request.user.is_superuser

    @admin.action(description=_("Approve selected pending claims"))
    def approve_selected(self, request: HttpRequest, queryset):
        from accounts.services import approve_claim

        pending = queryset.filter(status=PendingInstitutionClaim.Status.PENDING)
        approved = 0
        skipped = queryset.exclude(status=PendingInstitutionClaim.Status.PENDING).count()
        for claim in pending.select_related("user", "institution"):
            approve_claim(claim=claim, reviewer=request.user, review_notes="")
            approved += 1
        if approved:
            messages.success(
                request,
                _("Approved %(n)d institution claim(s).") % {"n": approved},
            )
        if skipped:
            messages.warning(
                request,
                _("Skipped %(n)d non-pending claim(s) — only pending claims can be approved.")
                % {"n": skipped},
            )

    @admin.action(description=_("Reject selected pending claims"))
    def reject_selected(self, request: HttpRequest, queryset):
        from accounts.services import reject_claim

        pending = queryset.filter(status=PendingInstitutionClaim.Status.PENDING)
        rejected = 0
        skipped = queryset.exclude(status=PendingInstitutionClaim.Status.PENDING).count()
        for claim in pending.select_related("user", "institution"):
            reject_claim(claim=claim, reviewer=request.user, review_notes="")
            rejected += 1
        if rejected:
            messages.success(
                request,
                _("Rejected %(n)d institution claim(s).") % {"n": rejected},
            )
        if skipped:
            messages.warning(
                request,
                _("Skipped %(n)d non-pending claim(s) — only pending claims can be rejected.")
                % {"n": skipped},
            )


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
