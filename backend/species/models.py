from __future__ import annotations

import re

from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.db import models
from mptt.models import MPTTModel, TreeForeignKey

_SVG_ROOT_TAG_RE = re.compile(r"(<svg\b)([^>]*)(>)", re.IGNORECASE)
_SVG_SIZE_ATTR_RE = re.compile(r'\s+(?:width|height)\s*=\s*"[^"]*"', re.IGNORECASE)


def strip_svg_root_size_attrs(svg: str) -> str:
    """Remove width/height attributes from the root <svg> tag so the frontend
    can size it via CSS. Preserves viewBox and everything else verbatim."""
    if not svg:
        return svg

    def _scrub(match: re.Match[str]) -> str:
        return match.group(1) + _SVG_SIZE_ATTR_RE.sub("", match.group(2)) + match.group(3)

    return _SVG_ROOT_TAG_RE.sub(_scrub, svg, count=1)


class SpeciesQuerySet(models.QuerySet["Species"]):
    def for_tier(self, tier: int) -> SpeciesQuerySet:
        """Species are public at all tiers — no filtering."""
        return self.all()


class ConservationAssessmentQuerySet(models.QuerySet["ConservationAssessment"]):
    def for_tier(self, tier: int) -> ConservationAssessmentQuerySet:
        """Tier 1-2 sees accepted only; Tier 3+ sees all."""
        if tier >= 3:
            return self.all()
        return self.filter(review_status="accepted")


class Taxon(MPTTModel):
    class Rank(models.TextChoices):
        FAMILY = "family"
        GENUS = "genus"
        SPECIES = "species"
        SUBSPECIES = "subspecies"

    rank = models.CharField(max_length=20, choices=Rank.choices)
    name = models.CharField(max_length=200)
    parent = TreeForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )
    common_family_name = models.CharField(max_length=200, blank=True)

    class MPTTMeta:
        order_insertion_by = ["name"]

    class Meta:
        db_table = "species_taxon"
        verbose_name_plural = "taxa"

    def __str__(self) -> str:
        return f"{self.rank}: {self.name}"


class Species(models.Model):
    class TaxonomicStatus(models.TextChoices):
        DESCRIBED = "described"
        UNDESCRIBED_MORPHOSPECIES = "undescribed_morphospecies"
        SPECIES_COMPLEX = "species_complex"
        UNCERTAIN = "uncertain"

    class EndemicStatus(models.TextChoices):
        ENDEMIC = "endemic"
        NATIVE = "native"
        INTRODUCED = "introduced"

    class IUCNStatus(models.TextChoices):
        EX = "EX", "Extinct"
        EW = "EW", "Extinct in the Wild"
        CR = "CR", "Critically Endangered"
        EN = "EN", "Endangered"
        VU = "VU", "Vulnerable"
        NT = "NT", "Near Threatened"
        LC = "LC", "Least Concern"
        DD = "DD", "Data Deficient"
        NE = "NE", "Not Evaluated"

    class PopulationTrend(models.TextChoices):
        INCREASING = "increasing"
        STABLE = "stable"
        DECREASING = "decreasing"
        UNKNOWN = "unknown"

    class CARESStatus(models.TextChoices):
        CCR = "CCR", "CARES Critical"
        CEN = "CEN", "CARES Endangered"
        CVU = "CVU", "CARES Vulnerable"
        CLC = "CLC", "CARES Least Concern"

    objects = SpeciesQuerySet.as_manager()

    scientific_name = models.CharField(max_length=200)
    taxonomic_status = models.CharField(
        max_length=30, choices=TaxonomicStatus.choices, default=TaxonomicStatus.DESCRIBED
    )
    provisional_name = models.CharField(max_length=100, null=True, blank=True)
    authority = models.CharField(max_length=200, null=True, blank=True)
    year_described = models.IntegerField(null=True, blank=True)
    # Authoritative classification fields. Taxon FK is supplemental for hierarchy navigation.
    family = models.CharField(max_length=100)
    genus = models.CharField(max_length=100)
    taxon = models.ForeignKey(
        Taxon, on_delete=models.SET_NULL, null=True, blank=True, related_name="species"
    )
    endemic_status = models.CharField(
        max_length=20, choices=EndemicStatus.choices, default=EndemicStatus.ENDEMIC
    )
    iucn_status = models.CharField(max_length=5, choices=IUCNStatus.choices, null=True, blank=True)
    population_trend = models.CharField(
        max_length=20, choices=PopulationTrend.choices, null=True, blank=True
    )
    cares_status = models.CharField(
        max_length=5, choices=CARESStatus.choices, null=True, blank=True
    )
    shoal_priority = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    ecology_notes = models.TextField(blank=True)
    distribution_narrative = models.TextField(blank=True)
    morphology = models.TextField(blank=True)
    max_length_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    silhouette_svg = models.TextField(
        blank=True,
        help_text=(
            "Optional inline SVG markup for a species-specific silhouette shown "
            "on the public profile when no photograph is available. Paste the "
            "full <svg>…</svg> element. Authoring conventions: include a "
            "<code>viewBox</code> attribute (e.g. <code>viewBox=\"0 0 200 80\"</code>), "
            "use <code>fill=\"currentColor\"</code> on paths so the figure inherits "
            "theme color, and omit <code>width</code>/<code>height</code> on the "
            "root &lt;svg&gt; — they are stripped on save so CSS can size the "
            "figure (renders ~300px wide on the public profile). Tier-5 only."
        ),
    )
    habitat_type = models.CharField(max_length=100, blank=True)
    iucn_taxon_id = models.IntegerField(null=True, blank=True, unique=True)
    fishbase_id = models.IntegerField(null=True, blank=True)
    gbif_taxon_key = models.IntegerField(null=True, blank=True)
    in_captivity = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "species_species"
        verbose_name_plural = "species"

    def save(self, *args: object, **kwargs: object) -> None:
        if self.silhouette_svg:
            self.silhouette_svg = strip_svg_root_size_attrs(self.silhouette_svg)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.scientific_name


class CommonName(models.Model):
    species = models.ForeignKey(Species, on_delete=models.CASCADE, related_name="common_names")
    name = models.CharField(max_length=200)
    language = models.CharField(max_length=10, help_text="ISO 639-1 code: en, fr, mg")
    is_preferred = models.BooleanField(default=False)

    class Meta:
        db_table = "species_commonname"

    def __str__(self) -> str:
        return f"{self.name} ({self.language})"


class ConservationAssessment(models.Model):
    class Source(models.TextChoices):
        IUCN_OFFICIAL = "iucn_official"
        RECOMMENDED_REVISION = "recommended_revision"
        MANUAL_EXPERT = "manual_expert"

    class ReviewStatus(models.TextChoices):
        ACCEPTED = "accepted"
        PENDING_REVIEW = "pending_review"
        UNDER_REVISION = "under_revision"
        SUPERSEDED = "superseded"

    objects = ConservationAssessmentQuerySet.as_manager()

    species = models.ForeignKey(
        Species, on_delete=models.CASCADE, related_name="conservation_assessments"
    )
    category = models.CharField(max_length=5, choices=Species.IUCNStatus.choices)
    criteria = models.CharField(max_length=100, blank=True)
    assessor = models.CharField(max_length=200, blank=True)
    assessment_date = models.DateField(null=True, blank=True)
    source = models.CharField(max_length=30, choices=Source.choices)
    notes = models.TextField(blank=True)
    review_status = models.CharField(
        max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.ACCEPTED
    )
    review_notes = models.TextField(null=True, blank=True)
    flagged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="flagged_assessments",
    )
    flagged_date = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authored_assessments",
    )
    # IUCN assessment_ids that a manual_expert row has been deliberately reviewed
    # against and retained. Written only by the conflict-resolution side effect;
    # admin renders this read-only.
    conflict_acknowledged_assessment_ids = models.JSONField(default=list, blank=True)
    last_sync_job = models.ForeignKey(
        "integration.SyncJob",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments",
    )
    # Stable IUCN identity for iucn_official rows; NULL on manual_expert. Lets
    # the sync detect "same assessment re-seen" vs "new upstream publication"
    # without relying on mutable fields like category or criteria.
    iucn_assessment_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    iucn_year_published = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "species_conservationassessment"
        constraints = [
            models.UniqueConstraint(
                fields=["iucn_assessment_id"],
                condition=models.Q(iucn_assessment_id__isnull=False),
                name="unique_iucn_assessment_id_when_set",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.species} — {self.category}"


class ConservationStatusConflict(models.Model):
    """Raised when an incoming IUCN assessment disagrees with an accepted
    manual_expert override. Created by iucn_sync; resolved in admin.

    See docs/planning/business-analysis/conservation-status-governance.md §3
    Req 4 for the resolution-outcome table.
    """

    class Status(models.TextChoices):
        OPEN = "open"
        RESOLVED = "resolved"

    class Resolution(models.TextChoices):
        ACCEPTED_IUCN = "accepted_iucn"
        RETAINED_MANUAL = "retained_manual"
        RECONCILED = "reconciled"
        DISMISSED = "dismissed"

    species = models.ForeignKey(Species, on_delete=models.CASCADE, related_name="conflicts")
    manual_assessment = models.ForeignKey(
        ConservationAssessment, on_delete=models.PROTECT, related_name="manual_conflicts"
    )
    iucn_assessment = models.ForeignKey(
        ConservationAssessment,
        on_delete=models.PROTECT,
        related_name="iucn_conflicts",
        null=True,
        blank=True,
    )
    detected_at = models.DateTimeField(auto_now_add=True)
    detected_by_sync_job = models.ForeignKey(
        "integration.SyncJob",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conflicts_detected",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    resolution = models.CharField(max_length=20, choices=Resolution.choices, null=True, blank=True)
    resolution_reason = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_conflicts",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "species_conservationstatusconflict"
        constraints = [
            models.UniqueConstraint(
                fields=["species", "manual_assessment", "iucn_assessment"],
                name="unique_conflict_per_assessment_pair",
            ),
        ]
        indexes = [models.Index(fields=["status", "detected_at"])]

    def __str__(self) -> str:
        return f"Conflict: {self.species} [{self.status}]"


class Watershed(models.Model):
    hybas_id = models.BigIntegerField(unique=True)
    name = models.CharField(max_length=200)
    pfafstetter_level = models.IntegerField()
    pfafstetter_code = models.BigIntegerField()
    parent_basin = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="sub_basins"
    )
    area_sq_km = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    geometry = gis_models.MultiPolygonField(srid=4326)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "species_watershed"

    def __str__(self) -> str:
        return self.name


class ProtectedArea(models.Model):
    wdpa_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=300)
    designation = models.CharField(max_length=200)
    iucn_category = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=100)
    status_year = models.IntegerField(null=True, blank=True)
    area_km2 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    geometry = gis_models.MultiPolygonField(srid=4326)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "species_protectedarea"

    def __str__(self) -> str:
        return self.name


class SpeciesLocality(models.Model):
    class WaterBodyType(models.TextChoices):
        RIVER = "river"
        LAKE = "lake"
        STREAM = "stream"
        CAVE_SYSTEM = "cave_system"
        WETLAND = "wetland"
        ESTUARY = "estuary"

    class LocalityType(models.TextChoices):
        TYPE_LOCALITY = "type_locality"
        COLLECTION_RECORD = "collection_record"
        LITERATURE_RECORD = "literature_record"
        OBSERVATION = "observation"

    class PresenceStatus(models.TextChoices):
        PRESENT = "present"
        HISTORICALLY_PRESENT_EXTIRPATED = "historically_present_extirpated"
        PRESENCE_UNKNOWN = "presence_unknown"
        REINTRODUCED = "reintroduced"

    class CoordinatePrecision(models.TextChoices):
        EXACT = "exact"
        APPROXIMATE = "approximate"
        LOCALITY_CENTROID = "locality_centroid"
        WATER_BODY_CENTROID = "water_body_centroid"

    species = models.ForeignKey(
        Species, on_delete=models.CASCADE, related_name="localities", db_index=True
    )
    locality_name = models.CharField(max_length=300)
    location = gis_models.PointField(srid=4326)
    location_generalized = gis_models.PointField(srid=4326, null=True, blank=True)
    water_body = models.CharField(max_length=200, blank=True)
    water_body_type = models.CharField(max_length=20, choices=WaterBodyType.choices, blank=True)
    drainage_basin = models.ForeignKey(
        Watershed,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="localities",
    )
    drainage_basin_name = models.CharField(max_length=200, blank=True)
    locality_type = models.CharField(max_length=30, choices=LocalityType.choices)
    presence_status = models.CharField(
        max_length=40, choices=PresenceStatus.choices, default=PresenceStatus.PRESENT
    )
    source_citation = models.TextField()
    year_collected = models.IntegerField(null=True, blank=True)
    collector = models.CharField(max_length=200, blank=True)
    coordinate_precision = models.CharField(
        max_length=25, choices=CoordinatePrecision.choices, default=CoordinatePrecision.EXACT
    )
    is_sensitive = models.BooleanField(default=False)
    # needs_review quarantines a record from the public map without deleting it.
    # Flip when a source-data error is suspected (e.g. coordinates place the
    # point in open ocean, species misidentified, date wildly out of range).
    # The public map API excludes needs_review=True; admin surfaces a
    # "Needs review" queue for manual re-verification against the upstream
    # source institution. See docs/planning/business-analysis/
    # map-ux-decisions-2026-04-18.md §6.
    needs_review = models.BooleanField(default=False, db_index=True)
    review_notes = models.TextField(
        blank=True,
        help_text=(
            "Why this record is flagged (e.g. 'coordinates place point in open "
            "ocean; source GBIF record pending re-verification'). Shown only "
            "in admin."
        ),
    )
    # Deterministic key for uniqueness — geometry equality is unreliable in PostgreSQL
    location_key = models.CharField(max_length=50, editable=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "species_specieslocality"
        verbose_name_plural = "species localities"
        constraints = [
            models.UniqueConstraint(
                fields=["species", "location_key", "locality_type"],
                name="unique_species_location_type",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.species} — {self.locality_name}"

    def save(self, *args: object, **kwargs: object) -> None:
        # Deterministic coordinate key for unique constraint
        if self.location:
            self.location_key = f"{self.location.x:.5f},{self.location.y:.5f}"

        # Auto-compute generalized coordinates for sensitive records
        if self.is_sensitive and self.location:
            self.location_generalized = Point(
                round(self.location.x, 1),
                round(self.location.y, 1),
                srid=4326,
            )
        else:
            self.location_generalized = None

        # Denormalized cache — always sync from FK on save
        if self.drainage_basin:
            self.drainage_basin_name = self.drainage_basin.name

        super().save(*args, **kwargs)
