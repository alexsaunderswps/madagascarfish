"""
django-modeltranslation registrations for the husbandry app.

Loaded at app-startup via modeltranslation's autodiscover. Registering a
field here adds language-suffixed columns (`narrative_en`,
`narrative_fr`, …) and turns the unsuffixed attribute into a descriptor
that reads/writes the active language's column.

Translatable fields are the long-form prose narrative + the seven
*_notes free-text columns. Structured choice fields (water_flow,
spawning_mode, accepted_foods array) are NOT translatable here — those
labels render through enum-token mappings in the frontend per the L4
i18n pattern.
"""

from modeltranslation.translator import TranslationOptions, register

from husbandry.models import SpeciesHusbandry


@register(SpeciesHusbandry)
class SpeciesHusbandryTranslationOptions(TranslationOptions):
    """Long-form husbandry prose. Adds `_en/_fr/_de/_es` columns to
    each registered field. The translate_species command and the
    review-pipeline signals walk these fields too."""

    fields = (
        "narrative",
        "water_notes",
        "tank_notes",
        "diet_notes",
        "behavior_notes",
        "breeding_notes",
        "sourcing_notes",
    )
