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
            "end_date",
            "funding_sources",
            "website",
            "focal_species",
            "partner_institutions",
        ]

    def get_partner_institutions(self, obj: FieldProgram) -> list[dict]:
        return list(obj.partner_institutions.values("id", "name", "country"))


class FieldProgramWriteSerializer(serializers.ModelSerializer):
    """Tier-2-institution-scoped field-program edit surface.

    Editable fields are operational metadata; the M2M relations
    (`focal_species`, `partner_institutions`) and the structural FK
    (`lead_institution`) are NOT editable here — they need a coordinator-
    grade UI and live on the read serializer for visibility only.
    `name` stays editable (renames happen) but cannot be wiped to blank.
    """

    description = serializers.CharField(max_length=10_000, allow_blank=True, required=False)
    funding_sources = serializers.CharField(max_length=10_000, allow_blank=True, required=False)

    class Meta:
        model = FieldProgram
        fields = [
            "name",
            "description",
            "region",
            "status",
            "start_date",
            "end_date",
            "funding_sources",
            "website",
        ]
