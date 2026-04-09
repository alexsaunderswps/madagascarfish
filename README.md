# Core Agent Templates for Claude Code

> **Status:** Draft v1 — April 2026
> **Purpose:** Reusable agent templates for the Plan → Do → Review workflow.
> **Usage:** Copy to `.claude/agents/` in any project, then fill in the `[PROJECT-SPECIFIC]` sections.
> The Architecture Agent can populate these sections as part of its initial analysis.

---

## Conventions

### Model Selection

We use a tiered approach based on task complexity:

| Tier | Intent | Current Alias | Use For |
|------|--------|---------------|---------|
| **Tier 1** (strongest reasoning) | Complex evaluation, strategic decisions, architecture | `opus` | Planning agents, Architecture agent |
| **Tier 2** (strong, fast, cost-effective) | Implementation, focused review, pattern matching | `sonnet` | Review agents, Test writer |

Each agent's `model` field uses Claude Code's built-in aliases (`opus`, `sonnet`, `haiku`).
These aliases automatically resolve to the latest model version within their family — for
example, `sonnet` resolved from Sonnet 4.5 to Sonnet 4.6 without requiring any file changes.

If Anthropic changes the alias naming convention in the future, update the `model` field in
each agent file to match. This is a low-frequency maintenance task — aliases have been stable
across multiple model generations.

Also worth noting: the `opusplan` alias uses Opus for planning/reasoning and automatically
switches to Sonnet for code execution. This could be a cost-effective alternative for the
main orchestrator session.

If cost is a concern, Tier 2 works well for all agents — Tier 1 is a quality optimization,
not a requirement.

### File Format

All agents are Markdown files with YAML frontmatter, stored in `.claude/agents/`. The filename should use hyphens: `business-analyst.md`, not `business_analyst.md`.

### Template Markers

- `[PROJECT-SPECIFIC: ...]` — Must be filled in per project. The Architecture Agent can populate these.
- `[OPTIONAL: ...]` — Include if relevant to the project, remove if not.

### Cross-Tool Compatibility

If your team uses AGENTS.md (for Copilot, Cursor, Gemini CLI compatibility), symlink CLAUDE.md to AGENTS.md and reference these agents from within that file. The agent files themselves in `.claude/agents/` work the same way regardless.