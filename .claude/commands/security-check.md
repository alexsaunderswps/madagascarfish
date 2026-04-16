Perform a focused security review of: $ARGUMENTS

You are reviewing code for security vulnerabilities in the SERCA Desktop project — an offline-first conservation area management application that handles sensitive wildlife location data, patrol routes, and informant information.

## Instructions

1. Read the code being reviewed and its surrounding context.
2. Read CLAUDE.md security guidelines (Section: Security Guidelines).
3. Check every item in the security checklist below.
4. Report findings with severity, location, and recommended fix.
5. At the current project stage, all checks are **advisory** — flag issues clearly but do not block.

## Security Checklist

### Data Protection
- [ ] No wildlife locations, patrol routes, or GPS coordinates in logs, errors, or debug output
- [ ] No PII (usernames, emails) in logs or error messages
- [ ] No secrets (API keys, passwords, encryption keys) in source code
- [ ] Sensitive data encrypted at rest (SQLite encryption)
- [ ] Sensitive data encrypted in transit (TLS for all network communication)

### Input Validation
- [ ] All SQL queries use parameterized statements (no string concatenation/interpolation)
- [ ] All external input (sync data, imports, user input) is validated at system boundaries
- [ ] File path inputs are sanitized (no path traversal)
- [ ] Deserialized data is validated before use

### Authentication & Access Control
- [ ] RBAC enforced — users only access data permitted by their role
- [ ] Password hashing uses Argon2id (not MD5, SHA-1, or bcrypt)
- [ ] Session management is secure (timeout, invalidation)
- [ ] Failed login attempts are rate-limited and logged

### Audit & Integrity
- [ ] All data modifications are traceable to a user and timestamp
- [ ] Database operations use transactions for atomicity
- [ ] Write-ahead logging (WAL) is enabled for crash safety
- [ ] Backup/restore operations maintain data integrity

### Physical Security
- [ ] Application behaves safely if the device is seized (encrypted DB, no cached credentials in plaintext)
- [ ] No telemetry data contains sensitive information
- [ ] Export/report features do not inadvertently expose sensitive data

## Output Format

```markdown
## Security Review: [what was reviewed]

### Risk Summary
| Severity | Count |
|----------|-------|
| Critical | N |
| High     | N |
| Medium   | N |
| Low      | N |
| Info     | N |

### Findings

| # | Severity | Category | File:Line | Finding | Recommendation |
|---|----------|----------|-----------|---------|----------------|
| 1 | critical | ... | ... | ... | ... |

### Details
[Expanded explanation for critical and high findings]

### Positive Observations
[Security practices done well — reinforce good habits]
```

## Severity Definitions

| Severity | Definition |
|----------|-----------|
| **Critical** | Exploitable vulnerability that could expose sensitive wildlife/patrol data or compromise the system |
| **High** | Security weakness that could be exploited with moderate effort |
| **Medium** | Security concern that should be addressed but has mitigating factors |
| **Low** | Minor issue or defense-in-depth improvement |
| **Info** | Observation or best practice suggestion |
