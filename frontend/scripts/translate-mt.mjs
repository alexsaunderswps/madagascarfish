#!/usr/bin/env node
/**
 * Machine-translate frontend/messages/<locale>.json against en.json
 * using the DeepL API.
 *
 * Process:
 *   1. Load en.json (source of truth) and the target locale's catalog.
 *   2. Walk every leaf string. For each key whose target value is
 *      identical to the English source (i.e. still a placeholder from
 *      Wave 3), call DeepL.
 *   3. Preserve ICU placeholders ({varname}) and XML-like tags
 *      (<strong>, <em>, <gap>, <ts>, <dataLink>, ...) verbatim.
 *   4. Skip pure-symbol strings (em-dash, arrows) — they don't need
 *      translation and waste API quota.
 *   5. Write the translated values back to the target catalog,
 *      preserving file structure and ordering.
 *
 * Endpoint detection:
 *   - DeepL free-tier keys end with ":fx" → api-free.deepl.com
 *   - Paid keys do not                    → api.deepl.com
 *
 * Glossary policy (Gate L1 i18n D5):
 *   - DeepL's hosted glossary feature requires Advanced tier (€20/mo).
 *   - We post-process instead: locked conservation terms (IUCN
 *     categories, "ex-situ", "studbook", etc.) are corrected against
 *     the agent-doc glossary in a separate step (the
 *     @conservation-writer agent reviews MT drafts).
 *
 * Usage:
 *   pnpm i18n:translate fr           # translate empty fr.json keys
 *   pnpm i18n:translate fr --all     # retranslate every key, even
 *                                    # those already translated
 *   DRY_RUN=1 pnpm i18n:translate fr # print the API plan without
 *                                    # calling DeepL
 *
 * Reads DEEPL_API_KEY from the project root .env. Does not commit;
 * caller commits the resulting messages/<locale>.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const MESSAGES_DIR = resolve(__dirname, "..", "messages");

// --- env loader (just enough to read DEEPL_API_KEY from root .env) ---
function loadEnv() {
  const envPath = resolve(REPO_ROOT, ".env");
  let envText;
  try {
    envText = readFileSync(envPath, "utf-8");
  } catch (err) {
    console.error(
      `ERROR: could not read ${envPath}. DEEPL_API_KEY must be set there.`,
    );
    throw err;
  }
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) {
      const [, k, v] = m;
      if (!process.env[k]) {
        // Strip surrounding quotes if present.
        process.env[k] = v.replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadEnv();

const KEY = process.env.DEEPL_API_KEY;
if (!KEY) {
  console.error("ERROR: DEEPL_API_KEY is not set in .env or environment.");
  process.exit(1);
}
const IS_FREE = KEY.endsWith(":fx");
const ENDPOINT = IS_FREE
  ? "https://api-free.deepl.com/v2/translate"
  : "https://api.deepl.com/v2/translate";

const DRY_RUN = process.env.DRY_RUN === "1";

// --- CLI args ---
const args = process.argv.slice(2);
const targetLocale = args[0];
const FORCE_ALL = args.includes("--all");

if (!targetLocale || !["fr", "de", "es"].includes(targetLocale)) {
  console.error("Usage: translate-mt.mjs <fr|de|es> [--all]");
  process.exit(1);
}

const TARGET_LANG = { fr: "FR", de: "DE", es: "ES" }[targetLocale];

// --- placeholder protection ---
//
// DeepL's tag_handling=xml mode preserves XML-like tags as-is. ICU
// placeholders use curly braces ({count}, {name}) — not XML. We swap
// them for self-closing XLIFF placeholders before sending and restore
// after.
//
// Patterns:
//   {varname}              → <x id="varname"/>    (simple ICU)
//   {count, plural, ...}   → <x id="plural__N"/>  (whole plural block)
//
// Plural blocks in next-intl ICU look like:
//   "{count, plural, one {# species matches} other {# species match}}"
// DeepL would mangle the embedded `#` and the inner words. The cleanest
// fix is to extract the entire plural block as one opaque placeholder
// and translate its body keys separately. Since plural blocks are rare
// and span the whole string, we handle them by NOT translating any
// string that contains a plural block — those need conservation-writer
// hand-translation. The script flags them for manual review.

function hasPluralBlock(s) {
  return /\{[^{}]+,\s*(plural|select|selectordinal),/.test(s);
}

function hasUnsupportedICU(s) {
  return hasPluralBlock(s);
}

let placeholderCounter = 0;
function protectPlaceholders(s) {
  // Reset counter per call so each translation gets fresh ids.
  placeholderCounter = 0;
  const map = new Map();
  // 1. Replace simple {varname} with <x id="i"/>. We don't catch ICU
  //    formatting like {n, number, percent} — those would already have
  //    been filtered by hasUnsupportedICU.
  let protectedText = s.replace(/\{([^{}]+)\}/g, (_, name) => {
    const id = `ph${placeholderCounter++}`;
    map.set(id, name);
    return `<x id="${id}"/>`;
  });
  // 2. Escape stray ampersands. DeepL's XML parser rejects raw `&` ("&"
  //    in "Description & Ecology" caused a 400 in the wild). We
  //    pre-encode to &amp; and decode after — DeepL preserves the
  //    entity through translation.
  //    Done AFTER the placeholder replacement so we don't escape the
  //    `&` we just introduced inside attribute values (we don't —
  //    `<x id="..."/>` has no &). Order is fine either way; this order
  //    is just easier to reason about.
  protectedText = protectedText.replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, "&amp;");
  return { protectedText, map };
}

function restorePlaceholders(translated, map) {
  // 1. Decode the &amp; we introduced.
  let restored = translated.replace(/&amp;/g, "&");
  // 2. Restore {varname} from <x id="i"/>.
  restored = restored.replace(/<x id="(ph\d+)"\s*\/>/g, (_, id) => {
    const original = map.get(id);
    if (original === undefined) {
      console.warn(`WARN: DeepL dropped placeholder ${id}; leaving as-is.`);
      return `{${id}}`;
    }
    return `{${original}}`;
  });
  return restored;
}

// --- skip rules ---

function shouldSkip(value) {
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  // Pure-symbol strings (em-dash, arrows) — no translation needed.
  if (/^[\s—–·→←↓↑►«»"'.,…()\-]+$/.test(trimmed)) return true;
  // IUCN abbreviations and proper nouns — keep verbatim.
  if (/^(CR|EN|VU|NT|LC|DD|NE|CCR|CEN|CVU|CLC|SHOAL|GBIF|ZIMS|CARES|IUCN)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

// --- catalog walking ---

function* walkLeaves(obj, path = []) {
  for (const [key, val] of Object.entries(obj)) {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      yield* walkLeaves(val, [...path, key]);
    } else {
      yield { path: [...path, key], value: val };
    }
  }
}

function setAtPath(obj, path, value) {
  let node = obj;
  for (let i = 0; i < path.length - 1; i++) {
    node = node[path[i]];
  }
  node[path[path.length - 1]] = value;
}

function getAtPath(obj, path) {
  let node = obj;
  for (const segment of path) {
    if (node === undefined) return undefined;
    node = node[segment];
  }
  return node;
}

// --- DeepL call ---

async function translateBatch(texts) {
  if (texts.length === 0) return [];
  // DeepL deprecated form-body auth in November 2025 — use the
  // Authorization: DeepL-Auth-Key header form. Body itself is JSON now.
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `DeepL-Auth-Key ${KEY}`,
    },
    body: JSON.stringify({
      text: texts,
      source_lang: "EN",
      target_lang: TARGET_LANG,
      tag_handling: "xml",
      preserve_formatting: true,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepL ${response.status}: ${body.slice(0, 500)}`);
  }
  const json = await response.json();
  return json.translations.map((t) => t.text);
}

// --- main ---

async function main() {
  console.log(
    `[mt] target=${targetLocale} (lang=${TARGET_LANG}) endpoint=${ENDPOINT.replace(
      "https://",
      "",
    )} ${IS_FREE ? "(free)" : "(paid)"} ${DRY_RUN ? "[DRY-RUN]" : ""}`,
  );

  const enPath = resolve(MESSAGES_DIR, "en.json");
  const targetPath = resolve(MESSAGES_DIR, `${targetLocale}.json`);
  const en = JSON.parse(readFileSync(enPath, "utf-8"));
  const target = JSON.parse(readFileSync(targetPath, "utf-8"));

  const todo = [];
  const skipped = [];
  const flagged = []; // ICU plural blocks needing manual handling

  for (const { path, value } of walkLeaves(en)) {
    const targetValue = getAtPath(target, path);
    if (shouldSkip(value)) {
      skipped.push({ path, reason: "symbol-or-proper-noun" });
      continue;
    }
    // Already translated (different from English source) — skip unless --all.
    if (targetValue !== value && !FORCE_ALL) {
      skipped.push({ path, reason: "already-translated" });
      continue;
    }
    if (hasUnsupportedICU(value)) {
      flagged.push({ path, value });
      continue;
    }
    todo.push({ path, value });
  }

  console.log(`[mt] catalog: ${[...walkLeaves(en)].length} keys total`);
  console.log(`[mt] todo: ${todo.length}`);
  console.log(`[mt] skipped: ${skipped.length}`);
  console.log(`[mt] flagged for manual translation (ICU plural): ${flagged.length}`);

  if (flagged.length > 0) {
    console.log(`[mt] flagged keys (need hand-translation):`);
    for (const f of flagged) {
      console.log(`       - ${f.path.join(".")}`);
    }
  }

  if (DRY_RUN) {
    console.log(`[mt] DRY-RUN — no API calls. Exiting.`);
    return;
  }

  if (todo.length === 0) {
    console.log(`[mt] nothing to translate.`);
    return;
  }

  // DeepL accepts up to 50 strings per request. Batch.
  const BATCH = 50;
  let translated = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const protectedTexts = slice.map(({ value }) => {
      const { protectedText, map } = protectPlaceholders(value);
      return { protectedText, map };
    });
    const inputs = protectedTexts.map((p) => p.protectedText);
    let outputs;
    try {
      outputs = await translateBatch(inputs);
    } catch (err) {
      console.error(`[mt] batch ${i}-${i + slice.length} failed:`, err.message);
      console.error(`[mt] partial results NOT written. Re-run to retry.`);
      throw err;
    }
    for (let j = 0; j < slice.length; j++) {
      const { path } = slice[j];
      const { map } = protectedTexts[j];
      const restored = restorePlaceholders(outputs[j], map);
      setAtPath(target, path, restored);
      translated++;
    }
    console.log(`[mt] ${translated}/${todo.length} translated`);
  }

  // Pretty-print with 2-space indent matching the existing catalog
  // style. Trailing newline matches the existing file.
  writeFileSync(targetPath, JSON.stringify(target, null, 2) + "\n", "utf-8");

  console.log(`[mt] wrote ${targetPath}`);
  console.log(
    `[mt] flagged plurals (${flagged.length}) need manual translation; ` +
      `the @conservation-writer review pass should handle them along with ` +
      `voice-correctness review of MT output.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
