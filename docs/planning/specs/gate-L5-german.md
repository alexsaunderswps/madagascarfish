# Gate L5 — German content & UI

**Status**: pre-staged 2026-04-30. MT pass complete; awaiting voice review + flag-flip decision.

**Audience**: Aleksei + future maintainer who picks this up after ABQ.

---

## Scope

Mirrors what L2+L3+L4 produced for French, but for German:

- Frontend UI catalog (`frontend/messages/de.json`) — was English placeholders
  through L1–L4; now machine-translated to German via DeepL (L1's existing
  `pnpm i18n:translate de` pipeline).
- Species long-form prose (`Species.distribution_narrative_de`) for all
  143 species — machine-translated via `translate_species --locale de`.
- Backend `gettext` catalog (`backend/locale/de/LC_MESSAGES/django.po`) —
  machine-translated, then hand-fixed for placeholder integrity.

## What's already done (this branch)

1. **`pnpm i18n:translate de`** — 786 strings MT'd. Plurals (12) flagged
   for manual translation per the script's standard output.
2. **`translate_species --locale de`** — 143 species `distribution_narrative_de`
   columns populated; matching `TranslationStatus(status='mt_draft', locale='de')`
   rows created.
3. **`backend/locale/de/LC_MESSAGES/django.po`** — 97 msgids machine-
   translated. Six placeholder bugs from DeepL hand-fixed (German
   genitive on `{model}` placeholder; pluralization of `%(...)s`
   trailing `s`). `compilemessages` succeeds; smoke-tested with
   `translation.override("de"); _("Invalid email or password.")` →
   `"Ungültige E-Mail-Adresse oder ungültiges Passwort."`

## What's not done (deliberate)

1. **Voice review** of the German UI catalog — the conservation-writer
   agent's locked-term glossary carries a German column (added 2026-04-30
   per L3 review notes), but no review pass has been run on the 786
   strings or the 143 species rows. Both still sit at MT-level fidelity.
2. **Plural translations** — 12 plural strings flagged by `i18n:translate`
   need manual handling; current placeholders are English.
3. **Per-species human approval** — 143 `mt_draft` rows in the DB. Same
   admin-pipeline workflow as French: review → writer_reviewed → human_approved.
4. **Flag flip** — `NEXT_PUBLIC_FEATURE_I18N_DE` stays `false` until
   reviewed content lands. The German URL prefix (`/de/...`) is
   already routable.

## Operational handoff

When ready to ship:

1. Run the conservation-writer agent against the German catalog:
   ```
   @conservation-writer review the German UI catalog at
   frontend/messages/de.json against the locked-term glossary.
   Apply edits + flag plurals.
   ```
2. Hand-translate the 12 plurals.
3. Run the conservation-writer family-by-family against the 143
   species `mt_draft` rows (same workflow as Bedotiidae for French —
   see `docs/handover/i18n-corrections-workflow.md`).
4. Bulk-approve in admin → `human_approved`.
5. Per the flag-flip runbook (`docs/operations/i18n-flag-flip-runbook.md`),
   verify the four `/de/` smoke surfaces, then flip
   `NEXT_PUBLIC_FEATURE_I18N_DE=true` on Vercel production.

## Rough effort estimate

- Conservation-writer review of 786 catalog strings: ~half a day.
- Plurals: 30 min.
- Per-family conservation-writer + human review: ~3 hours total
  (Bedotiidae + Cichlidae + the small families combined).
- Flag-flip: ~30 min including smoke test.

**Total**: ~1 day of focused work. Not blocking ABQ; sensible post-event
cleanup.

## Stop-ship items

- Verify `compilemessages` runs cleanly on the German `.po` after any
  edits — Django will refuse to build the `.mo` if any placeholder
  format string is broken (already burned us once during the MT pass).
- The 143 `mt_draft` rows include the 8 widespread/ubiquitous species
  with English source `"Madagascar"` — DE renders these as
  `"Madagaskar"`. Do not over-translate; that's the whole content.

## Dependencies

None — L4 shipped all the infrastructure. This gate is content-only.

## Related

- Initiative hub: `docs/planning/i18n/README.md` (D10 gate split)
- L4 spec (full reference for what's now infrastructure):
  `docs/planning/specs/gate-L4-i18n-french-staff.md`
- Operational handover: `docs/handover/i18n-corrections-workflow.md`
- Flag-flip runbook: `docs/operations/i18n-flag-flip-runbook.md`
- conservation-writer agent: `.claude/agents/conservation-writer.md`
  (German column in locked-term glossary)
