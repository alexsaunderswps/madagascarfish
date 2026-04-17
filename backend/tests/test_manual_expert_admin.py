"""Unit tests for the manual_expert ConservationAssessment admin form (gate 06b)."""

from __future__ import annotations

import datetime as dt

import pytest
from django.test import Client

from accounts.models import User
from species.admin import ConservationAssessmentAdminForm
from species.models import ConservationAssessment, Species


@pytest.fixture
def species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Pachypanchax sakaramyi",
        family="Aplocheilidae",
        genus="Pachypanchax",
    )


@pytest.fixture
def admin_user(db: None) -> User:
    return User.objects.create_superuser(
        email="admin-expert@example.com",
        password="securepass12345",
        name="Admin Expert",
    )


@pytest.fixture
def tier2_user(db: None) -> User:
    return User.objects.create_user(
        email="t2@example.com",
        password="securepass12345",
        name="Researcher",
        is_active=True,
        is_staff=True,
        access_tier=2,
    )


@pytest.mark.django_db
class TestManualExpertFormValidation:
    def _base(self, species: Species, **overrides: object) -> dict[str, object]:
        data: dict[str, object] = {
            "species": species.pk,
            "category": "CR",
            "source": ConservationAssessment.Source.MANUAL_EXPERT,
            "review_status": ConservationAssessment.ReviewStatus.ACCEPTED,
            "assessor": "Dr. Loiselle",
            "assessment_date": dt.date(2026, 3, 1),
            "notes": "Field survey 2026 confirms population decline.",
            "reason": "Override pending IUCN re-assessment.",
            "conflict_acknowledged_assessment_ids": "[]",
        }
        data.update(overrides)
        return data

    def test_valid_manual_expert(self, species: Species) -> None:
        form = ConservationAssessmentAdminForm(data=self._base(species))
        assert form.is_valid(), form.errors

    def test_missing_assessor_rejected(self, species: Species) -> None:
        form = ConservationAssessmentAdminForm(data=self._base(species, assessor=""))
        assert not form.is_valid()
        assert "assessor" in form.errors
        assert "manual_expert" in str(form.errors["assessor"])

    def test_missing_assessment_date_rejected(self, species: Species) -> None:
        form = ConservationAssessmentAdminForm(data=self._base(species, assessment_date=""))
        assert not form.is_valid()
        assert "assessment_date" in form.errors

    def test_missing_notes_rejected(self, species: Species) -> None:
        form = ConservationAssessmentAdminForm(data=self._base(species, notes=""))
        assert not form.is_valid()
        assert "notes" in form.errors

    def test_missing_reason_rejected(self, species: Species) -> None:
        form = ConservationAssessmentAdminForm(data=self._base(species, reason=""))
        assert not form.is_valid()
        assert "reason" in form.errors

    def test_iucn_official_does_not_require_reason(self, species: Species) -> None:
        # Reason / assessor / etc. are not required for non-manual_expert sources.
        form = ConservationAssessmentAdminForm(
            data=self._base(
                species,
                source=ConservationAssessment.Source.IUCN_OFFICIAL,
                reason="",
                assessor="",
                notes="",
            )
        )
        assert form.is_valid(), form.errors


@pytest.mark.django_db
class TestManualExpertAdminPermissions:
    def test_tier2_cannot_add_manual_expert(self, species: Species, tier2_user: User) -> None:
        from django.contrib.auth.models import Permission
        from django.contrib.contenttypes.models import ContentType

        # Grant model-level add permission so the perm check is the *only* gate.
        ct = ContentType.objects.get_for_model(ConservationAssessment)
        for codename in (
            "view_conservationassessment",
            "add_conservationassessment",
            "change_conservationassessment",
        ):
            tier2_user.user_permissions.add(
                Permission.objects.get(content_type=ct, codename=codename)
            )
        c = Client()
        c.force_login(User.objects.get(pk=tier2_user.pk))
        resp = c.get("/admin/species/conservationassessment/add/")
        # Tier 2 lacks Tier 3+ tier — has_add_permission returns False → 403
        assert resp.status_code == 403

    def test_admin_can_add_manual_expert_and_created_by_defaults_to_request_user(
        self, species: Species, admin_user: User
    ) -> None:
        c = Client()
        c.force_login(admin_user)
        resp = c.post(
            "/admin/species/conservationassessment/add/",
            data={
                "species": species.pk,
                "category": "CR",
                "source": ConservationAssessment.Source.MANUAL_EXPERT,
                "review_status": ConservationAssessment.ReviewStatus.ACCEPTED,
                "assessor": "Dr. Loiselle",
                "assessment_date": "2026-03-01",
                "notes": "Field survey 2026 confirms population decline.",
                "criteria": "",
                "review_notes": "",
                "reason": "Override pending IUCN re-assessment.",
                "conflict_acknowledged_assessment_ids": "[]",
                "_save": "Save",
            },
        )
        assert resp.status_code in (302, 303), resp.content[:500]
        ca = ConservationAssessment.objects.get(species=species)
        assert ca.source == ConservationAssessment.Source.MANUAL_EXPERT
        assert ca.created_by_id == admin_user.pk
        assert ca.review_status == ConservationAssessment.ReviewStatus.ACCEPTED
