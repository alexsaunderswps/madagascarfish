import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import { Link } from "@/i18n/routing";
import {
  type PublicFieldProgramRow,
  type PublicFieldProgramStatus,
  fetchPublicFieldPrograms,
} from "@/lib/fieldPrograms";

// Public, cached. Five-minute revalidation matches the species directory:
// coordinator edits surface within minutes without each visit hammering
// Django.
export const revalidate = 300;

export async function generateMetadata() {
  const t = await getTranslations("publicFieldPrograms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const PAGE_WRAPPER: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "32px 20px 64px",
  display: "flex",
  flexDirection: "column",
  gap: 28,
};

const EYEBROW: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const TITLE: CSSProperties = {
  margin: "6px 0 8px",
  fontFamily: "var(--serif)",
  fontSize: 32,
  fontWeight: 600,
  letterSpacing: "-0.015em",
  color: "var(--ink)",
  lineHeight: 1.15,
};

const LEAD: CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: "var(--ink-2)",
  lineHeight: 1.55,
  maxWidth: 760,
};

const STATUS_HEADING: CSSProperties = {
  margin: "0 0 12px",
  fontFamily: "var(--serif)",
  fontSize: 20,
  fontWeight: 600,
  color: "var(--ink)",
};

const CARD_STYLE: CSSProperties = {
  padding: "20px 22px",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--rule)",
  backgroundColor: "var(--bg-raised)",
};

const CARD_NAME: CSSProperties = {
  margin: "0 0 4px",
  fontFamily: "var(--serif)",
  fontSize: 19,
  fontWeight: 600,
  color: "var(--ink)",
};

const CARD_META: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 13,
  color: "var(--ink-3)",
};

const CARD_BODY: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "var(--ink-2)",
  lineHeight: 1.55,
};

const SPECIES_PILL: CSSProperties = {
  display: "inline-block",
  margin: "8px 6px 0 0",
  padding: "2px 8px",
  borderRadius: 10,
  fontSize: 12,
  fontStyle: "italic",
  color: "var(--ink-2)",
  backgroundColor: "color-mix(in oklab, var(--highlight) 10%, var(--bg))",
  border: "1px solid var(--rule)",
};

const LINK_STYLE: CSSProperties = {
  color: "var(--accent)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const STATUS_ORDER: PublicFieldProgramStatus[] = ["active", "planned", "completed"];

export default async function PublicFieldProgramsPage() {
  const [t, data] = await Promise.all([
    getTranslations("publicFieldPrograms"),
    fetchPublicFieldPrograms(),
  ]);

  if (data === null) {
    return (
      <main style={PAGE_WRAPPER}>
        <header>
          <p style={EYEBROW}>{t("eyebrow")}</p>
          <h1 style={TITLE}>{t("title")}</h1>
        </header>
        <p
          role="alert"
          style={{
            padding: "14px 16px",
            borderRadius: "var(--radius)",
            border:
              "1px solid color-mix(in oklab, var(--terracotta) 60%, var(--rule))",
            backgroundColor:
              "color-mix(in oklab, var(--terracotta) 10%, var(--bg-raised))",
            fontSize: 14,
            color: "var(--ink)",
          }}
        >
          {t("transientError")}
        </p>
      </main>
    );
  }

  const grouped: Record<PublicFieldProgramStatus, PublicFieldProgramRow[]> = {
    active: [],
    planned: [],
    completed: [],
  };
  for (const row of data.results) {
    grouped[row.status]?.push(row);
  }
  const totalCount = data.count;

  return (
    <main style={PAGE_WRAPPER}>
      <header>
        <p style={EYEBROW}>{t("eyebrow")}</p>
        <h1 style={TITLE}>{t("title")}</h1>
        <p style={LEAD}>{t("lead")}</p>
      </header>

      {totalCount === 0 ? (
        <section style={CARD_STYLE}>
          <h2 style={{ ...STATUS_HEADING, marginBottom: 8 }}>
            {t("emptyState.heading")}
          </h2>
          <p style={CARD_BODY}>
            {t.rich("emptyState.body", {
              signupLink: (chunks) => (
                <Link href="/signup" style={LINK_STYLE}>
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </section>
      ) : (
        STATUS_ORDER.map((status) => {
          const rows = grouped[status];
          if (rows.length === 0) return null;
          return (
            <section key={status}>
              <h2 style={STATUS_HEADING}>
                {t(`statusHeadings.${status}`, { count: rows.length })}
              </h2>
              <ul
                role="list"
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "1fr",
                }}
              >
                {rows.map((row) => (
                  <li key={row.id}>
                    <ProgramCard row={row} t={t} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}

function ProgramCard({
  row,
  t,
}: {
  row: PublicFieldProgramRow;
  t: Awaited<ReturnType<typeof getTranslations<"publicFieldPrograms">>>;
}) {
  const dateRange = formatDateRange(row.start_date, row.end_date, t);
  return (
    <article style={CARD_STYLE}>
      <h3 style={CARD_NAME}>{row.name}</h3>
      <p style={CARD_META}>
        {row.lead_institution?.name ?? t("card.noLead")}
        {row.region ? ` · ${row.region}` : ""}
        {dateRange ? ` · ${dateRange}` : ""}
      </p>
      {row.description ? <p style={CARD_BODY}>{row.description}</p> : null}
      {row.focal_species.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-3)",
              marginRight: 6,
            }}
          >
            {t("card.focalSpeciesLabel")}
          </span>
          {row.focal_species.map((sp) => (
            <span key={sp.id} style={SPECIES_PILL}>
              {sp.scientific_name}
            </span>
          ))}
        </div>
      ) : null}
      {row.partner_institutions.length > 0 ? (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            color: "var(--ink-3)",
          }}
        >
          {t("card.partnersLabel")}{" "}
          {row.partner_institutions.map((p) => p.name).join(", ")}
        </p>
      ) : null}
      {row.website ? (
        <p style={{ margin: "10px 0 0", fontSize: 13 }}>
          <a
            href={row.website}
            style={LINK_STYLE}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("card.websiteLabel")} ↗
          </a>
        </p>
      ) : null}
    </article>
  );
}

function formatDateRange(
  start: string | null,
  end: string | null,
  t: Awaited<ReturnType<typeof getTranslations<"publicFieldPrograms">>>,
): string {
  if (!start && !end) return "";
  if (start && !end) return t("card.dateRange.fromOnly", { start });
  if (!start && end) return t("card.dateRange.untilOnly", { end });
  return t("card.dateRange.both", { start: start!, end: end! });
}
