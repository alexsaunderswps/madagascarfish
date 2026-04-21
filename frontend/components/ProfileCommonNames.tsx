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

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  mg: "Malagasy",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  nl: "Dutch",
  pt: "Portuguese",
};

function groupByLanguage(
  names: readonly CommonName[],
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
      ordered.push({ language: code, label: LANGUAGE_LABELS[code], names });
      buckets.delete(code);
    }
  }
  const leftover: Array<{ language: string; label: string; names: string[] }> = [];
  for (const [code, names] of buckets) {
    leftover.push({
      language: code,
      label: LANGUAGE_LABELS[code] ?? (code.toUpperCase() || "Other"),
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
  const grouped = groupByLanguage(commonNames);

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
          Vernacular
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
          Common names
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
          No common names recorded yet.
        </p>
      )}
    </section>
  );
}
