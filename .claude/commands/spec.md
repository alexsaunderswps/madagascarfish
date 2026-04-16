Generate a technical specification for: $ARGUMENTS

You are writing a spec for the SERCA Desktop project — an offline-first conservation area management application. Read the relevant code, issues, and project context before generating.

## Instructions

1. Read CLAUDE.md and CONTRIBUTING.md for project conventions and constraints.
2. If an issue number is referenced, read the issue for requirements and outstanding question answers.
3. If relevant code already exists, read it to understand the current state.
4. Generate the spec using the template below.
5. Save the spec to `docs/specs/` with the naming convention `SPEC-<short-name>.md`.
6. Specs are living documents — note any open questions or decisions that need team input.

## Spec Template

```markdown
# Spec: [Title]

| Field       | Value            |
|-------------|------------------|
| Status      | Draft            |
| Date        | [today]          |
| Issue       | #[number]        |
| Author      | [name]           |

## 1. Overview

[What is being built and why. 2-3 sentences.]

## 2. Requirements

[Functional requirements as a numbered list or table with IDs.]

## 3. Technical Approach

[How will this be implemented? Key design decisions, libraries, patterns.]

## 4. Data Model Changes

[New or modified tables/fields. Include migration notes. Write "None" if no changes.]

## 5. Offline Behavior

[How does this feature work at 0 kbps? Sync considerations. Write "N/A" if purely offline.]

## 6. Security Implications

[Access control, encryption, sensitive data handling. Write "None" if no security impact.]

## 7. UI/UX Considerations

[Wireframes, user flows, accessibility. Write "N/A" if no UI changes.]

## 8. Test Plan

[Key test scenarios: unit, integration, offline, edge cases.]

## 9. Open Questions

[Unresolved decisions that need team input.]
```

## Advisory Checks

After generating the spec, review it against these project conventions and flag any concerns (do not block — advise only):

- Does the feature work fully offline?
- Are there data sovereignty concerns?
- Will it run acceptably on low-spec hardware?
- Does the data model handle sync conflicts?
- Are sensitive data protections addressed?
