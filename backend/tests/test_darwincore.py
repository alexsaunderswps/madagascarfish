"""Tests for Gate 15 — Darwin Core Archive export.

Covers:

- Coordinate generalization for IUCN-threatened species (uses
  ``location_generalized``; sets ``coordinateUncertaintyInMeters=11000``;
  populates ``dataGeneralizations`` and ``informationWithheld``).
- Non-sensitive records publish exact coordinates with uncertainty
  derived from ``coordinate_precision``.
- ``needs_review=True`` records are excluded entirely.
- Public, no-auth: anonymous can fetch the archive (Tier 1).
- Output format: ``occurrence.txt`` is valid TSV; ``eml.xml`` and
  ``meta.xml`` are well-formed; ZIP contains all three.
- ``occurrenceID`` is stable and globally unique.
"""

from __future__ import annotations

import io
import xml.etree.ElementTree as ET
import zipfile

import pytest
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient

from integration.darwincore import (
    DWC_COLUMNS,
    GENERALIZED_UNCERTAINTY_M,
    build_archive_bytes,
    locality_to_dwc_row,
    render_meta_xml,
    render_occurrence_tsv,
)
from species.models import Species, SpeciesLocality


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def vu_species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Paretroplus menarambo",
        taxonomic_status="described",
        family="Cichlidae",
        genus="Paretroplus",
        endemic_status="endemic",
        iucn_status="VU",
    )


@pytest.fixture
def lc_species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        taxonomic_status="described",
        family="Bedotiidae",
        genus="Bedotia",
        endemic_status="endemic",
        iucn_status="LC",
    )


def _make_locality(
    species: Species,
    *,
    lat: float = -18.5,
    lng: float = 47.0,
    is_sensitive: bool = False,
    needs_review: bool = False,
    locality_name: str = "Test Locality",
    year: int | None = 2024,
    collector: str = "Test Collector",
    coord_precision: str = "exact",
    citation: str = "Test 2024",
    locality_type: str = "observation",
    presence_status: str = "present",
) -> SpeciesLocality:
    return SpeciesLocality.objects.create(
        species=species,
        locality_name=locality_name,
        location=Point(lng, lat, srid=4326),
        is_sensitive=is_sensitive,
        needs_review=needs_review,
        year_collected=year,
        collector=collector,
        coordinate_precision=coord_precision,
        source_citation=citation,
        locality_type=locality_type,
        presence_status=presence_status,
    )


@pytest.mark.django_db
class TestRowMapping:
    def test_sensitive_species_uses_generalized_location(self, vu_species: Species) -> None:
        locality = _make_locality(vu_species, lat=-18.123, lng=47.456)
        row = locality_to_dwc_row(locality)
        # 0.1° grid: 47.456 → 47.5 (rounding band depends on save() impl —
        # just assert it's NOT the exact value, and uncertainty is generalized).
        assert row["coordinateUncertaintyInMeters"] == str(GENERALIZED_UNCERTAINTY_M)
        assert row["dataGeneralizations"]
        assert row["informationWithheld"]
        # Generalized coords should differ from exact at the 5th decimal.
        assert row["decimalLatitude"] != "-18.12300"

    def test_non_sensitive_species_uses_exact_location(self, lc_species: Species) -> None:
        locality = _make_locality(lc_species, lat=-18.123, lng=47.456)
        row = locality_to_dwc_row(locality)
        assert row["decimalLatitude"] == "-18.12300"
        assert row["decimalLongitude"] == "47.45600"
        assert row["coordinateUncertaintyInMeters"] == "100"  # exact precision
        assert row["dataGeneralizations"] == ""
        assert row["informationWithheld"] == ""

    def test_per_record_is_sensitive_overrides_lc_species(self, lc_species: Species) -> None:
        # Even on an LC species, is_sensitive=True forces generalization.
        locality = _make_locality(lc_species, is_sensitive=True)
        row = locality_to_dwc_row(locality)
        assert row["coordinateUncertaintyInMeters"] == str(GENERALIZED_UNCERTAINTY_M)
        assert row["dataGeneralizations"]

    def test_country_is_madagascar(self, lc_species: Species) -> None:
        row = locality_to_dwc_row(_make_locality(lc_species))
        assert row["country"] == "Madagascar"
        assert row["countryCode"] == "MG"

    def test_taxonomy_fields_populated(self, lc_species: Species) -> None:
        row = locality_to_dwc_row(_make_locality(lc_species))
        assert row["scientificName"] == "Bedotia geayi"
        assert row["family"] == "Bedotiidae"
        assert row["genus"] == "Bedotia"
        assert row["specificEpithet"] == "geayi"
        assert row["taxonRank"] == "species"
        assert row["kingdom"] == "Animalia"
        assert row["class"] == "Actinopterygii"

    def test_iucn_category_passed_through(self, vu_species: Species) -> None:
        row = locality_to_dwc_row(_make_locality(vu_species))
        assert row["iucnRedListCategory"] == "VU"

    def test_event_date_from_year(self, lc_species: Species) -> None:
        row = locality_to_dwc_row(_make_locality(lc_species, year=1998))
        assert row["year"] == "1998"
        assert row["eventDate"] == "1998"

    def test_extirpated_records_publish_as_absent(self, lc_species: Species) -> None:
        locality = _make_locality(lc_species, presence_status="historically_present_extirpated")
        row = locality_to_dwc_row(locality)
        assert row["occurrenceStatus"] == "absent"

    def test_occurrence_id_is_stable_and_prefixed(self, lc_species: Species) -> None:
        locality = _make_locality(lc_species)
        row = locality_to_dwc_row(locality)
        assert row["occurrenceID"] == f"mffcp:locality:{locality.pk}"


@pytest.mark.django_db
class TestTSVRendering:
    def test_header_matches_dwc_columns(self, lc_species: Species) -> None:
        rows = [locality_to_dwc_row(_make_locality(lc_species))]
        tsv = render_occurrence_tsv(rows)
        header = tsv.splitlines()[0].split("\t")
        assert tuple(header) == DWC_COLUMNS

    def test_tab_in_value_replaced_with_space(self, lc_species: Species) -> None:
        # Construct a locality whose locality_name contains a tab — make
        # sure the row stays parseable.
        loc = _make_locality(lc_species, locality_name="evil\tname")
        rows = [locality_to_dwc_row(loc)]
        tsv = render_occurrence_tsv(rows)
        # Header + one data row = 2 lines (plus trailing newline).
        lines = tsv.strip().split("\n")
        assert len(lines) == 2
        assert "evil name" in lines[1]
        assert "evil\tname" not in lines[1]

    def test_newline_in_notes_replaced(self, lc_species: Species) -> None:
        loc = _make_locality(lc_species)
        loc.notes = "line1\nline2"  # not directly serialized but defense
        loc.save()
        rows = [locality_to_dwc_row(loc)]
        tsv = render_occurrence_tsv(rows)
        # Header + one data row.
        assert len(tsv.strip().split("\n")) == 2


@pytest.mark.django_db
class TestArchiveQueryset:
    def test_needs_review_records_excluded(self, lc_species: Species) -> None:
        good = _make_locality(lc_species, locality_name="published", lat=-18.5, lng=47.0)
        _quarantined = _make_locality(
            lc_species,
            locality_name="quarantined",
            needs_review=True,
            lat=-19.0,
            lng=47.5,
        )
        body = build_archive_bytes()
        with zipfile.ZipFile(io.BytesIO(body)) as zf:
            tsv = zf.read("occurrence.txt").decode()
        assert "published" in tsv
        assert "quarantined" not in tsv
        assert f"mffcp:locality:{good.pk}" in tsv


@pytest.mark.django_db
class TestArchiveStructure:
    def test_archive_contains_three_files(self, lc_species: Species) -> None:
        _make_locality(lc_species)
        body = build_archive_bytes()
        with zipfile.ZipFile(io.BytesIO(body)) as zf:
            names = set(zf.namelist())
        assert names == {"occurrence.txt", "eml.xml", "meta.xml"}

    def test_meta_xml_is_well_formed(self) -> None:
        meta = render_meta_xml()
        # Parse — raises if malformed.
        ET.fromstring(meta)
        # Spot-check: rowType is the DwC Occurrence URI.
        assert "Occurrence" in meta

    def test_eml_xml_is_well_formed(self, lc_species: Species) -> None:
        _make_locality(lc_species)
        body = build_archive_bytes()
        with zipfile.ZipFile(io.BytesIO(body)) as zf:
            eml = zf.read("eml.xml").decode()
        ET.fromstring(eml)
        assert "Madagascar" in eml


@pytest.mark.django_db
class TestPublicEndpoints:
    def test_archive_is_public(self, api_client: APIClient, lc_species: Species) -> None:
        _make_locality(lc_species)
        resp = api_client.get("/api/v1/dwc/archive.zip")
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/zip"
        # Read body — APIClient delivers bytes via .content.
        assert int(resp["Content-Length"]) > 0
        assert resp["Content-Disposition"].startswith("attachment;")

    def test_archive_is_cacheable(self, api_client: APIClient, lc_species: Species) -> None:
        _make_locality(lc_species)
        resp = api_client.get("/api/v1/dwc/archive.zip")
        assert "Cache-Control" in resp
        assert "max-age=3600" in resp["Cache-Control"]

    def test_occurrence_endpoint_returns_tsv(
        self, api_client: APIClient, lc_species: Species
    ) -> None:
        _make_locality(lc_species)
        resp = api_client.get("/api/v1/dwc/occurrence.txt")
        assert resp.status_code == 200
        assert "tab-separated-values" in resp["Content-Type"]

    def test_eml_endpoint_returns_xml(self, api_client: APIClient) -> None:
        resp = api_client.get("/api/v1/dwc/eml.xml")
        assert resp.status_code == 200
        assert resp["Content-Type"].startswith("application/xml")

    def test_post_not_allowed(self, api_client: APIClient) -> None:
        # require_GET — POST returns 405.
        assert api_client.post("/api/v1/dwc/archive.zip").status_code == 405
