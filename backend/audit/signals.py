"""Signal handlers that emit AuditEntry rows for governance-scope changes.

In-scope (gate 06b):
- ``Species.iucn_status`` (field-level audit). Any change writes an entry.
- ``ConservationAssessment`` (row-level audit). Create / update / delete.

Out of scope: other Species fields, Institution, ExSituPopulation, etc.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db.models import Model
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from audit.context import current_actor
from audit.models import AuditEntry

# Fields on ConservationAssessment whose changes we record in row-level audit
# entries. Excludes denormalised / auto fields and relations we don't track.
_CA_TRACKED_FIELDS = [
    "species_id",
    "category",
    "criteria",
    "assessor",
    "assessment_date",
    "source",
    "notes",
    "review_status",
    "review_notes",
    "flagged_by_id",
    "flagged_date",
    "created_by_id",
    "conflict_acknowledged_assessment_ids",
    "last_sync_job_id",
]


def _attribution() -> dict[str, Any]:
    """Resolve actor attribution from the current thread-local context.

    Returns a dict ready to splat into ``AuditEntry.objects.create(...)``.
    Falls back to ``actor_system='unknown'`` so out-of-band writes remain
    searchable (BA Req 3a).
    """
    ctx = current_actor()
    if ctx is None:
        return {
            "actor_type": AuditEntry.ActorType.SYSTEM,
            "actor_system": "unknown",
            "actor_user": None,
            "sync_job": None,
            "reason": "",
        }
    if ctx.user is not None:
        return {
            "actor_type": AuditEntry.ActorType.USER,
            "actor_user": ctx.user,
            "actor_system": "",
            "sync_job": ctx.sync_job,
            "reason": ctx.reason,
        }
    return {
        "actor_type": AuditEntry.ActorType.SYSTEM,
        "actor_system": ctx.system or "unknown",
        "actor_user": None,
        "sync_job": ctx.sync_job,
        "reason": ctx.reason,
    }


def _snapshot(instance: Model, fields: list[str]) -> dict[str, Any]:
    snap: dict[str, Any] = {}
    for field_name in fields:
        value = getattr(instance, field_name, None)
        # Coerce non-JSON-serialisable values to string. Dates stringify cleanly.
        if value is None or isinstance(value, (str, int, float, bool, list, dict)):
            snap[field_name] = value
        else:
            snap[field_name] = str(value)
    return snap


@receiver(pre_save, sender="species.Species")
def species_capture_pre_save(sender: type[Model], instance: Any, **kwargs: Any) -> None:
    """Cache the current DB value of ``iucn_status`` so post_save can diff it."""
    if instance.pk is None:
        instance._audit_iucn_status_before = None
        return
    try:
        existing = sender.objects.only("iucn_status").get(pk=instance.pk)
    except sender.DoesNotExist:
        instance._audit_iucn_status_before = None
        return
    instance._audit_iucn_status_before = existing.iucn_status
    # Foot-gun guard: when AUDIT_STRICT_CONTEXT is on (dev default), refuse to
    # save an iucn_status change without an active audit_actor context.
    # Production keeps it off and falls back to actor_system='unknown' so
    # writes still complete and remain searchable.
    if (
        getattr(settings, "AUDIT_STRICT_CONTEXT", False)
        and existing.iucn_status != instance.iucn_status
        and current_actor() is None
    ):
        raise AssertionError(
            "Species.iucn_status changed outside an audit_actor context. "
            "Wrap the write in `with audit_actor(...):` or route through "
            "ConservationAssessment. See CLAUDE.md 'Conservation status sourcing'."
        )


@receiver(post_save, sender="species.Species")
def species_audit_post_save(
    sender: type[Model], instance: Any, created: bool, **kwargs: Any
) -> None:
    """Write an AuditEntry when ``iucn_status`` changes (create or update)."""
    before = getattr(instance, "_audit_iucn_status_before", None)
    after = instance.iucn_status
    if not created and before == after:
        return
    attr = _attribution()
    ctx = current_actor()
    action = (
        AuditEntry.Action.MIRROR_WRITE
        if ctx and ctx.system == "iucn_sync"
        else (AuditEntry.Action.CREATE if created else AuditEntry.Action.UPDATE)
    )
    AuditEntry.objects.create(
        target_type="Species",
        target_id=instance.pk,
        field="iucn_status",
        action=action,
        before={"iucn_status": before},
        after={"iucn_status": after},
        **attr,
    )


@receiver(pre_save, sender="species.ConservationAssessment")
def ca_capture_pre_save(sender: type[Model], instance: Any, **kwargs: Any) -> None:
    if instance.pk is None:
        instance._audit_ca_before = None
        return
    try:
        existing = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        instance._audit_ca_before = None
        return
    instance._audit_ca_before = _snapshot(existing, _CA_TRACKED_FIELDS)


@receiver(post_save, sender="species.ConservationAssessment")
def ca_audit_post_save(sender: type[Model], instance: Any, created: bool, **kwargs: Any) -> None:
    after = _snapshot(instance, _CA_TRACKED_FIELDS)
    if created:
        before: dict[str, Any] = {}
        action = AuditEntry.Action.CREATE
    else:
        before = getattr(instance, "_audit_ca_before", {}) or {}
        # Only record fields that actually changed
        changed_after = {k: v for k, v in after.items() if before.get(k) != v}
        if not changed_after:
            return
        after = changed_after
        before = {k: before.get(k) for k in changed_after}
        action = AuditEntry.Action.UPDATE
    AuditEntry.objects.create(
        target_type="ConservationAssessment",
        target_id=instance.pk,
        action=action,
        before=before,
        after=after,
        **_attribution(),
    )


@receiver(post_delete, sender="species.ConservationAssessment")
def ca_audit_post_delete(sender: type[Model], instance: Any, **kwargs: Any) -> None:
    AuditEntry.objects.create(
        target_type="ConservationAssessment",
        target_id=instance.pk or 0,
        action=AuditEntry.Action.DELETE,
        before=_snapshot(instance, _CA_TRACKED_FIELDS),
        after={},
        **_attribution(),
    )
