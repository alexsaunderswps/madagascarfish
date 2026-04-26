"""Seed plausible demo data for the coordinator dashboard.

Creates **CoordinatedProgram**, **Transfer**, **BreedingRecommendation**, and
**BreedingEvent** rows derived from whatever Species + ExSituPopulation +
Institution data already exists. The goal is a workshop-ready demo where
Panels 2, 5, and 6 of `/dashboard/coordinator/` tell a coherent story
without Alex having to enter every row by hand before ABQ (June 1–5, 2026).

Every demo row begins with the marker (see ``DEMO_MARKER``) at the start of
a designated text field — ``plan_summary`` for programs, ``notes`` for
transfers and events, ``rationale`` for recommendations. ``--clear`` matches
on ``startswith`` (not ``contains``), so a real operator-entered row that
happens to quote the marker substring elsewhere in its text is never
deleted by accident.

Idempotent: re-running without ``--clear`` is a no-op for existing demo
rows (matched by natural key).
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from populations.models import (
    BreedingEvent,
    BreedingRecommendation,
    CoordinatedProgram,
    ExSituPopulation,
    Institution,
    Transfer,
)
from species.models import Species

DEMO_MARKER = "[DEMO_SEED]"

# IUCN categories that get the priority program treatment.
HIGH_PRIORITY_IUCN = {"CR", "EN"}
MEDIUM_PRIORITY_IUCN = {"VU"}


class Command(BaseCommand):
    help = (
        "Seed demo CoordinatedProgram, Transfer, BreedingRecommendation, and "
        "BreedingEvent rows for the coordinator dashboard. Tagged with a "
        f"marker ({DEMO_MARKER}) for safe rollback via --clear."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing demo-tagged rows before seeding.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Roll back at the end of the transaction.",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=20260601,
            help=(
                "Random seed. Fixed by default so repeated runs produce the "
                "same demo dataset; pass another integer to vary."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        clear = options["clear"]
        dry_run = options["dry_run"]
        random.seed(options["seed"])
        # Resolve "today" once at command start so the demo data lands
        # consistently across all four seed stages, and so freezegun-based
        # tests can pin the date through the standard mechanism.
        today = date.today()

        with transaction.atomic():
            sid = transaction.savepoint()

            if clear:
                cleared = self._clear_demo()
                self.stdout.write(self.style.WARNING(f"cleared {cleared} demo rows"))

            programs = self._seed_programs(today)
            transfers = self._seed_transfers(today)
            recs = self._seed_recommendations(today)
            events = self._seed_breeding_events(today)

            if dry_run:
                transaction.savepoint_rollback(sid)
                self.stdout.write(self.style.WARNING("dry-run: no changes committed"))
            else:
                transaction.savepoint_commit(sid)

        verb = "would create" if dry_run else "created"
        self.stdout.write(self.style.SUCCESS(f"demo seed summary ({verb}):"))
        self.stdout.write(f"  CoordinatedProgram   : {programs}")
        self.stdout.write(f"  Transfer             : {transfers}")
        self.stdout.write(f"  BreedingRecommendation: {recs}")
        self.stdout.write(f"  BreedingEvent        : {events}")

    def _clear_demo(self) -> int:
        """Delete every demo-tagged row across the four target tables.

        Uses ``startswith`` rather than ``contains`` so that a real row that
        merely quotes the marker substring elsewhere in its text is not
        deleted. Demo seeds always begin the relevant field with the marker.
        """
        n = 0
        n += BreedingEvent.objects.filter(notes__startswith=DEMO_MARKER).delete()[0]
        n += BreedingRecommendation.objects.filter(rationale__startswith=DEMO_MARKER).delete()[0]
        n += Transfer.objects.filter(notes__startswith=DEMO_MARKER).delete()[0]
        n += CoordinatedProgram.objects.filter(plan_summary__startswith=DEMO_MARKER).delete()[0]
        return n

    def _candidate_species(self) -> list[Species]:
        """Threatened species with ≥1 captive population — the demo focus set."""
        return list(
            Species.objects.filter(
                iucn_status__in=list(HIGH_PRIORITY_IUCN | MEDIUM_PRIORITY_IUCN),
                ex_situ_populations__isnull=False,
            )
            .distinct()
            .order_by("iucn_status", "scientific_name")
        )

    def _seed_programs(self, today: date) -> int:
        """One CoordinatedProgram per threatened species with populations.

        Program type assigned by IUCN tier: CR/EN → EEP (most common
        framework for Madagascar endemics in zoos); VU → CARES; species
        with hobbyist-only populations get CARES regardless.
        """
        created = 0
        species_list = self._candidate_species()[:8]  # Cap demo set.

        # Materialize coordinator candidates once with a deterministic ORM
        # ordering. Postgres' ORDER BY RANDOM() is seeded separately from
        # Python's `random` and would silently break --seed reproducibility
        # if used here. Pick from the list with random.choice instead.
        coordinator_candidates = list(
            Institution.objects.filter(
                institution_type__in=["zoo", "aquarium"],
            ).order_by("pk")
        )
        partner_candidates = list(
            Institution.objects.filter(
                institution_type__in=["zoo", "aquarium", "hobbyist_keeper"],
            ).order_by("pk")
        )

        for sp in species_list:
            program_type = self._program_type_for(sp)
            # Idempotent: skip if a row with the unique (species, program_type)
            # already exists, demo-tagged or not.
            if CoordinatedProgram.objects.filter(species=sp, program_type=program_type).exists():
                continue

            coordinator = random.choice(coordinator_candidates) if coordinator_candidates else None
            program = CoordinatedProgram.objects.create(
                species=sp,
                program_type=program_type,
                name=self._program_name(sp, program_type),
                status=CoordinatedProgram.Status.ACTIVE,
                coordinating_institution=coordinator,
                target_population_size=random.choice([50, 80, 120, 200]),
                plan_summary=(
                    f"{DEMO_MARKER} Demo program scaffold for workshop walkthrough. "
                    f"Replace with real plan summary before publishing."
                ),
                start_date=today - timedelta(days=random.randint(180, 730)),
                next_review_date=today + timedelta(days=random.randint(60, 180)),
            )
            partners = [p for p in partner_candidates if not coordinator or p.pk != coordinator.pk]
            random.shuffle(partners)
            if partners:
                program.enrolled_institutions.set(partners[:3])
            created += 1
        return created

    @staticmethod
    def _program_type_for(sp: Species) -> str:
        if sp.iucn_status in HIGH_PRIORITY_IUCN:
            return CoordinatedProgram.ProgramType.EEP
        return CoordinatedProgram.ProgramType.CARES

    @staticmethod
    def _program_name(sp: Species, program_type: str) -> str:
        # Only the two values _program_type_for can return. Other program
        # types use their own seed paths and are not the demo command's
        # responsibility. Keys are stringified so mypy doesn't see a
        # TextChoices-vs-str mismatch on the .get() call.
        prefix_map: dict[str, str] = {
            str(CoordinatedProgram.ProgramType.EEP): "EAZA EEP",
            str(CoordinatedProgram.ProgramType.CARES): "CARES",
        }
        prefix = prefix_map.get(program_type, "Coordinated program")
        return f"{prefix}: {sp.scientific_name}"

    def _seed_transfers(self, today: date) -> int:
        """Plausible transfers across institution pairs.

        Half end up "in flight" (proposed/approved/in_transit), half
        "recently completed" inside the dashboard's 90-day window —
        the two buckets Panel 5 distinguishes.
        """
        created = 0
        species_with_pops = list(
            Species.objects.filter(
                iucn_status__in=list(HIGH_PRIORITY_IUCN),
                ex_situ_populations__isnull=False,
            )
            .distinct()
            .order_by("scientific_name")[:6]
        )

        for sp in species_with_pops:
            institutions = list(
                Institution.objects.filter(ex_situ_populations__species=sp).distinct()
            )
            if len(institutions) < 2:
                continue

            programs = list(CoordinatedProgram.objects.filter(species=sp)[:1])

            # Deterministic pairing — sort by pk so source/dest don't drift
            # between runs (runs that skip earlier seed stages consume less
            # entropy, which used to break idempotency on the second run).
            sorted_insts = sorted(institutions, key=lambda i: i.pk)

            # One in-flight, one recent-completed per species.
            pairs = [
                (sorted_insts[0], sorted_insts[1]),
                # Reverse the second pair so the demo doesn't show the same
                # arrow direction twice for the same species.
                (sorted_insts[1], sorted_insts[0]),
            ]
            for (source, dest), (status, days_offset) in zip(
                pairs,
                [
                    (Transfer.Status.IN_TRANSIT, -7),
                    (Transfer.Status.COMPLETED, -45),
                ],
            ):
                proposed_date = today + timedelta(days=days_offset - 14)
                planned_date = today + timedelta(days=days_offset)
                actual_date = (
                    today + timedelta(days=days_offset)
                    if status == Transfer.Status.COMPLETED
                    else None
                )

                # Idempotent: skip if a tagged transfer for this exact triple
                # exists.
                if Transfer.objects.filter(
                    species=sp,
                    source_institution=source,
                    destination_institution=dest,
                    notes__startswith=DEMO_MARKER,
                ).exists():
                    continue

                Transfer.objects.create(
                    species=sp,
                    source_institution=source,
                    destination_institution=dest,
                    status=status,
                    proposed_date=proposed_date,
                    planned_date=planned_date,
                    actual_date=actual_date,
                    count_male=random.randint(2, 5),
                    count_female=random.randint(3, 6),
                    count_unsexed=random.randint(0, 4),
                    # Prefix `DEMO-INVALID-` so a row that escapes a `--clear`
                    # cycle and lands in an export can't be confused with a
                    # real CITES permit number — real numbers do not begin
                    # with the literal string "DEMO-INVALID".
                    cites_reference=(
                        f"DEMO-INVALID-{sp.pk:03d}-{random.randint(1000, 9999)}"
                        if sp.iucn_status in HIGH_PRIORITY_IUCN
                        else ""
                    ),
                    coordinated_program=programs[0] if programs else None,
                    notes=(
                        f"{DEMO_MARKER} Transfer scaffold for workshop demo. "
                        f"Quarantine + permit details pending."
                    ),
                )
                created += 1
        return created

    def _seed_recommendations(self, today: date) -> int:
        """A spread of breeding recommendations across priority + status.

        Aim for the dashboard to show:
            - 2-3 critical, in-flight items
            - 4-6 high/medium open items
            - 1-2 in_progress (recently picked up)
            - 1-2 overdue (due_date in the past, status=open)

        Note: only programs the current run created (or earlier demo runs
        produced) are eligible — we filter by `plan_summary__startswith=
        DEMO_MARKER` so this method's output is bounded by `_seed_programs`'
        output. If real operator programs exist on the same species, they
        are intentionally not used here so demo recs stay self-contained.
        """
        created = 0
        programs = list(CoordinatedProgram.objects.filter(plan_summary__startswith=DEMO_MARKER))
        if not programs:
            return 0

        priority_mix: list[tuple[str, str, int]] = [
            # (priority, status, days-from-today for issued_date)
            (BreedingRecommendation.Priority.CRITICAL, BreedingRecommendation.Status.OPEN, -5),
            (
                BreedingRecommendation.Priority.CRITICAL,
                BreedingRecommendation.Status.IN_PROGRESS,
                -20,
            ),
            (BreedingRecommendation.Priority.HIGH, BreedingRecommendation.Status.OPEN, -10),
            (
                BreedingRecommendation.Priority.HIGH,
                BreedingRecommendation.Status.OPEN,
                -45,
            ),
            (BreedingRecommendation.Priority.MEDIUM, BreedingRecommendation.Status.OPEN, -15),
            (
                BreedingRecommendation.Priority.MEDIUM,
                BreedingRecommendation.Status.IN_PROGRESS,
                -30,
            ),
            (BreedingRecommendation.Priority.LOW, BreedingRecommendation.Status.OPEN, -8),
        ]

        type_mix = [
            BreedingRecommendation.RecommendationType.BREED,
            BreedingRecommendation.RecommendationType.NON_BREED,
            BreedingRecommendation.RecommendationType.TRANSFER,
            BreedingRecommendation.RecommendationType.BREED,  # weight breed slightly higher
        ]

        # Deterministic due-date spread: derived from the index, not random,
        # so re-runs with the same --seed produce the same set even if
        # entropy is consumed differently in earlier seed stages.
        due_offsets = [-5, 14, 30, 60, 90, 14, 30]

        for i, (priority, status, issued_offset) in enumerate(priority_mix):
            program = programs[i % len(programs)]
            rec_type = type_mix[i % len(type_mix)]
            issued = today + timedelta(days=issued_offset)
            due = today + timedelta(days=due_offsets[i % len(due_offsets)])

            # Idempotent: skip if same (program, type, priority, issued) exists.
            if BreedingRecommendation.objects.filter(
                species=program.species,
                coordinated_program=program,
                recommendation_type=rec_type,
                priority=priority,
                issued_date=issued,
            ).exists():
                continue

            BreedingRecommendation.objects.create(
                species=program.species,
                coordinated_program=program,
                recommendation_type=rec_type,
                priority=priority,
                status=status,
                issued_date=issued,
                due_date=due,
                rationale=(
                    f"{DEMO_MARKER} Workshop demo recommendation. Priority "
                    f"{priority} reflects program plan {program.name!r}. "
                    f"Replace with real rationale before publishing."
                ),
            )
            created += 1
        return created

    def _seed_breeding_events(self, today: date) -> int:
        """Per-population event log entries — 1-3 per breeding population."""
        created = 0
        breeding_pops = list(
            ExSituPopulation.objects.filter(
                breeding_status=ExSituPopulation.BreedingStatus.BREEDING,
            ).order_by("pk")[:8]
        )

        for pop in breeding_pops:
            # Fold the population pk into the timing so each population's
            # event ledger reads as distinct, but keep the calculation
            # deterministic so re-running the seed lands on the same
            # event_dates and the natural-key idempotency check fires.
            offset = pop.pk % 30
            scenarios: list[tuple[str, dict[str, Any], int]] = [
                # (event_type, count_deltas, days-ago)
                (BreedingEvent.EventType.SPAWNING, {}, 90 + offset),
                (
                    BreedingEvent.EventType.HATCHING,
                    {"count_delta_unsexed": 30 + offset},
                    45 + offset,
                ),
                (
                    BreedingEvent.EventType.MORTALITY,
                    {"count_delta_unsexed": -(3 + (offset % 5))},
                    20 + offset,
                ),
            ]
            for event_type, deltas, days_ago in scenarios:
                event_date = today - timedelta(days=days_ago)
                if BreedingEvent.objects.filter(
                    population=pop,
                    event_type=event_type,
                    event_date=event_date,
                    notes__startswith=DEMO_MARKER,
                ).exists():
                    continue
                BreedingEvent.objects.create(
                    population=pop,
                    event_type=event_type,
                    event_date=event_date,
                    notes=(f"{DEMO_MARKER} Workshop demo event for {pop.species}."),
                    **deltas,
                )
                created += 1
        return created
