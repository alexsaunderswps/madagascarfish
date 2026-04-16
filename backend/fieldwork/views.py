from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from fieldwork.models import FieldProgram
from fieldwork.serializers import FieldProgramListSerializer


class FieldProgramViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = FieldProgramListSerializer
    ordering_fields = ["name", "status"]
    ordering = ["name"]

    def get_queryset(self):
        return FieldProgram.objects.select_related("lead_institution").prefetch_related(
            "focal_species", "partner_institutions"
        )
