"""
django-modeltranslation registrations for the species app.

Loaded at app-startup via modeltranslation's autodiscover. Registering a
field here adds language-suffixed columns (`description_en`,
`description_fr`, `description_de`, `description_es`) to the model and
turns the unsuffixed attribute into a descriptor that reads/writes the
active language's column.

See docs/planning/i18n/README.md D15 and docs/planning/architecture/
i18n-architecture.md §4 for the rationale on which fields are
translatable in L1.
"""

from modeltranslation.translator import TranslationOptions, register

from species.models import Species, Taxon


@register(Species)
class SpeciesTranslationOptions(TranslationOptions):
    """Long-form prose on Species. Scientific names stay Latin (not
    translatable). Common names live on the separate `CommonName` model
    which already carries a per-row `language` field."""

    fields = (
        "description",
        "ecology_notes",
        "distribution_narrative",
        "morphology",
    )


@register(Taxon)
class TaxonTranslationOptions(TranslationOptions):
    """`common_family_name` is the English family-level common name
    (e.g., "Madagascar rainbowfishes" for Bedotiidae). The taxonomic
    `name` field stays Latin."""

    fields = ("common_family_name",)
