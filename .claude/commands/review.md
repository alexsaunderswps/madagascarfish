Perform a comprehensive code review for: $ARGUMENTS

You are reviewing code for the SERCA Desktop project — an offline-first conservation area management application handling sensitive wildlife and patrol data.

## Instructions

1. Read the full diff and surrounding context for the code being reviewed.
2. Read CLAUDE.md for project conventions, security guidelines, and code style.
3. Check each review area below and report findings.
4. Categorize each finding as **blocking**, **suggestion**, or **nit**.
5. At the current project stage, all checks are **advisory** — flag issues but do not block.

## Review Areas

### Correctness
- Logic errors, off-by-one, null handling, edge cases
- Error handling: are failures handled gracefully?
- Does the code do what the PR/issue description says it should?

### Security
- SQL injection: are all queries parameterized?
- Sensitive data: wildlife locations, patrol routes, or credentials in logs, comments, or test fixtures?
- Encryption: data at rest and in transit handled correctly?
- Access control: does RBAC apply where needed?
- Input validation at system boundaries

### Offline & Data Integrity
- Does the feature work without network connectivity?
- Are database operations wrapped in transactions?
- Is WAL mode used? Is crash recovery handled?
- Are sync conflicts considered?

### Performance
- Will this run acceptably on low-spec hardware?
- Unnecessary memory allocation, disk I/O, or CPU usage?
- N+1 queries or unbounded result sets?

### Conventions
- Commit messages follow Conventional Commits format?
- Code style consistent with existing codebase?
- Test coverage for new/changed behavior?
- Documentation updated if user-facing?

### Maintainability
- Is the code clear and self-documenting?
- Are abstractions appropriate (not too early, not too late)?
- Would a new contributor understand this code?

## Output Format

```markdown
## Code Review: [what was reviewed]

### Summary
[1-2 sentence overall assessment]

### Findings

| # | Severity | Area | File:Line | Finding |
|---|----------|------|-----------|---------|
| 1 | blocking | ... | ... | ... |
| 2 | suggestion | ... | ... | ... |

### Details
[Expanded explanation for each finding, with suggested fixes where applicable]

### Verdict
[Approve / Request Changes / Needs Discussion]
```
