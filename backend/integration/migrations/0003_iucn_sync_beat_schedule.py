from __future__ import annotations

from django.db import migrations

TASK_NAME = "integration.tasks.iucn_sync"
PERIODIC_TASK_NAME = "iucn_sync_weekly"


def create_schedule(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="2",
        day_of_week="0",
        day_of_month="*",
        month_of_year="*",
        timezone="UTC",
    )
    PeriodicTask.objects.update_or_create(
        name=PERIODIC_TASK_NAME,
        defaults={
            "task": TASK_NAME,
            "crontab": schedule,
            "enabled": True,
            "description": "Weekly pull of IUCN Red List assessments (Sunday 02:00 UTC).",
        },
    )


def remove_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name=PERIODIC_TASK_NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("integration", "0002_syncjob_records_created"),
        # Depend on the migration that adds CrontabSchedule.timezone (0016) so
        # create_schedule can pass timezone="UTC" when run on a fresh DB. Earlier
        # celery-beat migrations leave the field absent.
        ("django_celery_beat", "0016_alter_crontabschedule_timezone"),
    ]

    operations = [
        migrations.RunPython(create_schedule, remove_schedule),
    ]
