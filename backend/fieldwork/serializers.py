from __future__ import annotations

from rest_framework import serializers

from fieldwork.models import FieldProgram


class _InstitutionBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    country = serializers.CharField()


class _SpeciesBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    scientific_name = serializers.CharField()
    iucn_status = serializers.CharField()


class FieldProgramListSerializer(serializers.ModelSerializer):
    lead_institution = _InstitutionBriefSerializer(read_only=True)
    focal_species = _SpeciesBriefSerializer(many=True, read_only=True)
    partner_institutions = serializers.SerializerMethodField()

    class Meta:
        model = FieldProgram
        fields = [
            "id",
            "name",
            "description",
            "lead_institution",
            "region",
            "status",
            "start_date",
            "focal_species",
            "partner_institutions",
        ]

    def get_partner_institutions(self, obj: FieldProgram) -> list[dict]:
        return list(obj.partner_institutions.values("id", "name", "country"))
