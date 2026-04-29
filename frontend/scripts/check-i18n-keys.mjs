#!/usr/bin/env node
/**
 * Verify message-catalog key parity across locales.
 *
 * `frontend/messages/en.json` is the source of truth. Every other locale
 * (fr, de, es) must have the exact same set of leaf keys. CI fails if a
 * key is added to en.json without being added (with a placeholder
 * value) to the other catalogs.
 *
 * Reason: a key in en.json without a matching entry in fr.json renders
 * as the raw key string in production for French visitors — uglier
 * than the English fallback we explicitly want.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(__dirname, "..", "messages");

const LOCALES = ["en", "fr", "de", "es"];
const SOURCE_LOCALE = "en";

function flattenKeys(obj, prefix = "") {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const nested of flattenKeys(value, fullKey)) {
        keys.add(nested);
      }
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

function loadKeys(locale) {
  const path = resolve(MESSAGES_DIR, `${locale}.json`);
  const raw = readFileSync(path, "utf-8");
  return flattenKeys(JSON.parse(raw));
}

const sourceKeys = loadKeys(SOURCE_LOCALE);
let hadDelta = false;

for (const locale of LOCALES) {
  if (locale === SOURCE_LOCALE) continue;
  const localeKeys = loadKeys(locale);

  const missing = [...sourceKeys].filter((k) => !localeKeys.has(k)).sort();
  const extra = [...localeKeys].filter((k) => !sourceKeys.has(k)).sort();

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${locale}: ${localeKeys.size} keys, in sync with ${SOURCE_LOCALE}`);
    continue;
  }

  hadDelta = true;
  console.error(`✗ ${locale}: parity mismatch with ${SOURCE_LOCALE}`);
  if (missing.length > 0) {
    console.error(`  Missing in ${locale}.json (present in ${SOURCE_LOCALE}.json):`);
    for (const key of missing) console.error(`    - ${key}`);
  }
  if (extra.length > 0) {
    console.error(`  Extra in ${locale}.json (not in ${SOURCE_LOCALE}.json):`);
    for (const key of extra) console.error(`    - ${key}`);
  }
}

if (hadDelta) {
  console.error(
    "\nTo fix: copy missing keys from en.json into the affected locale's catalog (with a placeholder English value if the translation isn't ready yet). Remove extra keys.",
  );
  process.exit(1);
}

console.log(`\nAll ${LOCALES.length} locales in sync (${sourceKeys.size} keys each).`);
