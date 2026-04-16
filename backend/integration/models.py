from django.db import models


class SyncJob(models.Model):
    class JobType(models.TextChoices):
        IUCN_SYNC = "iucn_sync"

    class Status(models.TextChoices):
        PENDING = "pending"
        RUNNING = "running"
        COMPLETED = "completed"
        FAILED = "failed"

    job_type = models.CharField(max_length=20, choices=JobType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    records_processed = models.IntegerField(default=0)
    records_updated = models.IntegerField(default=0)
    records_skipped = models.IntegerField(default=0)
    error_log = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "integration_syncjob"

    def __str__(self) -> str:
        return f"{self.job_type} — {self.status}"
