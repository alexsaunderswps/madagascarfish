Generate an Architecture Decision Record for: $ARGUMENTS

You are documenting an architecture decision for the SERCA Desktop project — an offline-first conservation area management application.

## Instructions

1. Read CLAUDE.md for project constraints and architectural principles.
2. Read existing ADRs in `docs/adr/` to understand numbering and style conventions.
3. If an issue is referenced, read it for context and stakeholder decisions.
4. If relevant code exists, read it to ground the ADR in the current state.
5. Generate the ADR using the template below.
6. Determine the next ADR number by checking existing files in `docs/adr/`.
7. Save to `docs/adr/ADR-NNN-<short-name>.md`.

## ADR Template

```markdown
# ADR-NNN: [Title]

| Field       | Value                          |
|-------------|--------------------------------|
| Status      | Proposed                       |
| Date        | [today]                        |
| Issue       | #[number]                      |
| Deciders    | WPS / SERCA Desktop team       |

## Context

[What is the problem or decision we need to make? Include the constraints
that shaped the decision: offline-first, data sovereignty, low-spec hardware,
multi-language, SMART migration, etc.]

## Decision

[What did we decide? Break into numbered sub-decisions if needed.
Include rationale for each.]

## Consequences

### Positive
- [What becomes easier or better]

### Negative
- [What becomes harder or is a trade-off]

### Neutral
- [Side effects that are neither good nor bad]

## Alternatives Considered

### [Alternative 1 Name]
- **Description:** [what it is]
- **Pros:** [advantages]
- **Cons:** [disadvantages]
- **Why rejected:** [specific reason]

### [Alternative 2 Name]
[same structure]
```

## Advisory Checks

After generating the ADR, verify:

- Does the decision align with the offline-first architecture?
- Are data sovereignty implications addressed?
- Is the impact on low-spec hardware considered?
- Are sync/conflict resolution implications noted?
- Does this supersede any existing ADR? If so, update the old ADR's status.
