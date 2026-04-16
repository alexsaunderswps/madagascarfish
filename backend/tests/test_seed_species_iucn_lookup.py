"""
Gate 06 — seed_species --iucn-lookup

Covers the opt-in post-seed IUCN name lookup that populates iucn_taxon_id for
described species missing one. Strict binomial match required.

Scope:
- Exact binomial match via genus_name/species_name fields → taxon_id stored
- Exact match via scientific_name-only shape → taxon_id stored
- Genus mismatch (e.g. synonym pointing elsewhere) → row left unchanged, logged
- Species-epithet mismatch → row left unchanged, logged
- Response with no candidate at all (None payload) → no_match logged
- Provisional taxa and undescribed morphospecies → never queried
- Species that already have iucn_taxon_id → never queried
- Rate-limit sleep only on non-cache-hit responses
"""

from __future__ import annotations

from io import StringIO
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command

from integration.clients.iucn import IUCNAPIError, IUCNClient
from species.management.commands.seed_species import (
    LOOKUP_MATCH,
    LOOKUP_MISMATCH,
    LOOKUP_NO_MATCH,
    LOOKUP_UNPARSEABLE,
    _extract_strict_match,
)
from species.models import Species


# ---------------------------------------------------------------------------
# Unit tests for _extract_strict_match (pure function, no DB)
# ---------------------------------------------------------------------------


class TestExtractStrictMatch:
    def test_match_via_genus_and_species_fields(self) -> None:
        payload = {
            "taxon": {
                "sis_taxon_id": 166478,
                "genus_name": "Pachypanchax",
                "species_name": "sakaramyi",
            }
        }
        sis_id, reason = _extract_strict_match(payload, "Pachypanchax sakaramyi")
        assert reason == LOOKUP_MATCH
        assert sis_id == 166478

    def test_match_via_scientific_name_only_shape(self) -> None:
        payload = {
            "taxon": {
                "sis_taxon_id": 42,
                "scientific_name": "Bedotia geayi",
            }
        }
        sis_id, reason = _extract_strict_match(payload, "Bedotia geayi")
        assert reason == LOOKUP_MATCH
        assert sis_id == 42

    def test_match_via_flat_top_level_shape(self) -> None:
        payload = {
            "sis_taxon_id": 100,
            "genus_name": "Paretroplus",
            "species_name": "menarambo",
        }
        sis_id, reason = _extract_strict_match(payload, "Paretroplus menarambo")
        assert reason == LOOKUP_MATCH
        assert sis_id == 100

    def test_match_is_case_insensitive(self) -> None:
        payload = {
            "taxon": {
                "sis_taxon_id": 7,
                "genus_name": "PACHYPANCHAX",
                "species_name": "SAKARAMYI",
            }
        }
        sis_id, reason = _extract_strict_match(payload, "Pachypanchax sakaramyi")
        assert reason == LOOKUP_MATCH
        assert sis_id == 7

    def test_genus_mismatch_rejected(self) -> None:
        # The API returned a taxon with a different genus — this is exactly the
        # kind of silent false-positive the strict match is meant to prevent.
        payload = {
            "taxon": {
                "sis_taxon_id": 999,
                "genus_name": "Bedotia",
                "species_name": "sakaramyi",
            }
        }
        sis_id, reason = _extract_strict_match(payload, "Pachypanchax sakaramyi")
        assert reason == LOOKUP_MISMATCH
        assert sis_id is None

    def test_species_epithet_mismatch_rejected(self) -> None:
        payload = {
            "taxon": {
                "sis_taxon_id": 999,
                "genus_name": "Pachypanchax",
                "species_name": "playfairii",
            }
        }
        sis_id, reason = _extract_strict_match(payload, "Pachypanchax sakaramyi")
        assert reason == LOOKUP_MISMATCH

    def test_null_payload_returns_no_match(self) -> None:
        sis_id, reason = _extract_strict_match(None, "Anything binomial")
        assert reason == LOOKUP_NO_MATCH
        assert sis_id is None

    def test_payload_with_no_taxon_field_is_unparseable(self) -> None:
        payload: dict[str, Any] = {"unexpected": "shape"}
        sis_id, reason = _extract_strict_match(payload, "Pachypanchax sakaramyi")
        assert reason == LOOKUP_UNPARSEABLE

    def test_missing_sis_id_rejects_even_on_name_match(self) -> None:
        # A shape-level match without an ID is useless to us — don't fabricate one.
        payload = {
            "taxon": {
                "genus_name": "Pachypanchax",
                "species_name": "sakaramyi",
            }
        }
        sis_id, reason = _extract_strict_match(payload, "Pachypanchax sakaramyi")
        assert reason == LOOKUP_MISMATCH
        assert sis_id is None


# ---------------------------------------------------------------------------
# Integration tests for the --iucn-lookup command path
# ---------------------------------------------------------------------------


CSV_HEADER = (
    "scientific_name,family,genus,endemic_status,taxonomic_status,"
    "iucn_taxon_id,provisional_name\n"
)


@pytest.fixture
def tmp_csv(tmp_path: Any) -> Any:
    """One described species, one provisional, one already-mapped."""
    path = tmp_path / "seed.csv"
    path.write_text(
        CSV_HEADER
        + "Pachypanchax sakaramyi,Aplocheilidae,Pachypanchax,endemic,described,,\n"
        + "Bedotia sp. 'manombo',Bedotiidae,Bedotia,endemic,undescribed_morphospecies,,manombo\n"
        + "Bedotia geayi,Bedotiidae,Bedotia,endemic,described,42,\n"
    )
    return path


def _client_returning(payload: dict | None, cache_hit: bool = False) -> MagicMock:
    client = MagicMock(spec=IUCNClient)
    client.get_species_by_name.return_value = (payload, cache_hit)
    client.wait_between_requests = MagicMock()
    return client


@pytest.mark.django_db
class TestSeedSpeciesIUCNLookup:
    def test_lookup_populates_taxon_id_on_strict_match(self, tmp_csv: Any) -> None:
        payload = {
            "taxon": {
                "sis_taxon_id": 166478,
                "genus_name": "Pachypanchax",
                "species_name": "sakaramyi",
            }
        }
        client = _client_returning(payload)

        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            call_command("seed_species", "--csv", str(tmp_csv), "--iucn-lookup")

        sp = Species.objects.get(scientific_name="Pachypanchax sakaramyi")
        assert sp.iucn_taxon_id == 166478

    def test_lookup_skips_provisional_species(self, tmp_csv: Any) -> None:
        # The provisional row must never produce an API call.
        client = _client_returning(None)
        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            call_command("seed_species", "--csv", str(tmp_csv), "--iucn-lookup")

        called_names = [c.args[0] for c in client.get_species_by_name.call_args_list]
        assert "Bedotia sp. 'manombo'" not in called_names

    def test_lookup_skips_already_mapped_species(self, tmp_csv: Any) -> None:
        # Bedotia geayi has iucn_taxon_id=42 from CSV — must not be re-queried.
        client = _client_returning(None)
        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            call_command("seed_species", "--csv", str(tmp_csv), "--iucn-lookup")

        called_names = [c.args[0] for c in client.get_species_by_name.call_args_list]
        assert "Bedotia geayi" not in called_names
        sp = Species.objects.get(scientific_name="Bedotia geayi")
        assert sp.iucn_taxon_id == 42  # unchanged

    def test_lookup_mismatch_leaves_row_unchanged(self, tmp_csv: Any) -> None:
        # API returns a DIFFERENT taxon — strict policy must reject it.
        payload = {
            "taxon": {
                "sis_taxon_id": 9999,
                "genus_name": "NotPachypanchax",
                "species_name": "sakaramyi",
            }
        }
        client = _client_returning(payload)

        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            call_command("seed_species", "--csv", str(tmp_csv), "--iucn-lookup")

        sp = Species.objects.get(scientific_name="Pachypanchax sakaramyi")
        assert sp.iucn_taxon_id is None

    def test_lookup_no_match_leaves_row_unchanged(self, tmp_csv: Any) -> None:
        client = _client_returning(None)
        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            call_command("seed_species", "--csv", str(tmp_csv), "--iucn-lookup")

        sp = Species.objects.get(scientific_name="Pachypanchax sakaramyi")
        assert sp.iucn_taxon_id is None

    def test_lookup_api_error_is_logged_and_does_not_abort(self, tmp_csv: Any) -> None:
        client = MagicMock(spec=IUCNClient)
        client.get_species_by_name.side_effect = IUCNAPIError("500 error")
        client.wait_between_requests = MagicMock()
        err = StringIO()

        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            # Should not raise — per-species errors are logged, not fatal.
            call_command(
                "seed_species",
                "--csv",
                str(tmp_csv),
                "--iucn-lookup",
                stderr=err,
            )

        assert "iucn-lookup error" in err.getvalue()

    def test_no_lookup_when_flag_omitted(self, tmp_csv: Any) -> None:
        client = _client_returning(None)
        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            call_command("seed_species", "--csv", str(tmp_csv))

        assert client.get_species_by_name.call_count == 0

    def test_rate_limit_sleep_only_on_non_cache_hit(self, tmp_csv: Any) -> None:
        payload = {
            "taxon": {
                "sis_taxon_id": 166478,
                "genus_name": "Pachypanchax",
                "species_name": "sakaramyi",
            }
        }
        client = _client_returning(payload, cache_hit=True)
        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            call_command("seed_species", "--csv", str(tmp_csv), "--iucn-lookup")
        assert client.wait_between_requests.call_count == 0

        client = _client_returning(payload, cache_hit=False)
        # Reset the species' taxon_id so the lookup runs again.
        Species.objects.filter(scientific_name="Pachypanchax sakaramyi").update(
            iucn_taxon_id=None
        )
        with patch(
            "integration.clients.iucn.IUCNClient", return_value=client
        ):
            call_command("seed_species", "--csv", str(tmp_csv), "--iucn-lookup")
        assert client.wait_between_requests.call_count == 1
