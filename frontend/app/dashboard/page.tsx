import Link from "next/link";
import type { CSSProperties } from "react";

import IucnChart from "@/components/IucnChart";
import UpdatedAgo from "@/components/UpdatedAgo";
import { fetchDashboard } from "@/lib/dashboard";

export const revalidate = 3600;

export const metadata = {
  title: "Conservation Dashboard — Madagascar Freshwater Fish",
  description:
    "Counts of endemic freshwater fish species, IUCN Red List breakdown, ex-situ coverage, and field programs in Madagascar. Refreshed hourly.",
};

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

const COVERAGE_GAP_HREF =
  "/species/?iucn_status=CR,EN,VU&has_captive_population=false";

const CHART_CAPTION =
  "Counts mirror the most recent accepted IUCN Red List assessment for each endemic species in the registry. Species with no assessment appear as Not yet assessed.";

const EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const SECTION_EYEBROW_STYLE: CSSProperties = {
  ...EYEBROW_STYLE,
  marginBottom: 8,
};

const SECTION_H2_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  lineHeight: 1.2,
};

function StalenessBanner({ reason }: { reason: "failure" | "stale" }) {
  const message =
    reason === "failure"
      ? "Current statistics are temporarily unavailable. The last successfully retrieved values are shown below."
      : "The counts shown are older than the usual refresh window. A refresh is in progress.";
  return (
    <div
      role="status"
      style={{
        padding: "12px 16px",
        borderRadius: "var(--radius)",
        border:
          "1px solid color-mix(in oklab, var(--highlight) 55%, var(--rule))",
        backgroundColor:
          "color-mix(in oklab, var(--highlight) 14%, var(--bg-raised))",
        fontSize: 13,
        color: "var(--ink)",
      }}
    >
      {message}
    </div>
  );
}

function StatTile({
  label,
  value,
  sublabel,
  href,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  href?: string;
}) {
  const tileStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    height: "100%",
    padding: "20px 22px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--rule)",
    backgroundColor: "var(--bg-raised)",
    color: "var(--ink)",
    textDecoration: "none",
  };
  const inner = (
    <>
      <span style={EYEBROW_STYLE}>{label}</span>
      <span
        style={{
          fontFamily: "var(--serif)",
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink)",
        }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {sublabel ? (
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{sublabel}</span>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} style={tileStyle}>
      {inner}
    </Link>
  ) : (
    <div style={tileStyle}>{inner}</div>
  );
}

const MAIN_STYLE: CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: "48px 32px 80px",
  display: "flex",
  flexDirection: "column",
  gap: 40,
};

const GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

export default async function DashboardPage() {
  const data = await fetchDashboard();

  if (!data) {
    return (
      <main style={MAIN_STYLE}>
        <header>
          <p style={EYEBROW_STYLE}>Conservation Dashboard</p>
          <h1
            style={{
              margin: "8px 0 0",
              fontFamily: "var(--serif)",
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
              lineHeight: 1.15,
            }}
          >
            Madagascar freshwater fish at a glance
          </h1>
        </header>
        <StalenessBanner reason="failure" />
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>
          Try again in a moment, or browse the{" "}
          <Link
            href="/species/"
            style={{
              color: "var(--accent-2)",
              textDecoration: "none",
              borderBottom:
                "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
            }}
          >
            species directory
          </Link>
          .
        </p>
      </main>
    );
  }

  const { species_counts, ex_situ_coverage, field_programs, last_updated } = data;
  const lastUpdatedMs = Date.parse(last_updated);
  const isStale =
    Number.isFinite(lastUpdatedMs) && Date.now() - lastUpdatedMs > STALE_THRESHOLD_MS;

  return (
    <main style={MAIN_STYLE}>
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={EYEBROW_STYLE}>Conservation Dashboard</p>
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
          Madagascar freshwater fish at a glance
        </h1>
        <UpdatedAgo iso={last_updated} />
      </header>

      {isStale ? <StalenessBanner reason="stale" /> : null}

      <Link
        href={COVERAGE_GAP_HREF}
        data-testid="coverage-gap-stat"
        style={{
          display: "block",
          padding: "24px 28px",
          borderRadius: "var(--radius-lg)",
          border:
            "1px solid color-mix(in oklab, var(--highlight) 45%, var(--rule))",
          backgroundColor:
            "color-mix(in oklab, var(--highlight) 12%, var(--bg-raised))",
          color: "var(--ink)",
          textDecoration: "none",
        }}
      >
        <p style={{ ...EYEBROW_STYLE, color: "var(--ink-2)" }}>Coverage gap</p>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: "var(--serif)",
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.35,
            color: "var(--ink)",
          }}
        >
          <span
            style={{
              fontSize: 40,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
            }}
          >
            {ex_situ_coverage.threatened_species_without_captive_population.toLocaleString()}
          </span>{" "}
          of{" "}
          <span
            style={{
              fontSize: 26,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {ex_situ_coverage.threatened_species_total.toLocaleString()}
          </span>{" "}
          threatened species have no known captive population.
        </p>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent-2)",
          }}
        >
          See which species →
        </p>
      </Link>

      <section
        style={{
          padding: "24px 28px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--rule)",
          backgroundColor: "var(--bg-raised)",
        }}
      >
        <IucnChart counts={species_counts.by_iucn_status} caption={CHART_CAPTION} />
      </section>

      <section aria-label="Species totals">
        <p style={SECTION_EYEBROW_STYLE}>Species totals</p>
        <h2 style={SECTION_H2_STYLE}>Registry coverage</h2>
        <ul
          role="list"
          style={{
            ...GRID_STYLE,
            listStyle: "none",
            margin: "16px 0 0",
            padding: 0,
          }}
        >
          <li>
            <StatTile
              label="Total species"
              value={species_counts.total}
              sublabel={`${species_counts.described.toLocaleString()} described, ${species_counts.undescribed.toLocaleString()} undescribed`}
              href="/species/"
            />
          </li>
          <li>
            <StatTile
              label="Institutions holding captive populations"
              value={ex_situ_coverage.institutions_active}
            />
          </li>
          <li>
            <StatTile
              label="Ex-situ populations tracked"
              value={ex_situ_coverage.total_populations_tracked}
            />
          </li>
        </ul>
      </section>

      <section aria-label="Field programs">
        <p style={SECTION_EYEBROW_STYLE}>Field programs</p>
        <h2 style={SECTION_H2_STYLE}>In-situ activity</h2>
        <ul
          role="list"
          style={{
            ...GRID_STYLE,
            listStyle: "none",
            margin: "16px 0 0",
            padding: 0,
          }}
        >
          <li>
            <StatTile label="Active field programs" value={field_programs.active} />
          </li>
          <li>
            <StatTile label="Planned" value={field_programs.planned} />
          </li>
          <li>
            <StatTile label="Completed" value={field_programs.completed} />
          </li>
        </ul>
      </section>
    </main>
  );
}
