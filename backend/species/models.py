from __future__ import annotations

from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.db import models
from mptt.models import MPTTModel, TreeForeignKey


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
