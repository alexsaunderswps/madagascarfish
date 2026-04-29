import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

import type { IucnStatus } from "@/lib/species";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.glossary");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

interface EntrySpec {
  /** i18n key under about.glossary.entries */
  key: string;
  iucnCode?: IucnStatus;
}

// Glossary entries in display order. Definition + display term live in
// the catalog under about.glossary.entries.<key>.{term, definition}.
// IucnCode (when present) drives the colored accent bar; it is data,
// not text, so it lives here in source.
const ENTRIES: EntrySpec[] = [
  { key: "cares" },
  { key: "criticallyEndangered", iucnCode: "CR" },
  { key: "dataDeficient", iucnCode: "DD" },
  { key: "darwinCore" },
  { key: "endangered", iucnCode: "EN" },
  { key: "endemic" },
  { key: "exSitu" },
  { key: "gbif" },
  { key: "inSitu" },
  { key: "leastConcern", iucnCode: "LC" },
  { key: "nearThreatened", iucnCode: "NT" },
  { key: "notEvaluated", iucnCode: "NE" },
  { key: "shoal" },
  { key: "studbook" },
  { key: "threatened" },
  { key: "vulnerable", iucnCode: "VU" },
  { key: "zims" },
];

const IUCN_VAR: Record<IucnStatus, string> = {
  CR: "--iucn-cr",
  EN: "--iucn-en",
  VU: "--iucn-vu",
  NT: "--iucn-nt",
  LC: "--iucn-lc",
  DD: "--iucn-dd",
  NE: "--iucn-ne",
};

const EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

export default async function GlossaryPage() {
  const t = await getTranslations("about.glossary");

  return (
    <>
      <section
        style={{
          backgroundColor: "var(--bg-sunken)",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            padding: "56px 32px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <p style={EYEBROW_STYLE}>
            <Link
              href="/about/"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {t("backToAbout")}
            </Link>
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--serif)",
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
              lineHeight: 1.15,
            }}
          >
            {t("title")}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              maxWidth: 720,
            }}
          >
            {t("intro")}
          </p>
        </div>
      </section>

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "48px 32px 96px",
        }}
      >
        <dl
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {ENTRIES.map((entry, index) => {
            const accent = entry.iucnCode
              ? `var(${IUCN_VAR[entry.iucnCode]})`
              : "var(--rule)";
            const term = t(`entries.${entry.key}.term`);
            const definition = t(`entries.${entry.key}.definition`);
            return (
              <div
                key={entry.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "3px 1fr",
                  gap: 16,
                  padding: "20px 0",
                  borderTop:
                    index === 0 ? "none" : "1px solid var(--rule)",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    backgroundColor: accent,
                    borderRadius: 2,
                    alignSelf: "stretch",
                    opacity: entry.iucnCode ? 1 : 0.4,
                  }}
                />
                <div>
                  <dt
                    style={{
                      margin: 0,
                      fontFamily: "var(--serif)",
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--ink)",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {term}
                  </dt>
                  <dd
                    style={{
                      margin: "6px 0 0",
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "var(--ink-2)",
                    }}
                  >
                    {definition}
                  </dd>
                </div>
              </div>
            );
          })}
        </dl>
      </main>
    </>
  );
}
