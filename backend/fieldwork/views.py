from __future__ import annotations

import datetime

from django.db import transaction
from django.forms.models import model_to_dict
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.request import Request

from accounts.permissions import InstitutionScopedPermission
from audit.context import audit_actor
from audit.models import AuditEntry
from fieldwork.models import FieldProgram
from fieldwork.serializers import FieldProgramListSerializer, FieldProgramWriteSerializer
from populations.models import Institution


class _FieldProgramInstitutionScopedPermission(InstitutionScopedPermission()):  # type: ignore[misc]
    """FieldProgram is institution-scoped via `lead_institution_id`. Public
    reads stay open; the parent `InstitutionScopedPermission` is only
    consulted for writes (via `get_permissions`).
    """

    def has_object_permission(self, request: Request, view, obj: FieldProgram) -> bool:  # type: ignore[override]
        adapter = type(
            "_FPAdapter",
            (),
            {"institution_id": obj.lead_institution_id},
        )()
        return super().has_object_permission(request, view, adapter)


class FieldProgramViewSet(viewsets.ModelViewSet):
    """Field-program CRUD.

    Reads (`list`, `retrieve`) are public — field programs are a
    workshop / partner advertisement; anyone can browse them.

    Writes (`create`, `partial_update`) are institution-scoped: a
    Tier 2 staffer at the program's `lead_institution` can edit; a
    Tier 3+ coordinator can edit anywhere; everyone else is rejected.

    `lead_institution`, `focal_species`, and `partner_institutions` are
    NOT editable through this surface — they need coordinator-grade UI
    and would let a Tier 2 user re-attribute a program. The write
    serializer omits them; on `create`, `lead_institution` is set
    server-side to `request.user.institution`.
    """

    serializer_class = FieldProgramListSerializer
    ordering_fields = ["name", "status"]
    ordering = ["name"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    AUDITED_FIELDS: tuple[str, ...] = (
        "name",
        "description",
        "region",
        "status",
        "start_date",
        "end_date",
        "funding_sources",
        "website",
    )

    def get_queryset(self):
        return FieldProgram.objects.select_related("lead_institution").prefetch_related(
            "focal_species", "partner_institutions"
        )

    def get_permissions(self):  # type: ignore[no-untyped-def]
        # Reads stay public; writes flip to institution-scoped.
        if self.action in ("list", "retrieve", "metadata"):
            return [AllowAny()]
        return [_FieldProgramInstitutionScopedPermission()]

    def get_serializer_class(self):
        if self.action in ("create", "partial_update", "update"):
            return FieldProgramWriteSerializer
        return FieldProgramListSerializer

    def perform_create(self, serializer):
        """A Tier 2 staffer creates a program implicitly led by their
        institution. Tier 3+ defaults to their institution but can be
        passed any institution via a forthcoming admin path; for the
        MVP write surface we always set lead_institution to
        request.user.institution.
        """
        user = self.request.user
        institution_id = getattr(user, "institution_id", None)
        if institution_id is None:
            raise PermissionDenied(
                "An approved institution membership is required to create a field program."
            )
        institution = Institution.objects.get(pk=institution_id)
        with transaction.atomic():
            with audit_actor(user=user, reason="field program created"):
                instance: FieldProgram = serializer.save(lead_institution=institution)
            AuditEntry.objects.create(
                target_type="fieldwork.FieldProgram",
                target_id=instance.pk,
                actor_type=AuditEntry.ActorType.USER,
                actor_user=user,
                actor_institution_id=institution_id,
                action=AuditEntry.Action.CREATE,
                before={},
                after={
                    field: _json_safe(getattr(instance, field)) for field in self.AUDITED_FIELDS
                },
                reason="field program created",
            )
        return instance

    def perform_update(self, serializer):
        instance_before: FieldProgram = serializer.instance
        before = model_to_dict(instance_before, fields=self.AUDITED_FIELDS)
        user = self.request.user
        actor_institution_id = getattr(user, "institution_id", None)
        with transaction.atomic():
            with audit_actor(user=user, reason="field program updated"):
                instance = serializer.save()
            after = model_to_dict(instance, fields=self.AUDITED_FIELDS)
            changed_keys = [k for k in self.AUDITED_FIELDS if before[k] != after[k]]
            if not changed_keys:
                return instance
            AuditEntry.objects.create(
                target_type="fieldwork.FieldProgram",
                target_id=instance.pk,
                actor_type=AuditEntry.ActorType.USER,
                actor_user=user,
                actor_institution_id=actor_institution_id,
                action=AuditEntry.Action.UPDATE,
                before={k: _json_safe(before[k]) for k in changed_keys},
                after={k: _json_safe(after[k]) for k in changed_keys},
                reason="field program updated",
            )
        return instance


def _json_safe(value):  # type: ignore[no-untyped-def]
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return value
