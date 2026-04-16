Write a user story with acceptance criteria for: $ARGUMENTS

You are writing user stories for the SERCA Desktop project — an offline-first conservation area management application for protected areas worldwide.

## Instructions

1. Read CLAUDE.md for project context, user personas, and constraints.
2. If an issue or epic is referenced, read it for context.
3. Read existing requirements in `docs/requirements/` to understand the documentation style.
4. Generate the user story using the template below.
5. Consider all relevant user personas (ranger, park manager, analyst, IT admin, etc.).

## User Story Template

```markdown
# [Story Title]

## User Story

**As a** [persona from CLAUDE.md],
**I want to** [action/capability],
**So that** [business value/outcome].

## Context

[Why does this matter? How does it fit into the broader workflow?
Reference the conservation domain context where relevant.]

## Acceptance Criteria

| # | Criterion | Notes |
|---|-----------|-------|
| 1 | Given [context], when [action], then [outcome] | |
| 2 | ... | |

## Offline Behavior

[How does this story work at 0 kbps? What happens when connectivity is restored?
Write "Fully offline — no network dependency" if applicable.]

## Security Considerations

[Access control, sensitive data, encryption. Write "None" if no security impact.]

## Data Model Impact

[New or modified tables/fields. Write "None" if no data model changes.]

## Dependencies

[Other stories, components, or decisions this depends on.]

## Story Type Additions

[Per the Definition of Done in CONTRIBUTING.md, note which type-specific
DoD criteria apply: feature, bug fix, database/migration, or infrastructure.]

## Estimation Notes

[Complexity factors, unknowns, or risks that affect estimation.]
```

## Advisory Checks

After writing the story, verify:

- Does it specify offline behavior explicitly?
- Are acceptance criteria testable (Given/When/Then)?
- Is the right persona identified?
- Are security implications of sensitive data addressed?
- Does it reference the correct DoD type for the PR checklist?
