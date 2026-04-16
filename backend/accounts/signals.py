from django.db.models.signals import pre_delete
from django.dispatch import receiver

from accounts.models import AuditLog


@receiver(pre_delete, sender=AuditLog)
def prevent_audit_log_deletion(
    sender: type[AuditLog], instance: AuditLog, **kwargs: object
) -> None:
    raise RuntimeError("AuditLog records cannot be deleted")
