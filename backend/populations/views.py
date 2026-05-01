from __future__ import annotations

import datetime

from django.db import transaction
from django.forms.models import model_to_dict
from django.utils import timezone
from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from accounts.permissions import InstitutionScopedPermission
from audit.context import audit_actor
from audit.models import AuditEntry
from populations.models import ExSituPopulation, Institution
from populations.serializers import (
    ExSituPopulationDetailSerializer,
    ExSituPopulationListSerializer,
    ExSituPopulationWriteSerializer,
    InstitutionDetailSerializer,
    InstitutionListSerializer,
)


class InstitutionFilter(filters.FilterSet):
    institution_type = filters.CharFilter(field_name="institution_type")
    country = filters.CharFilter(field_name="country")

    class Meta:
        model = Institution
        fields = ["institution_type", "country"]


class InstitutionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    queryset = Institution.objects.all()
    filterset_class = InstitutionFilter
    search_fields = ["name", "city"]
    ordering = ["name"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return InstitutionDetailSerializer
        return InstitutionListSerializer


class ExSituPopulationFilter(filters.FilterSet):
    species_id = filters.NumberFilter(field_name="species_id")
    institution_id = filters.NumberFilter(field_name="institution_id")
    breeding_status = filters.CharFilter(field_name="breeding_status")

    class Meta:
        model = ExSituPopulation
        fields = ["species_id", "institution_id", "breeding_status"]


class ExSituPopulationViewSet(viewsets.ModelViewSet):
    """Population edits — institution-scoped for Tier 2, unscoped for Tier 3+.

    Per Gate 13: Tier 2 institution staff can read and PATCH populations
    owned by their own institution. Tier 3+ coordinators see and edit
    everything (coordinator override). Anyone below Tier 2 is rejected.

    Write fields are restricted to the eight AUDITED_FIELDS by the write
    serializer; every PATCH writes one ``AuditEntry`` row with a
    multi-field-JSON before/after payload, plus an atomic update of the
    denormalized ``last_edited_*`` columns.
    """

    permission_classes = [InstitutionScopedPermission()]
    filterset_class = ExSituPopulationFilter
    ordering = ["-last_census_date"]
    http_method_names = ["get", "patch", "head", "options"]

    AUDITED_FIELDS: tuple[str, ...] = (
        "count_total",
        "count_male",
        "count_female",
        "count_unsexed",
        "breeding_status",
        "last_census_date",
        "notes",
        "studbook_managed",
    )

    def get_queryset(self):
        user = self.request.user
        qs = ExSituPopulation.objects.select_related("species", "institution").prefetch_related(
            "holding_records"
        )
        if not user.is_authenticated:
            return qs.none()
        tier = getattr(user, "access_tier", 0)
        if tier >= 3:
            return qs
        # Tier 2 with approved institution — scope to their institution only.
        institution_id = getattr(user, "institution_id", None)
        if institution_id is None:
            return qs.none()
        return qs.filter(institution_id=institution_id)

    def get_serializer_class(self):
        if self.action == "partial_update":
            return ExSituPopulationWriteSerializer
        if self.action == "retrieve":
            return ExSituPopulationDetailSerializer
        return ExSituPopulationListSerializer

    def perform_update(self, serializer):
        """Single-transaction PATCH: write the row, write one AuditEntry,
        bump the denormalized last-edited columns. Per Gate 13 architecture
        D2 / D5 / D9.
        """
        instance_before = serializer.instance
        before = model_to_dict(instance_before, fields=self.AUDITED_FIELDS)
        reason = self.request.data.get("_reason", "") or ""
        # Cap reason at 1KB at this layer (defense alongside any serializer max).
        if len(reason) > 1024:
            reason = reason[:1024]

        user = self.request.user
        actor_institution_id = getattr(user, "institution_id", None)

        with transaction.atomic():
            with audit_actor(user=user, reason=reason):
                instance = serializer.save()
            after = model_to_dict(instance, fields=self.AUDITED_FIELDS)
            changed_keys = [k for k in self.AUDITED_FIELDS if before[k] != after[k]]
            if not changed_keys:
                return instance
            AuditEntry.objects.create(
                target_type="populations.ExSituPopulation",
                target_id=instance.pk,
                actor_type=AuditEntry.ActorType.USER,
                actor_user=user,
                actor_institution_id=actor_institution_id,
                action=AuditEntry.Action.UPDATE,
                before={k: _json_safe(before[k]) for k in changed_keys},
                after={k: _json_safe(after[k]) for k in changed_keys},
                reason=reason,
            )
            now = timezone.now()
            ExSituPopulation.objects.filter(pk=instance.pk).update(
                last_edited_at=now,
                last_edited_by_user_id=user.pk,
                last_edited_by_institution_id=actor_institution_id,
            )
            # Refresh instance so the response carries the bumped columns.
            instance.refresh_from_db(
                fields=("last_edited_at", "last_edited_by_user_id", "last_edited_by_institution_id")
            )
        return instance


def _json_safe(value):
    """Coerce date/datetime to ISO strings for JSONField serialization.

    Django's JSONField (with DjangoJSONEncoder) handles dates, but the
    default encoder doesn't. Coerce explicitly to keep the payload
    portable across encoder configurations.
    """
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return value
