from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import models


class AuditEntry(models.Model):
    """Append-only audit record of conservation-status-governance changes.

    Covers `Species.iucn_status` (field-level) and `ConservationAssessment`
    (row-level) per gate 06b scope. Other models are out of scope in phase 1.

    Enforcement:
    - `save()` refuses updates (an instance with a pk cannot be re-saved).
    - `delete()` raises.
    - The admin disables add/change/delete permissions.
    None of these are defense-in-depth against raw SQL — the audit log's
    integrity ultimately depends on DB-level permissions in production.
    """

    class ActorType(models.TextChoices):
        USER = "user"
        SYSTEM = "system"

    class Action(models.TextChoices):
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"
        MIRROR_WRITE = "mirror_write"
        CONFLICT_DETECTED = "conflict_detected"
        CONFLICT_RESOLVED = "conflict_resolved"

    target_type = models.CharField(max_length=100)
    target_id = models.PositiveIntegerField()
    field = models.CharField(max_length=100, blank=True, default="")
    actor_type = models.CharField(max_length=10, choices=ActorType.choices)
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_entries",
    )
    actor_institution = models.ForeignKey(
        "populations.Institution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text=(
            "Snapshot of the actor's institution at edit time. Defends "
            "against later User.institution reassignment obscuring history."
        ),
    )
    actor_system = models.CharField(max_length=50, blank=True, default="")
    action = models.CharField(max_length=30, choices=Action.choices)
    before = models.JSONField(default=dict, blank=True)
    after = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True, default="")
    sync_job = models.ForeignKey(
        "integration.SyncJob",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_entries",
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_entry"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(
                fields=["target_type", "target_id", "-timestamp"],
                name="audit_target_time_idx",
            ),
            models.Index(fields=["actor_type", "-timestamp"], name="audit_actor_time_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.action} {self.target_type}#{self.target_id} @ {self.timestamp:%Y-%m-%d}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            raise PermissionError("AuditEntry is append-only; updates are not permitted.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise PermissionError("AuditEntry is append-only; deletion is not permitted.")
