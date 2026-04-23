"""Tests for the shoal_priority_report management command (read-only diff)."""

from __future__ import annotations

from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from species.models import Species


def _write_csv(tmp_path: Path, scientific_names: list[str]) -> Path:
    """Write a minimal SHOAL-shaped CSV — header row + rows with sci name in col 2."""
    path = tmp_path / "shoal.csv"
    lines = ["common,scientific,extra"]
    for name in scientific_names:
        lines.append(f",{name},")
    path.write_text("\n".join(lines) + "\n")
    return path


def _mk_species(name: str, *, shoal_priority: bool = False) -> Species:
    return Species.objects.create(
        scientific_name=name,
        taxonomic_status="described",
        family="Cichlidae",
        genus=name.split(" ")[0],
        endemic_status="endemic",
        iucn_status="EN",
        shoal_priority=shoal_priority,
    )


@pytest.mark.django_db
class TestShoalPriorityReport:
    def test_missing_csv_errors(self, tmp_path: Path) -> None:
        with pytest.raises(CommandError, match="CSV not found"):
            call_command("shoal_priority_report", csv=str(tmp_path / "nope.csv"))

    def test_empty_registry_everything_is_list_3(self, tmp_path: Path) -> None:
        csv_path = _write_csv(tmp_path, ["Paretroplus menarambo", "Bedotia geayi"])
        out = StringIO()
        call_command("shoal_priority_report", csv=str(csv_path), stdout=out)
        text = out.getvalue()
        # Both species are in CSV but not in registry → section 3.
        assert "3. In CSV, not in registry at all" in text
        assert "Paretroplus menarambo" in text
        assert "Bedotia geayi" in text

    def test_flip_candidates_appear_in_section_1(self, tmp_path: Path) -> None:
        _mk_species("Paretroplus menarambo", shoal_priority=False)
        csv_path = _write_csv(tmp_path, ["Paretroplus menarambo"])
        out = StringIO()
        call_command("shoal_priority_report", csv=str(csv_path), stdout=out)
        text = out.getvalue()
        assert "1. In CSV, not flagged True in registry" in text
        # Section 1 must contain the species.
        s1_start = text.index("1. In CSV")
        s2_start = text.index("2. Flagged True")
        assert "Paretroplus menarambo" in text[s1_start:s2_start]

    def test_flagged_but_not_in_csv_in_section_2(self, tmp_path: Path) -> None:
        _mk_species("Bedotia geayi", shoal_priority=True)
        csv_path = _write_csv(tmp_path, ["Paretroplus menarambo"])
        _mk_species("Paretroplus menarambo", shoal_priority=False)
        out = StringIO()
        call_command("shoal_priority_report", csv=str(csv_path), stdout=out)
        text = out.getvalue()
        s2_start = text.index("2. Flagged True")
        s3_start = text.index("3. In CSV")
        assert "Bedotia geayi" in text[s2_start:s3_start]

    def test_already_aligned_species_not_in_any_worklist(self, tmp_path: Path) -> None:
        _mk_species("Paretroplus menarambo", shoal_priority=True)
        csv_path = _write_csv(tmp_path, ["Paretroplus menarambo"])
        out = StringIO()
        call_command("shoal_priority_report", csv=str(csv_path), stdout=out)
        text = out.getvalue()
        # Aligned rows should only be reflected in summary counts.
        # The three sections each list (none) for this species.
        assert text.count("Paretroplus menarambo") == 0

    def test_cosmopolitan_excluded_by_default(self, tmp_path: Path) -> None:
        # Pristis pristis is in the SHOAL CSV but has global range —
        # excluded by default.
        csv_path = _write_csv(tmp_path, ["Pristis pristis", "Paretroplus menarambo"])
        out = StringIO()
        call_command("shoal_priority_report", csv=str(csv_path), stdout=out)
        text = out.getvalue()
        assert "Pristis pristis" not in text
        assert "Paretroplus menarambo" in text

    def test_cosmopolitan_included_with_flag(self, tmp_path: Path) -> None:
        csv_path = _write_csv(tmp_path, ["Pristis pristis"])
        out = StringIO()
        call_command(
            "shoal_priority_report",
            csv=str(csv_path),
            include_cosmopolitan=True,
            stdout=out,
        )
        text = out.getvalue()
        assert "Pristis pristis" in text

    def test_makes_no_writes(self, tmp_path: Path) -> None:
        sp_true = _mk_species("A a", shoal_priority=True)
        sp_false = _mk_species("B b", shoal_priority=False)
        csv_path = _write_csv(tmp_path, ["B b", "Z z"])
        call_command("shoal_priority_report", csv=str(csv_path))
        # Reload from DB — values unchanged.
        sp_true.refresh_from_db()
        sp_false.refresh_from_db()
        assert sp_true.shoal_priority is True
        assert sp_false.shoal_priority is False

    def test_summary_counts_in_output(self, tmp_path: Path) -> None:
        _mk_species("A a", shoal_priority=True)
        _mk_species("B b", shoal_priority=False)
        csv_path = _write_csv(tmp_path, ["B b", "C c"])
        out = StringIO()
        call_command("shoal_priority_report", csv=str(csv_path), stdout=out)
        text = out.getvalue()
        assert "SHOAL species considered: 2" in text
        assert "Registry species total: 2" in text
        assert "Registry currently shoal_priority=True: 1" in text

    def test_read_only_banner_printed(self, tmp_path: Path) -> None:
        csv_path = _write_csv(tmp_path, ["A a"])
        out = StringIO()
        call_command("shoal_priority_report", csv=str(csv_path), stdout=out)
        assert "read-only report" in out.getvalue()
