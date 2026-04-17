"""Tests for AuditEntry append-only enforcement and admin permissions (gate 06b)."""

from __future__ import annotations

import pytest
from django.test import Client

from accounts.models import User
from audit.models import AuditEntry


@pytest.fixture
def admin_user(db: None) -> User:
    return User.objects.create_superuser(
        email="audit-admin@example.com",
        password="securepass12345",
        name="Audit Admin",
    )


@pytest.fixture
def tier3_user(db: None) -> User:
    return User.objects.create_user(
        email="tier3@example.com",
        password="securepass12345",
        name="Tier 3",
        is_active=True,
        is_staff=True,
        access_tier=3,
    )


@pytest.fixture
def entry(db: None, admin_user: User) -> AuditEntry:
    return AuditEntry.objects.create(
        target_type="Species",
        target_id=1,
        field="iucn_status",
        actor_type=AuditEntry.ActorType.USER,
        actor_user=admin_user,
        action=AuditEntry.Action.UPDATE,
        before={"iucn_status": "EN"},
        after={"iucn_status": "CR"},
        reason="Initial creation for test",
    )


@pytest.mark.django_db
class TestAuditEntryAppendOnly:
    def test_create_succeeds(self, admin_user: User) -> None:
        e = AuditEntry.objects.create(
            target_type="Species",
            target_id=42,
            actor_type=AuditEntry.ActorType.SYSTEM,
            actor_system="iucn_sync",
            action=AuditEntry.Action.MIRROR_WRITE,
            before={"iucn_status": "LC"},
            after={"iucn_status": "VU"},
        )
        assert e.pk is not None

    def test_save_on_existing_raises(self, entry: AuditEntry) -> None:
        entry.reason = "modified"
        with pytest.raises(PermissionError):
            entry.save()

    def test_delete_raises(self, entry: AuditEntry) -> None:
        with pytest.raises(PermissionError):
            entry.delete()

    def test_queryset_delete_bypasses_instance_guard(self, entry: AuditEntry) -> None:
        # Django's QuerySet.delete() skips per-instance delete(). This confirms
        # the limitation so the security reviewer sees defense-in-depth is
        # application-level only.
        AuditEntry.objects.filter(pk=entry.pk).delete()
        assert not AuditEntry.objects.filter(pk=entry.pk).exists()


@pytest.mark.django_db
class TestAuditEntryAdminPermissions:
    def test_superuser_can_view_list(self, admin_user: User) -> None:
        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/audit/auditentry/")
        assert resp.status_code == 200

    def test_tier3_forbidden_from_global_list(self, tier3_user: User) -> None:
        c = Client()
        c.force_login(tier3_user)
        resp = c.get("/admin/audit/auditentry/")
        # Tier 3 lacks view permission → admin returns 403 or redirect
        assert resp.status_code in (302, 403)

    def test_admin_add_endpoint_forbidden(self, admin_user: User) -> None:
        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/audit/auditentry/add/")
        assert resp.status_code == 403
