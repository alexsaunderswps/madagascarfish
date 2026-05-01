from django.contrib.auth import password_validation
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from accounts.models import PendingInstitutionClaim, User


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    name = serializers.CharField(max_length=300)
    password = serializers.CharField(write_only=True, max_length=512)
    institution_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_email(self, value: str) -> str:
        email = value.lower().strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(_("An account with this email already exists."))
        return email

    def validate_password(self, value: str) -> str:
        password_validation.validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=512)

    def validate_email(self, value: str) -> str:
        return value.lower().strip()


class UserProfileSerializer(serializers.ModelSerializer):
    institution_membership = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "access_tier",
            "institution",
            "institution_membership",
            "is_active",
            "date_joined",
            "locale",
        ]
        read_only_fields = [
            "id",
            "email",
            "access_tier",
            "institution",
            "institution_membership",
            "is_active",
            "date_joined",
        ]

    def get_institution_membership(self, obj: User) -> dict:
        """Return the institution-claim membership block per Gate 13 §6.1.

        Five terminal `claim_status` values: `none`, `pending`, `approved`,
        `rejected`, `withdrawn`. `institution_id` is gated on `approved`
        — frontend only sees an id once the claim is genuinely approved.
        `institution_name` is included for `pending` / `rejected` so the
        frontend can render context without a second round trip.
        """
        # Edge case: legacy user with institution set directly, no claim row.
        # The migration backfill creates synthetic APPROVED claims for these
        # cases, but defend against the gap explicitly.
        if obj.institution_id and not obj.institution_claims.exists():
            institution = obj.institution
            return {
                "institution_id": obj.institution_id,
                "institution_name": institution.name if institution else None,
                "claim_status": "approved",
                "claim_id": None,
                "claim_requested_at": None,
                "claim_reviewed_at": None,
                "rejection_reason": None,
            }

        most_recent = (
            obj.institution_claims.order_by("-requested_at").select_related("institution").first()
        )
        if most_recent is None:
            return {
                "institution_id": None,
                "institution_name": None,
                "claim_status": "none",
                "claim_id": None,
                "claim_requested_at": None,
                "claim_reviewed_at": None,
                "rejection_reason": None,
            }

        is_approved = most_recent.status == PendingInstitutionClaim.Status.APPROVED
        is_rejected = most_recent.status == PendingInstitutionClaim.Status.REJECTED
        return {
            "institution_id": most_recent.institution_id if is_approved else None,
            "institution_name": most_recent.institution.name,
            "claim_status": most_recent.status,
            "claim_id": most_recent.id,
            "claim_requested_at": (
                most_recent.requested_at.isoformat() if most_recent.requested_at else None
            ),
            "claim_reviewed_at": (
                most_recent.reviewed_at.isoformat() if most_recent.reviewed_at else None
            ),
            "rejection_reason": most_recent.review_notes if is_rejected else None,
        }


class UserLocaleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["locale"]
