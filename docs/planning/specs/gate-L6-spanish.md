# Gate L6 — Spanish content & UI

**Status**: pre-staged 2026-04-30. MT pass complete; awaiting voice review + flag-flip decision.

**Audience**: Aleksei + future maintainer who picks this up after ABQ.

---

## Scope

Mirrors L5 (German). Same shape, same workflow, just Spanish.

- Frontend UI catalog (`frontend/messages/es.json`) — was English
  placeholders through L1–L5; now machine-translated to Spanish via
  the L1 `pnpm i18n:translate es` pipeline.
- Species long-form prose (`Species.distribution_narrative_es`) for
  all 143 species — machine-translated via
  `translate_species --locale es`.
- Backend `gettext` catalog (`backend/locale/es/LC_MESSAGES/django.po`)
  — machine-translated, then hand-fixed for placeholder integrity.

## What's already done (this branch)

1. **`pnpm i18n:translate es`** — 786 strings MT'd. Plurals (12)
   flagged for manual translation per the script's standard output.
2. **`translate_species --locale es`** — 143 species
   `distribution_narrative_es` columns populated; matching
   `TranslationStatus(status='mt_draft', locale='es')` rows created.
3. **`backend/locale/es/LC_MESSAGES/django.po`** — 97 msgids machine-
   translated. Five placeholder bugs from DeepL hand-fixed (Spanish
   "modelo" sneaking into the `{model}` placeholder; pluralization
   stripping the trailing s of `%(...)s`; one `%(código)s` accent
   contamination). `compilemessages` succeeds; smoke-tested with
   `translation.override("es"); _("Invalid email or password.")` →
   `"Correo electrónico o contraseña incorrectos."`

## What's not done (deliberate)

1. **Voice review** of the Spanish UI catalog — the conservation-writer
   agent's locked-term glossary carries a Spanish column (added per L3
   review notes), but no review pass has been run on the 786 strings
   or the 143 species rows. Both still sit at MT-level fidelity.
2. **Plural translations** — 12 plural strings flagged by
   `i18n:translate` need manual handling; current placeholders are
   English.
3. **Per-species human approval** — 143 `mt_draft` rows in the DB.
   Same admin-pipeline workflow as French + German.
4. **Flag flip** — `NEXT_PUBLIC_FEATURE_I18N_ES` stays `false` until
   reviewed content lands. The Spanish URL prefix (`/es/...`) is
   already routable.

## Operational handoff

Identical to L5. When ready to ship:

1. Conservation-writer review pass on `frontend/messages/es.json`
   against the Spanish glossary column.
2. Hand-translate the 12 plurals.
3. Conservation-writer family-by-family on the 143 `mt_draft` species
   rows (same admin workflow as Bedotiidae for French —
   see `docs/handover/i18n-corrections-workflow.md`).
4. Bulk-approve in admin → `human_approved`.
5. Flag-flip per `docs/operations/i18n-flag-flip-runbook.md`,
   substituting `..._FR` for `..._ES`.

## Rough effort estimate

- Conservation-writer review of 786 catalog strings: ~half a day.
- Plurals: 30 min.
- Per-family conservation-writer + human review: ~3 hours total.
- Flag-flip: ~30 min including smoke test.

**Total**: ~1 focused day. Can run in parallel with L5 (German) since
the MT outputs and review steps don't share state.

## Stop-ship items

- Verify `compilemessages` runs cleanly on the Spanish `.po` after any
  edits — Django will refuse to build the `.mo` if any placeholder
  format string is broken (already burned us once during the MT pass).
- The 143 `mt_draft` rows include the 8 introduced tilapia species
  with English source `"Madagascar (introduced)"` — ES renders these
  as `"Madagascar (introducida)"` (feminine agreement with "especie").

## Dependencies

None — L4 shipped all the infrastructure. This gate is content-only.
Independent of L5; can ship on its own schedule.

## Related

- Initiative hub: `docs/planning/i18n/README.md` (D10 gate split)
- L5 spec (sibling, same shape): `docs/planning/specs/gate-L5-german.md`
- L4 spec (full reference for what's now infrastructure):
  `docs/planning/specs/gate-L4-i18n-french-staff.md`
- Operational handover: `docs/handover/i18n-corrections-workflow.md`
- Flag-flip runbook: `docs/operations/i18n-flag-flip-runbook.md`
- conservation-writer agent: `.claude/agents/conservation-writer.md`
  (Spanish column in locked-term glossary)
