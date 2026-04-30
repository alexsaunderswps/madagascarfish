#!/usr/bin/env node
/**
 * Lint guard for the three "English-pocket" surfaces CLAUDE.md i18n
 * rule #3 names. Catches regressions where new code introduces
 * hardcoded English strings that bypass the `t()` / `getTranslations()`
 * / symbolic-token pattern.
 *
 * Pocket 1: server actions in `app/[locale]/**\/actions.ts` and
 *           `app/api/**\/route.ts`.
 * Pocket 2: helpers in `lib/husbandry.ts` (and any future lib/ helper
 *           that returns user-visible strings).
 * Pocket 3: Django side is linted by ruff + the `compilemessages`
 *           build step (any unwrapped string is silently un-translatable
 *           rather than a build break — this lint only covers the
 *           frontend pockets).
 *
 * Strategy: scan the listed files for English-looking quoted strings
 * that look like user-facing copy (start with capital letter, contain
 * a verb-y word, end with punctuation). Allow-list short technical
 * tokens like "GET", "POST", IDs, and import paths.
 *
 * Run via `pnpm i18n:lint-pockets`. CI fails on any match.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative, join } from "node:path";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Recursively walk `dir`, returning files matching `predicate`. */
function walk(dir, predicate) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...walk(full, predicate));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

const POCKET_FILES = [
  // Pocket 1: server actions + API route handlers
  ...walk(join(REPO_ROOT, "app"), (p) =>
    /\/actions\.ts$/.test(p) || /\/route\.ts$/.test(p),
  ),
  // Pocket 2: lib/husbandry.ts (and any future lib/* string-returning helper)
  join(REPO_ROOT, "lib", "husbandry.ts"),
];

// Strings under 4 chars never trigger; HTTP verbs / single tokens skipped.
const TECHNICAL_ALLOW = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
  "use server",
  "use client",
]);

// Pattern for "looks like user copy": a quoted string with at least one
// space, starting with a capital letter or "A "/"An "/"The ", and ending
// with sentence punctuation OR longer than ~30 chars.
const COPY_PATTERN =
  /"((?:[A-Z][a-zA-Z]*\s|A\s|An\s|The\s)[^"]*[.!?])"|"([A-Z][^"]{30,})"/g;

let violations = [];
// Filter the pocket file list to only files that actually exist (lib/husbandry.ts always does).
const files = POCKET_FILES.filter((f) => {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
});

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines that already route through t()/getTranslations()
    if (/\bt\([\s\S]*\)/.test(line)) continue;
    if (/\bgetTranslations\b/.test(line)) continue;
    // Skip comments
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
    // Skip imports
    if (/^\s*import\s/.test(line)) continue;
    // Skip JSDoc-block lines
    if (/^\s*\*\s/.test(line)) continue;
    // Skip lines whose only quoted string is a directive ("use server" / "use client")
    if (/^\s*"use (server|client)";?\s*$/.test(line)) continue;

    let m;
    while ((m = COPY_PATTERN.exec(line)) !== null) {
      const literal = m[1] ?? m[2];
      if (TECHNICAL_ALLOW.has(literal)) continue;
      violations.push({
        file: relative(REPO_ROOT, file),
        line: i + 1,
        text: literal,
      });
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ no hardcoded English strings in ${files.length} pocket files`);
  process.exit(0);
}

console.error(
  `✗ ${violations.length} hardcoded English strings in pocket files:\n`,
);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${JSON.stringify(v.text)}`);
}
console.error(
  `\nPocket strings should route through:\n` +
    `  - getTranslations() in server actions / route handlers\n` +
    `  - symbolic tokens (enum) returned to components in lib/* helpers\n` +
    `See docs/planning/i18n/L4-S1-english-pockets-survey.md`,
);
process.exit(1);
