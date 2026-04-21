import pytest
from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from accounts.models import AuditLog, User
from populations.models import ExSituPopulation, Institution
from species.models import (
    ConservationAssessment,
    ProtectedArea,
    Species,
    SpeciesLocality,
    Taxon,
    Watershed,
    strip_svg_root_size_attrs,
)

# --- Fixtures ---


@pytest.fixture
def species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
    )


@pytest.fixture
def undescribed_species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia sp. 'manombo'",
        taxonomic_status="undescribed_morphospecies",
        provisional_name="'manombo'",
        authority=None,
        year_described=None,
        family="Bedotiidae",
        genus="Bedotia",
    )


@pytest.fixture
def institution(db: None) -> Institution:
    return Institution.objects.create(
        name="ABQ BioPark",
        institution_type="zoo",
        country="United States",
    )


@pytest.fixture
def simple_polygon() -> MultiPolygon:
    poly = Polygon(((46.0, -20.0), (48.0, -20.0), (48.0, -18.0), (46.0, -18.0), (46.0, -20.0)))
    return MultiPolygon(poly, srid=4326)


@pytest.fixture
def watershed(db: None, simple_polygon: MultiPolygon) -> Watershed:
    return Watershed.objects.create(
        hybas_id=1060000010,
        name="Nosivolo Basin",
        pfafstetter_level=6,
        pfafstetter_code=106000,
        geometry=simple_polygon,
    )


# --- Species tests ---


@pytest.mark.django_db
class TestSpecies:
    def test_undescribed_species_null_authority(self, undescribed_species: Species) -> None:
        """Undescribed species can have null authority and year_described."""
        assert undescribed_species.authority is None
        assert undescribed_species.year_described is None
        assert undescribed_species.taxonomic_status == "undescribed_morphospecies"

    def test_described_species_with_provisional_name(self, db: None) -> None:
        """Described species can optionally have a provisional_name."""
        sp = Species.objects.create(
            scientific_name="Ptychochromis grandidieri",
            taxonomic_status="described",
            provisional_name="test_prov",
            authority="Sauvage, 1882",
            year_described=1882,
            family="Cichlidae",
            genus="Ptychochromis",
        )
        assert sp.provisional_name == "test_prov"

    def test_iucn_taxon_id_unique(self, db: None) -> None:
        """iucn_taxon_id must be unique."""
        Species.objects.create(
            scientific_name="Species A",
            family="Bedotiidae",
            genus="Bedotia",
            iucn_taxon_id=12345,
        )
        with pytest.raises(IntegrityError):
            Species.objects.create(
                scientific_name="Species B",
                family="Bedotiidae",
                genus="Bedotia",
                iucn_taxon_id=12345,
            )

    def test_default_taxonomic_status(self, species: Species) -> None:
        assert species.taxonomic_status == "described"

    def test_default_endemic_status(self, species: Species) -> None:
        assert species.endemic_status == "endemic"


# --- Taxon tests ---


@pytest.mark.django_db
class TestTaxon:
    def test_mptt_hierarchy(self, db: None) -> None:
        family = Taxon.objects.create(rank="family", name="Bedotiidae")
        genus = Taxon.objects.create(rank="genus", name="Bedotia", parent=family)
        assert genus.parent == family
        assert genus in family.get_descendants()


# --- ConservationAssessment tests ---


@pytest.mark.django_db
class TestConservationAssessment:
    def test_pending_review_with_null_flagged(self, species: Species) -> None:
        """Assessment with pending_review can have null flagged_by and flagged_date."""
        ca = ConservationAssessment.objects.create(
            species=species,
            category="CR",
            source="iucn_official",
            review_status="pending_review",
            flagged_by=None,
            flagged_date=None,
        )
        assert ca.review_status == "pending_review"
        assert ca.flagged_by is None
        assert ca.flagged_date is None


# --- User tests ---


@pytest.mark.django_db
class TestUser:
    def test_access_tier_validation(self, db: None) -> None:
        """Access tier outside 1-5 raises validation error."""
        user = User(email="test@example.com", name="Test", access_tier=6)
        with pytest.raises(ValidationError):
            user.full_clean()

    def test_access_tier_below_min(self, db: None) -> None:
        user = User(email="test@example.com", name="Test", access_tier=0)
        with pytest.raises(ValidationError):
            user.full_clean()

    def test_valid_access_tier(self, db: None) -> None:
        user = User.objects.create_user(
            email="valid@example.com", password="testpass", name="Valid User"
        )
        assert user.access_tier == 2  # default

    def test_superuser_defaults(self, db: None) -> None:
        user = User.objects.create_superuser(
            email="admin@example.com", password="adminpass", name="Admin"
        )
        assert user.access_tier == 5
        assert user.is_staff is True
        assert user.is_active is True

    def test_access_tier_db_constraint(self, db: None) -> None:
        """DB-level CheckConstraint blocks invalid tier even without full_clean."""
        with pytest.raises(IntegrityError):
            User.objects.create(email="bad@example.com", name="Bad", access_tier=99)


# --- AuditLog tests ---


@pytest.mark.django_db
class TestAuditLog:
    def test_append_only(self, db: None) -> None:
        """AuditLog deletion is blocked by pre_delete signal."""
        log = AuditLog.objects.create(
            action="create",
            model_name="Species",
            object_id="1",
            changes={"scientific_name": [None, "Bedotia geayi"]},
        )
        with pytest.raises(RuntimeError, match="cannot be deleted"):
            log.delete()


# --- ExSituPopulation tests ---


@pytest.mark.django_db
class TestExSituPopulation:
    def test_unique_species_institution(self, species: Species, institution: Institution) -> None:
        """Same species + institution pair cannot be duplicated."""
        ExSituPopulation.objects.create(
            species=species, institution=institution, breeding_status="unknown"
        )
        with pytest.raises(IntegrityError):
            ExSituPopulation.objects.create(
                species=species, institution=institution, breeding_status="breeding"
            )


# --- SpeciesLocality tests ---


@pytest.mark.django_db
class TestSpeciesLocality:
    def test_point_field_stores_coordinates(self, species: Species) -> None:
        loc = SpeciesLocality.objects.create(
            species=species,
            locality_name="Antsirabe confluence",
            location=Point(47.52, -18.91, srid=4326),
            locality_type="observation",
            source_citation="Test citation",
        )
        loc.refresh_from_db()
        assert abs(loc.location.x - 47.52) < 0.001
        assert abs(loc.location.y - (-18.91)) < 0.001

    def test_unique_species_location_type(self, species: Species) -> None:
        """Same species + location + locality_type triggers unique constraint."""
        point = Point(47.52, -18.91, srid=4326)
        SpeciesLocality.objects.create(
            species=species,
            locality_name="Loc A",
            location=point,
            locality_type="observation",
            source_citation="Citation A",
        )
        with pytest.raises(IntegrityError):
            SpeciesLocality.objects.create(
                species=species,
                locality_name="Loc B",
                location=point,
                locality_type="observation",
                source_citation="Citation B",
            )

    def test_sensitive_location_generalized(self, species: Species) -> None:
        """Sensitive records auto-compute location_generalized rounded to 0.1 degree."""
        loc = SpeciesLocality.objects.create(
            species=species,
            locality_name="Sensitive site",
            location=Point(47.5234, -18.9156, srid=4326),
            locality_type="observation",
            source_citation="Test",
            is_sensitive=True,
        )
        assert loc.location_generalized is not None
        assert abs(loc.location_generalized.x - 47.5) < 0.001
        assert abs(loc.location_generalized.y - (-18.9)) < 0.001

    def test_non_sensitive_location_generalized_null(self, species: Species) -> None:
        """Non-sensitive records have null location_generalized."""
        loc = SpeciesLocality.objects.create(
            species=species,
            locality_name="Public site",
            location=Point(47.52, -18.91, srid=4326),
            locality_type="observation",
            source_citation="Test",
            is_sensitive=False,
        )
        assert loc.location_generalized is None

    def test_drainage_basin_name_auto_populated(
        self, species: Species, watershed: Watershed
    ) -> None:
        """drainage_basin_name auto-populates from FK on save."""
        loc = SpeciesLocality.objects.create(
            species=species,
            locality_name="River site",
            location=Point(47.0, -19.0, srid=4326),
            locality_type="collection_record",
            source_citation="Test",
            drainage_basin=watershed,
        )
        assert loc.drainage_basin_name == "Nosivolo Basin"

    def test_st_contains_spatial_query(
        self, species: Species, simple_polygon: MultiPolygon
    ) -> None:
        """Spatial query with ST_Contains finds point inside polygon."""
        SpeciesLocality.objects.create(
            species=species,
            locality_name="Inside polygon",
            location=Point(47.0, -19.0, srid=4326),
            locality_type="observation",
            source_citation="Test",
        )
        results = SpeciesLocality.objects.filter(location__within=simple_polygon)
        assert results.count() == 1


# --- Watershed tests ---


@pytest.mark.django_db
class TestWatershed:
    def test_hybas_id_unique(self, watershed: Watershed, simple_polygon: MultiPolygon) -> None:
        """Duplicate hybas_id raises unique constraint."""
        with pytest.raises(IntegrityError):
            Watershed.objects.create(
                hybas_id=1060000010,
                name="Duplicate",
                pfafstetter_level=6,
                pfafstetter_code=106001,
                geometry=simple_polygon,
            )

    def test_multipolygon_stores_correctly(self, watershed: Watershed) -> None:
        watershed.refresh_from_db()
        assert watershed.geometry.geom_type == "MultiPolygon"


# --- ProtectedArea tests ---


@pytest.mark.django_db
class TestProtectedArea:
    def test_wdpa_id_unique(self, db: None, simple_polygon: MultiPolygon) -> None:
        ProtectedArea.objects.create(
            wdpa_id=303847,
            name="Andasibe-Mantadia",
            designation="National Park",
            status="Designated",
            geometry=simple_polygon,
        )
        with pytest.raises(IntegrityError):
            ProtectedArea.objects.create(
                wdpa_id=303847,
                name="Duplicate",
                designation="Reserve",
                status="Proposed",
                geometry=simple_polygon,
            )


class TestSilhouetteSvgNormalization:
    def test_strips_width_and_height_from_root_svg(self) -> None:
        raw = '<svg width="200" height="80" viewBox="0 0 200 80"><path d="M0 0"/></svg>'
        assert strip_svg_root_size_attrs(raw) == (
            '<svg viewBox="0 0 200 80"><path d="M0 0"/></svg>'
        )

    def test_preserves_viewbox_and_other_attrs(self) -> None:
        raw = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" viewBox="0 0 100 40" '
            'height="120" fill="currentColor"><circle r="1"/></svg>'
        )
        out = strip_svg_root_size_attrs(raw)
        assert "width=" not in out.split(">", 1)[0]
        assert "height=" not in out.split(">", 1)[0]
        assert 'viewBox="0 0 100 40"' in out
        assert 'fill="currentColor"' in out
        assert '<circle r="1"/>' in out

    def test_does_not_touch_nested_elements(self) -> None:
        raw = '<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>'
        assert strip_svg_root_size_attrs(raw) == raw

    def test_handles_empty_string(self) -> None:
        assert strip_svg_root_size_attrs("") == ""

    def test_synthesizes_viewbox_when_missing(self) -> None:
        raw = '<svg width="1200" height="675"><g><path d="M6660 5391z"/></g></svg>'
        out = strip_svg_root_size_attrs(raw)
        assert 'viewBox="0 0 1200 675"' in out
        assert "width=" not in out.split(">", 1)[0]
        assert "height=" not in out.split(">", 1)[0]

    def test_synthesizes_viewbox_with_px_units(self) -> None:
        raw = '<svg width="1200px" height="675px"><path d="M0 0"/></svg>'
        out = strip_svg_root_size_attrs(raw)
        assert 'viewBox="0 0 1200 675"' in out

    def test_does_not_synthesize_viewbox_when_present(self) -> None:
        raw = '<svg width="500" height="200" viewBox="0 0 100 40"/>'
        out = strip_svg_root_size_attrs(raw)
        assert out.count("viewBox") == 1
        assert 'viewBox="0 0 100 40"' in out

    def test_save_normalizes_silhouette_svg(self, db: None) -> None:
        sp = Species.objects.create(
            scientific_name="Paretroplus test",
            family="Cichlidae",
            genus="Paretroplus",
            endemic_status="endemic",
            silhouette_svg='<svg width="500" height="200" viewBox="0 0 500 200"/>',
        )
        sp.refresh_from_db()
        assert "width=" not in sp.silhouette_svg.split(">", 1)[0]
        assert "height=" not in sp.silhouette_svg.split(">", 1)[0]
        assert 'viewBox="0 0 500 200"' in sp.silhouette_svg
