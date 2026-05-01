from django.conf import settings
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

# Locale choices for User.locale. Mirrors LANGUAGES in settings/base.py;
# kept here to avoid an import cycle (settings imports accounts indirectly
# through INSTALLED_APPS at startup).
USER_LOCALE_CHOICES = [
    ("en", "English"),
    ("fr", "Français"),
    ("de", "Deutsch"),
    ("es", "Español"),
]


class UserManager(BaseUserManager["User"]):
    def create_user(
        self,
        email: str,
        password: str | None = None,
        **extra_fields: object,
    ) -> "User":
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(
        self,
        email: str,
        password: str | None = None,
        **extra_fields: object,
    ) -> "User":
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("access_tier", 5)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=300)
    access_tier = models.IntegerField(
        default=2,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text=_("1=Public, 2=Researcher, 3=Coordinator, 4=Program Manager, 5=Admin"),
    )
    institution = models.ForeignKey(
        "populations.Institution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    expertise_areas = models.TextField(blank=True)
    orcid_id = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(
        default=False, help_text=_("Inactive until manually activated or email-verified.")
    )
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    locale = models.CharField(
        max_length=5,
        choices=USER_LOCALE_CHOICES,
        default="en",
        help_text=_(
            "Preferred locale for transactional emails and (when logged in) the "
            "default UI locale on first visit. User-changeable from the account "
            "page."
        ),
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "accounts_user"
        ordering = ["email"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(access_tier__gte=1) & models.Q(access_tier__lte=5),
                name="valid_access_tier_range",
            ),
        ]

    def __str__(self) -> str:
        return self.email


class PendingInstitutionClaim(models.Model):
    """Coordinator-moderated queue of institution-membership claims.

    A signup with `institution_id` lands as a row here with `status=PENDING`,
    not as a direct `User.institution` write. A coordinator (Tier 3+) reviews
    in Django admin and approves or rejects. Approval flips
    `User.institution` atomically; rejection leaves it NULL.

    History is preserved across re-claims and rejections — see Gate 13
    architecture §3.2.
    """

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")
        WITHDRAWN = "withdrawn", _("Withdrawn")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="institution_claims",
    )
    institution = models.ForeignKey(
        "populations.Institution",
        on_delete=models.CASCADE,
        related_name="pending_claims",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="institution_claims_reviewed",
    )
    requester_notes = models.TextField(
        blank=True,
        default="",
        max_length=4000,
        help_text="Optional context the user provided when submitting the claim.",
    )
    review_notes = models.TextField(
        blank=True,
        default="",
        max_length=4000,
        help_text="Coordinator's note. Used as the rejection reason in the email.",
    )

    class Meta:
        db_table = "accounts_pendinginstitutionclaim"
        ordering = ["-requested_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "institution"],
                condition=models.Q(status="pending"),
                name="one_pending_claim_per_user_institution",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} -> {self.institution.name} ({self.status})"


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=50)
    timestamp = models.DateTimeField(auto_now_add=True)
    changes = models.JSONField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "accounts_auditlog"
        ordering = ["-timestamp"]

    def __str__(self) -> str:
        return f"{self.action} {self.model_name}#{self.object_id}"
