Guide creation of a database migration for: $ARGUMENTS

You are creating a database migration for the SERCA Desktop project — an offline-first conservation area management application using SQLite.

## Instructions

1. Read the current database schema by examining existing migrations and the seed script (`scripts/seed_dev_db.py`).
2. Read CLAUDE.md for database and security conventions.
3. Determine what schema changes are needed based on the request.
4. Generate the migration with both upgrade and downgrade paths.
5. Include safety checks for offline-first and data integrity requirements.

## Migration Checklist

Before generating the migration, verify:

- [ ] **Backwards compatible?** Can the previous app version still read the database after migration? (Important for sneakernet deployments where versions coexist)
- [ ] **Reversible?** Does the downgrade path restore the previous schema without data loss?
- [ ] **Transaction-safe?** Is the entire migration wrapped in a transaction?
- [ ] **WAL-compatible?** Does the migration work with SQLite WAL mode enabled?
- [ ] **Large table impact?** If altering a large table, is the approach efficient (e.g., no full table copy for adding a nullable column)?
- [ ] **Foreign keys?** Are foreign key constraints maintained and tested?
- [ ] **Encryption?** Does the migration work with an encrypted SQLite database?
- [ ] **Index updates?** Are indexes added/removed as needed for query performance?

## Migration Template

```python
"""
Migration: [short description]
Date: [today]
Issue: #[number]

Upgrade: [what changes]
Downgrade: [what reverts]
"""


def upgrade(conn):
    """Apply the migration."""
    conn.executescript("""
        -- Migration SQL here
    """)


def downgrade(conn):
    """Revert the migration."""
    conn.executescript("""
        -- Revert SQL here
    """)
```

## Safety Checks

After generating the migration:

- Verify upgrade and downgrade are inverse operations
- Check for data loss risks in the downgrade path
- Ensure no hardcoded values that should be parameterized
- Confirm the migration is idempotent (safe to run twice) where possible
- Flag if the migration requires a specific app version to run

## Advisory Notes

- SQLite does not support `DROP COLUMN` before version 3.35.0 — check compatibility
- `ALTER TABLE ADD COLUMN` only supports adding nullable columns or columns with defaults
- Always test migrations against a database with realistic data volumes
