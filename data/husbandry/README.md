# Husbandry exemplar drafts

Source content for the 5–10 exemplar husbandry profiles shipping with the MVP
for the ECA Workshop (June 1, 2026). Each file here will be ingested into
`SpeciesHusbandry` records via a seed command (to be built alongside the model).

## How to use

1. Copy `TEMPLATE.md` to `<scientific_name_slug>.md` (e.g. `paretroplus_menarambo.md`).
2. Fill in what you know. Leave fields blank (not empty-string placeholder) if
   unknown — the loader treats absent fields as "no data," which renders
   cleanly on the page.
3. Add sources as you go; at least one citation is required to publish.
4. When ready, commit to a `data/husbandry/<species>` branch and open a PR so
   the team can voice-edit before the loader runs.

## Field evolution

This template is a starting point, **not** a schema freeze. If a species
surfaces a field we didn't anticipate (e.g. "requires seasonal blackwater
conditioning"), add it to your draft and flag it — the PM/BA will fold the new
field into the model before the loader is built.

## Suggested species list

Candidates flagged in the BA assessment:

- *Paretroplus menarambo* — flagship CR, strong SHOAL story
- *Pachypanchax sakaramyi* — annual killifish, distinct husbandry shape
- A Bedotiid (e.g. *Bedotia madagascariensis* or *B. geayi*) — community-friendly rainbowfish
- A Ptychochromis (e.g. *P. insolitus* or *P. oligacanthus*) — endemic cichlid
- One aplocheilid beyond Pachypanchax if you have breeding experience

Aim for 5 at minimum; 10 if authoring capacity allows. Prioritize species you
can speak to with confidence — the demo is about depth, not coverage.
