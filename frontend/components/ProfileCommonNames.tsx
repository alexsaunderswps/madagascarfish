import { useTranslations } from "next-intl";

import type { CommonName } from "@/lib/species";

/**
 * ProfileCommonNames — vernacular names grouped by language.
 *
 * Data comes from the `common_names` inline on the species serializer;
 * each row has a `language` ISO-639-1 code (en, fr, de, mg, …).
 * Recognised codes render with a full language label; unknown codes fall
 * through to an "Other languages" bucket so new languages don't silently
 * disappear.
 */

const LANGUAGE_ORDER: string[] = ["en", "mg", "fr", "de"];

// Known ISO-639-1 codes whose label lives in the catalog under
// species.profile.commonNamesPanel.languages.<code>. Unknown codes
// uppercase the code itself or fall back to the "other" entry.
const KNOWN_LANGUAGE_CODES = new Set([
  "en",
  "mg",
  "fr",
  "de",
  "es",
  "it",
  "nl",
  "pt",
]);

function groupByLanguage(
  names: readonly CommonName[],
  languageLabel: (code: string) => string,
): Array<{ language: string; label: string; names: string[] }> {
  const buckets = new Map<string, string[]>();
  for (const cn of names) {
    const code = (cn.language || "").toLowerCase().trim();
    const key = code || "other";
    const existing = buckets.get(key) ?? [];
    if (!existing.includes(cn.name)) existing.push(cn.name);
    buckets.set(key, existing);
  }

  const ordered: Array<{ language: string; label: string; names: string[] }> = [];
  for (const code of LANGUAGE_ORDER) {
    const names = buckets.get(code);
    if (names && names.length > 0) {
      ordered.push({ language: code, label: languageLabel(code), names });
      buckets.delete(code);
    }
  }
  const leftover: Array<{ language: string; label: string; names: string[] }> = [];
  for (const [code, names] of buckets) {
    leftover.push({
      language: code,
      label: languageLabel(code),
      names,
    });
  }
  leftover.sort((a, b) => a.label.localeCompare(b.label));
  return [...ordered, ...leftover];
}

export default function ProfileCommonNames({
  commonNames,
}: {
  commonNames: readonly CommonName[];
}) {
  const t = useTranslations("species.profile.commonNamesPanel");
  const tLang = useTranslations("species.profile.commonNamesPanel.languages");
  const languageLabel = (code: string): string => {
    if (KNOWN_LANGUAGE_CODES.has(code)) return tLang(code);
    if (code && code !== "other") return code.toUpperCase();
    return tLang("other");
  };
  const grouped = groupByLanguage(commonNames, languageLabel);

  return (
    <section
      aria-labelledby="common-names-heading"
      style={{
        padding: "28px 28px 24px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--rule)",
        backgroundColor: "var(--bg-raised)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--sans)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          {t("eyebrow")}
        </p>
        <h2
          id="common-names-heading"
          style={{
            marginTop: 4,
            marginBottom: 0,
            fontFamily: "var(--serif)",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          {t("heading")}
        </h2>
      </div>

      {grouped.length > 0 ? (
        <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {grouped.map((group) => (
            <div
              key={group.language}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(96px, auto) 1fr",
                gap: 14,
                alignItems: "baseline",
              }}
            >
              <dt
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                }}
              >
                {group.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: 15,
                  color: "var(--ink)",
                  lineHeight: 1.5,
                }}
              >
                {group.names.join(", ")}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>
          {t("noNames")}
        </p>
      )}
    </section>
  );
}
