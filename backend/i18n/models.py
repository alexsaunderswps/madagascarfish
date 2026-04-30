"""
Translation pipeline state.

Tracks the review status of each translatable field per locale per
object. Lives separately from the content models (`species.Species`,
`species.Taxon`, future translatable models) so any model can opt in
without schema changes on the model itself — the relationship is via
`ContentType` + `object_id`, the standard Django generic-FK shape.

In Gate L1 this model is admin-readable only. The side-by-side review
screen, MT-pipeline writes, and signal handlers are L3 work per
architect doc §5 / B1 deferral.

Public-site rendering rule: only `human_approved` or `published`
content is shown in the requested locale (gated by
`I18N_ENFORCE_REVIEW_GATE`, False in L1, True in L3). Anything below
that falls back to English.
"""

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils.translation import gettext_lazy as _


class TranslationStatus(models.Model):
    """Per-(model, instance, field, locale) review state for the
    translation pipeline. One row per translatable column per non-default
    locale. English (the default) is the source of truth and does not
    carry a `TranslationStatus` row — it is always `human_approved` by
    construction."""

    class Status(models.TextChoices):
        MT_DRAFT = "mt_draft", "Machine-translated draft"
        WRITER_REVIEWED = "writer_reviewed", "Writer-reviewed (voice/idiom checked)"
        HUMAN_APPROVED = "human_approved", "Human-approved (publishable)"
        PUBLISHED = "published", "Published (live on site)"

    # Generic-FK target. Lets any model with translatable fields register.
    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, related_name="translation_statuses"
    )
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    field = models.CharField(
        max_length=100,
        help_text=(
            "Name of the translatable field on the target model "
            "(e.g., 'description', 'common_family_name'). "
            "Modeltranslation will store the locale-suffixed value at "
            "<field>_<locale> on that model."
        ),
    )
    locale = models.CharField(
        max_length=10,
        help_text=(
            "Target locale code (e.g., 'fr', 'de', 'es'). "
            "English (the default source) does not carry rows here."
        ),
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.MT_DRAFT,
    )

    mt_provider = models.CharField(
        max_length=50,
        blank=True,
        default="deepl",
        help_text=_("Provider that produced the original draft (e.g., 'deepl', 'manual')."),
    )
    mt_translated_at = models.DateTimeField(null=True, blank=True)
    writer_reviewed_at = models.DateTimeField(null=True, blank=True)
    human_approved_at = models.DateTimeField(null=True, blank=True)
    human_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="i18n_approvals",
    )

    notes = models.TextField(
        blank=True,
        help_text=(
            "Reviewer notes — locked-term substitutions made by the "
            "writer-agent, voice-register changes, regional usage flags "
            "for the human reviewer's attention."
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "i18n_translation_status"
        verbose_name_plural = "translation statuses"
        constraints = [
            models.UniqueConstraint(
                fields=["content_type", "object_id", "field", "locale"],
                name="i18n_translationstatus_unique_target",
            ),
        ]
        indexes = [
            # Architect doc §5. Composite index for "all rows for this
            # object across all fields/locales" — used by admin detail
            # views and by the L3 side-by-side review screen.
            models.Index(
                fields=["content_type", "object_id"],
                name="i18n_ts_object_idx",
            ),
            # Covering index for the L3 admin filter UI: "show me all
            # mt_draft rows for French" (or "writer_reviewed" for
            # German, etc.).
            models.Index(
                fields=["locale", "status"],
                name="i18n_ts_locale_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.content_type.model}#{self.object_id}.{self.field} [{self.locale}={self.status}]"
        )
