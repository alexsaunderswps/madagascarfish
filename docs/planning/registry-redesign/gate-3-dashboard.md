# Gate 3 — Ex-situ Coordinator Dashboard

**Status:** Stub — scoped after Gate 2 ships
**Depends on:** Gate 2 merged (`ExSituHolding`, `FieldProgram` models required)
**Branch (when cut):** `feat/registry-redesign-gate-3-dashboard`

## Scope (working outline)

Restructure the dashboard around what an ex-situ coordinator needs to triage work, per `docs/design.md` §6:

1. **Coverage gap panel** — threatened species with no captive population, sortable by IUCN category and basin.
2. **Single-institution risk** — species with `ex_situ.institutions ≤ 2`.
3. **Studbook status** — species with coordinated breeding vs. ad-hoc holdings.
4. **Recently added / updated** — last N records touched, for curator QA.
5. **Red List snapshot** — demoted from hero; lives at the bottom.

## Acceptance criteria

_To be written by @product-manager after Gate 2 lands._
