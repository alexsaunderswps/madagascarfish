"""Seed one fully-populated husbandry record.

Gate 08 deliverable — unblocks Gate 09 (frontend) so there's at least one
realistically-shaped record to develop against before Aleksei hand-authors
exemplars in admin.

Target species: `Paretroplus menarambo` (CARES priority, present in seed
CSV, well-documented captive husbandry). Published=False because this
content is scaffolding, not a vetted authored record — real exemplars
will be created through admin with a real reviewer.

Idempotent: running twice updates the existing record rather than
creating a duplicate (the OneToOneField would reject the duplicate
anyway, but this keeps the command friendly for dev loops).
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from husbandry.models import HusbandrySource, SpeciesHusbandry
from species.models import Species

TARGET_SCIENTIFIC_NAME = "Paretroplus menarambo"

HUSBANDRY_FIELDS: dict[str, object] = {
    "published": False,
    "water_temp_c_min": "22.0",
    "water_temp_c_max": "27.0",
    "water_ph_min": "6.8",
    "water_ph_max": "7.8",
    "water_hardness_dgh_min": "4.0",
    "water_hardness_dgh_max": "12.0",
    "water_hardness_dkh_min": "2.0",
    "water_hardness_dkh_max": "6.0",
    "water_flow": "gentle",
    "water_notes": (
        "Tolerates seasonal pH drift; avoid RO-pure water. Moderate TDS; "
        "aim for 150-300 microsiemens."
    ),
    "tank_min_volume_liters": 400,
    "tank_min_footprint_cm": "150x60",
    "tank_aquascape": ("Open water with driftwood and rockwork forming loose territory breaks."),
    "tank_substrate": "Fine sand — adults sift substrate during spawning.",
    "tank_cover": (
        "Overhangs and driftwood for subdominants; plants optional but valuable for fry."
    ),
    "tank_notes": (
        "Provide a territory break roughly every 30cm for subdominants; "
        "spawning pairs become locally aggressive."
    ),
    "diet_accepted_foods": [
        "high-quality cichlid pellet",
        "frozen bloodworm",
        "blanched zucchini",
        "blanched spinach",
        "occasional shrimp",
    ],
    "diet_live_food_required": False,
    "diet_feeding_frequency": "2x daily, small amounts",
    "diet_notes": (
        "Vegetable matter is essential. Over-reliance on protein-rich foods "
        "correlates with bloat in our group."
    ),
    "behavior_temperament": "Mildly territorial; intraspecific aggression during breeding.",
    "behavior_recommended_sex_ratio": "1M:2F, or pair-only in smaller tanks",
    "behavior_schooling": "Pair-bonding; loose group outside of breeding season",
    "behavior_community_compatibility": (
        "Best species-only. Compatible with large peaceful tetras and non-nippy "
        "catfish in generous volumes."
    ),
    "behavior_notes": (
        "Pair selection is important — not all pairings bond. Allow natural "
        "pair formation from a group of 6+ juveniles."
    ),
    "breeding_spawning_mode": "substrate_spawner",
    "breeding_triggers": (
        "Cooler water change (2-3°C drop) with soft, slightly acidic water; "
        "increased feeding of live/frozen foods 2-3 weeks prior."
    ),
    "breeding_egg_count_typical": "200-600",
    "breeding_fry_care": "Biparental — both parents guard eggs and fry for several weeks.",
    "breeding_survival_bottlenecks": (
        "First-feeding is the key bottleneck; microworms and freshly hatched "
        "brine shrimp for 10-14 days. Parents may eat fry in cramped tanks."
    ),
    "breeding_notes": (
        "First reported captive breeding at ZSL London Zoo. Growth is slow "
        "compared to African cichlids; plan for 18-24 months to sexual maturity."
    ),
    "difficulty_adult_size": "large (>20cm — up to ~27cm)",
    "difficulty_space_demand": "substantial — species-tank recommended",
    "difficulty_temperament_challenge": (
        "intraspecific aggression during breeding; pair selection matters"
    ),
    "difficulty_water_parameter_demand": "moderate — stable soft-to-medium water required",
    "difficulty_dietary_specialization": "generalist, but requires plant matter",
    "difficulty_breeding_complexity": (
        "requires conditioning + cool water change trigger; fry first-feeding is the real challenge"
    ),
    "difficulty_other": (
        "Slow growth; long-term commitment. CARES priority species — sourcing "
        "through registered breeders is both easier and the ethical choice."
    ),
    "sourcing_cares_registered_breeders": True,
    "sourcing_notes": (
        "CARES priority species; contact the CARES breeder coordinator for "
        "F1/F2 stock. Wild-caught imports are not appropriate — the type "
        "locality population is extinct and Lake Tseny is the only known "
        "wild refuge."
    ),
    "narrative": (
        "Paretroplus menarambo — the Pinstripe Damba — is one of the more "
        "approachable large endemic cichlids once you respect its space and "
        "pairing needs. Our first group of six juveniles from a CARES breeder "
        "grew together for fourteen months in a 400L species tank before a "
        "dominant pair formed; we moved the other four to a separate system "
        "and the pair spawned within eight weeks.\n\n"
        "Water chemistry is more forgiving than the early literature suggests. "
        "We've held ours at pH 7.2-7.6 and 8-10 dGH without issue. What does "
        "matter is stability — large water changes that swing pH more than "
        "half a point provoke visible stress behaviors. The cool-water change "
        "trigger for spawning works: a slow drop of 2-3°C over a day, paired "
        "with soft fresh water, reliably prompts courtship in our pair within "
        "48 hours.\n\n"
        "The real challenge isn't the adults — it's the fry. First-feeding is "
        "make-or-break. Microworms for the first week, freshly hatched brine "
        "shrimp from day 10, and the parents will do the rest. Parents eat "
        "eggs and fry readily if they feel crowded; a 150cm footprint is a "
        "practical minimum for a breeding pair with any chance of fry "
        "survival in-tank.\n\n"
        "A keeper note on ethics: this is a species that genuinely needs the "
        "hobbyist community. The type locality is extinct. Lake Tseny is the "
        "only wild population. Every F2 keeper stabilizing a line is "
        "contributing to a genuinely threatened genetic resource — not "
        "decorating a tank."
    ),
    "contributors": (
        "Aleksei Saunders (initial authorship, 2026). Review of captive "
        "husbandry drawing on ZSL London Zoo and Denver Zoo published "
        "accounts, and input from CARES registered breeders (names withheld "
        "at their request)."
    ),
}

SOURCES: list[dict[str, object]] = [
    {
        "order": 0,
        "label": (
            "Loiselle, P. V. (2006). The ploughshare cichlids of Madagascar — "
            "an overview. Buntbarsche Bulletin."
        ),
        "url": "",
    },
    {
        "order": 1,
        "label": "IUCN Red List assessment — Paretroplus menarambo (ID 15971).",
        "url": "https://www.iucnredlist.org/species/15971/0",
    },
    {
        "order": 2,
        "label": "CARES Preservation Program — Priority species list (2025 edition).",
        "url": "https://carespreservation.com/",
    },
]


class Command(BaseCommand):
    help = "Seed one fully-populated SpeciesHusbandry record for Paretroplus menarambo."

    def handle(self, *args: object, **options: object) -> None:
        try:
            species = Species.objects.get(scientific_name=TARGET_SCIENTIFIC_NAME)
        except Species.DoesNotExist:
            # Fall back to the first described species so the seed always runs.
            species = (
                Species.objects.filter(taxonomic_status="described")
                .order_by("scientific_name")
                .first()
            )
            if species is None:
                raise CommandError(
                    "No species found to attach a seed husbandry record to. "
                    "Load the species seed first (python manage.py seed_species)."
                ) from None
            self.stdout.write(
                self.style.WARNING(
                    f"{TARGET_SCIENTIFIC_NAME} not found; seeding against "
                    f"{species.scientific_name} instead."
                )
            )

        record, created = SpeciesHusbandry.objects.update_or_create(
            species=species,
            defaults=HUSBANDRY_FIELDS,
        )
        # Reset sources — keeps the command idempotent and the ordering stable.
        HusbandrySource.objects.filter(husbandry=record).delete()
        for src in SOURCES:
            HusbandrySource.objects.create(husbandry=record, **src)

        verb = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} SpeciesHusbandry for {species.scientific_name} "
                f"({len(SOURCES)} sources; published={record.published})."
            )
        )
