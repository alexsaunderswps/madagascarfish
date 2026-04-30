from django.contrib.auth import password_validation
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from accounts.models import User


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
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "access_tier",
            "institution",
            "is_active",
            "date_joined",
            "locale",
        ]
        read_only_fields = [
            "id",
            "email",
            "access_tier",
            "institution",
            "is_active",
            "date_joined",
        ]


class UserLocaleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["locale"]
