Reconcile the implementation of gate $ARGUMENTS against its specification.

You are performing a spec-vs-implementation reconciliation for the Madagascar Freshwater Fish Conservation Platform. This creates an auditable paper trail of what was planned, what was actually built, and why they diverge.

## Instructions

1. Read the gate spec from `docs/planning/specs/gate-<NN>-*.md`.
2. Read the architecture proposal in `docs/planning/architecture/architecture-proposal.md` for relevant context.
3. Read the BA assessment in `docs/planning/business-analysis/ba-assessment-v1.md` if relevant requirements are referenced.
4. Read all code that was implemented for this gate (use `git diff main...HEAD` or `git log --oneline main..HEAD` to identify changes).
5. For each acceptance criterion and user story in the spec, determine: was it implemented as specified, implemented with modifications, deferred, or dropped?
6. For each deviation, document the reason (technical constraint, scope decision, better approach discovered during implementation, etc.).
7. Generate the reconciliation report and save it alongside the spec.
8. Update the gate spec status field to reflect completion.

## Reconciliation Report Template

Save to `docs/planning/specs/gate-<NN>-reconciliation.md`:

```markdown
# Gate NN Reconciliation: [Gate Title]

| Field              | Value                |
|--------------------|----------------------|
| Gate               | NN — [title]         |
| Spec version       | [date of spec]       |
| Implementation date| [today]              |
| Reconciled by      | Claude Code          |
| Branch             | [branch name]        |

## Summary

[2-3 sentence overview: was the gate implemented as specced, or were there significant deviations?]

## Acceptance Criteria Status

| # | Criterion (from spec) | Status | Notes |
|---|----------------------|--------|-------|
| 1 | [criterion text] | Implemented as specced / Modified / Deferred / Dropped | [explanation if not as-specced] |
| 2 | ... | ... | ... |

## User Story Status

| Story ID | Title | Status | Notes |
|----------|-------|--------|-------|
| BE-NN-1 | ... | Implemented / Modified / Deferred | ... |

## Deviations

### [Deviation title]
- **Spec said:** [what was originally planned]
- **Implementation does:** [what was actually built]
- **Reason:** [why the change was made — technical constraint, better approach, scope, etc.]
- **Impact:** [does this affect downstream gates, other specs, or user-facing behavior?]

## Additions (not in spec)

[Anything implemented that wasn't in the original spec. Document why it was added.]

## Deferred Items

[Anything from the spec that was explicitly deferred to a later gate or post-MVP. Include which gate or milestone it's deferred to.]

## Technical Decisions Made During Implementation

[Decisions that arose during implementation that weren't covered by the spec or architecture doc. These should be considered for backfill into the architecture proposal or as ADRs.]

## Spec Updates Needed

[List any specs, architecture docs, or planning documents that should be updated to reflect the actual implementation. Do NOT silently modify specs — list the needed changes here so they can be reviewed.]
```

## After generating the report

1. Update the gate spec's status field from "Not started" to "Complete".
2. Add a "Reconciliation" section at the bottom of the gate spec linking to the reconciliation report.
3. If deviations affect downstream gate specs, note which specs need review but do NOT modify them — list them in "Spec Updates Needed" for human review.
4. If technical decisions were made that warrant an ADR, note that recommendation.
