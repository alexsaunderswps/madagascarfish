Generate test cases for: $ARGUMENTS

You are writing tests for the SERCA Desktop project — an offline-first conservation area management application.

## Instructions

1. Read the code being tested to understand its behavior, inputs, outputs, and edge cases.
2. Read `pyproject.toml` for test configuration (pytest, coverage settings).
3. Read existing tests in `tests/` to match the project's test style and conventions.
4. Generate test cases covering the categories below.
5. Place test files in the appropriate `tests/` subdirectory, mirroring the `src/` structure.

## Test Categories

### Unit Tests
- Happy path: expected inputs produce expected outputs
- Edge cases: empty inputs, boundary values, None/null handling
- Error cases: invalid inputs raise appropriate exceptions

### Integration Tests
- Database operations: verify CRUD with a real SQLite database (no mocks for DB)
- Multi-component interactions: verify components work together correctly

### Offline-Specific Tests
- Feature works with no network connectivity
- Queued operations persist across app restart
- Sync resumes correctly when connectivity is restored

### Security Tests
- SQL injection: parameterized queries prevent injection
- Access control: unauthorized roles are denied
- Sensitive data: no wildlife locations or PII in logs or error messages

### Performance Considerations
- Large dataset handling: test with realistic record counts
- Memory usage: no unbounded growth during batch operations

## Output Format

Generate pytest test functions with:
- Clear, descriptive test names (`test_<what>_<condition>_<expected>`)
- Arrange-Act-Assert structure
- Fixtures for common setup (database connections, sample data)
- Docstrings only where the test name is not self-explanatory
- `@pytest.mark.parametrize` for testing multiple inputs

## Advisory Checks

After generating tests, verify:
- Do tests cover offline behavior where applicable?
- Are database tests using real SQLite (not mocks)?
- Is sensitive test data synthetic (no real wildlife locations)?
- Do tests clean up after themselves (temp files, DB state)?
