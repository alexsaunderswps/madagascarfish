"""Signal-handler tests: AuditEntry is written correctly for Species and CA changes."""

from __future__ import annotations

import datetime as dt

import pytest
from audit.context import audit_actor
from audit.models import AuditEntry

from accounts.models import User
from integration.models import SyncJob
from species.models import ConservationAssessment, Species


@pytest.fixture
def user(db: None) -> User:
    return User.objects.create_user(
        email="signals@example.com",
        password="securepass12345",
        name="Signals Tester",
        is_active=True,
        access_tier=5,
    )


@pytest.fixture
def species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia marojejy",
        family="Bedotiidae",
        genus="Bedotia",
        iucn_status="VU",
    )


@pytest.mark.django_db
class TestSpeciesIucnStatusAudit:
    def test_no_entry_when_iucn_status_unchanged(self, species: Species, user: User) -> None:
        AuditEntry.objects.all().delete()
        with audit_actor(user=user):
            species.description = "updated narrative text"
            species.save()
        assert AuditEntry.objects.count() == 0

    def test_update_writes_entry_with_user_actor(self, species: Species, user: User) -> None:
        AuditEntry.objects.all().delete()
        with audit_actor(user=user):
            species.iucn_status = "EN"
            species.save()
        e = AuditEntry.objects.get(target_type="Species", target_id=species.pk)
        assert e.field == "iucn_status"
        assert e.action == AuditEntry.Action.UPDATE
        assert e.before == {"iucn_status": "VU"}
        assert e.after == {"iucn_status": "EN"}
        assert e.actor_type == AuditEntry.ActorType.USER
        assert e.actor_user_id == user.pk

    def test_out_of_context_write_records_unknown_actor(self, species: Species) -> None:
        AuditEntry.objects.all().delete()
        species.iucn_status = "CR"
        species.save()  # no audit_actor — simulates policy violation
        e = AuditEntry.objects.get(target_type="Species", target_id=species.pk)
        assert e.actor_type == AuditEntry.ActorType.SYSTEM
        assert e.actor_system == "unknown"

    def test_iucn_sync_attribution(self, species: Species) -> None:
        AuditEntry.objects.all().delete()
        job = SyncJob.objects.create(job_type="iucn_sync", status="completed")
        with audit_actor(system="iucn_sync", sync_job=job):
            species.iucn_status = "NT"
            species.save()
        e = AuditEntry.objects.get(target_type="Species", target_id=species.pk)
        assert e.action == AuditEntry.Action.MIRROR_WRITE
        assert e.actor_system == "iucn_sync"
        assert e.sync_job_id == job.pk


@pytest.mark.django_db
class TestConservationAssessmentAudit:
    def test_create_writes_create_entry(self, species: Species, user: User) -> None:
        AuditEntry.objects.all().delete()
        with audit_actor(user=user, reason="Expert override per 2026-03 review"):
            ca = ConservationAssessment.objects.create(
                species=species,
                category="CR",
                source=ConservationAssessment.Source.MANUAL_EXPERT,
                assessor="Dr. Loiselle",
                assessment_date=dt.date(2026, 3, 1),
                notes="Field evidence of collapse.",
                created_by=user,
            )
        e = AuditEntry.objects.get(target_type="ConservationAssessment", target_id=ca.pk)
        assert e.action == AuditEntry.Action.CREATE
        assert e.after["source"] == "manual_expert"
        assert e.after["category"] == "CR"
        assert e.reason == "Expert override per 2026-03 review"

    def test_update_writes_only_changed_fields(self, species: Species, user: User) -> None:
        ca = ConservationAssessment.objects.create(
            species=species,
            category="EN",
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
            review_status=ConservationAssessment.ReviewStatus.ACCEPTED,
        )
        AuditEntry.objects.all().delete()
        with audit_actor(user=user):
            ca.review_status = ConservationAssessment.ReviewStatus.PENDING_REVIEW
            ca.save()
        e = AuditEntry.objects.get(target_type="ConservationAssessment", target_id=ca.pk)
        assert e.action == AuditEntry.Action.UPDATE
        assert e.before == {"review_status": "accepted"}
        assert e.after == {"review_status": "pending_review"}

    def test_delete_writes_delete_entry(self, species: Species, user: User) -> None:
        ca = ConservationAssessment.objects.create(
            species=species,
            category="LC",
            source=ConservationAssessment.Source.IUCN_OFFICIAL,
        )
        pk = ca.pk
        AuditEntry.objects.all().delete()
        with audit_actor(user=user):
            ca.delete()
        e = AuditEntry.objects.get(target_type="ConservationAssessment", target_id=pk)
        assert e.action == AuditEntry.Action.DELETE
        assert e.before["category"] == "LC"


@pytest.mark.django_db
class TestAuditActorContext:
    def test_requires_user_or_system(self) -> None:
        with pytest.raises(ValueError):
            with audit_actor():
                pass

    def test_nested_contexts_inner_wins(self, species: Species, user: User) -> None:
        AuditEntry.objects.all().delete()
        with audit_actor(system="outer"):
            with audit_actor(user=user, reason="inner"):
                species.iucn_status = "CR"
                species.save()
        e = AuditEntry.objects.get(target_type="Species", target_id=species.pk)
        assert e.actor_user_id == user.pk
        assert e.reason == "inner"

    def test_exception_inside_context_does_not_leak_state(
        self, species: Species, user: User
    ) -> None:
        class Boom(Exception):  # noqa: N818
            pass

        with pytest.raises(Boom):
            with audit_actor(user=user):
                raise Boom()
        # Next write with no context → unknown attribution
        AuditEntry.objects.all().delete()
        species.iucn_status = "EN"
        species.save()
        e = AuditEntry.objects.get(target_type="Species", target_id=species.pk)
        assert e.actor_system == "unknown"
