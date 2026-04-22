import type { CSSProperties } from "react";

import CoverageGapPanel from "@/components/coordinator/CoverageGapPanel";
import SexRatioRiskPanel from "@/components/coordinator/SexRatioRiskPanel";
import StaleCensusPanel from "@/components/coordinator/StaleCensusPanel";
import StudbookStatusPanel from "@/components/coordinator/StudbookStatusPanel";
import {
  fetchCoverageGap,
  fetchSexRatioRisk,
  fetchStaleCensus,
  fetchStudbookStatus,
  isCoordinatorTokenConfigured,
} from "@/lib/coordinatorDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Coordinator Dashboard — Madagascar Freshwater Fish",
  description:
    "Ex-situ coordinator triage view: coverage gaps, studbook status, demographic risk, and census staleness.",
};

interface PageProps {
  searchParams?: Promise<{ endemic_only?: string }>;
}

const PAGE_WRAPPER: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "32px 20px 64px",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const HEADER_STYLE: CSSProperties = {
  marginBottom: 4,
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

const TITLE_STYLE: CSSProperties = {
  margin: "6px 0 8px",
  fontFamily: "var(--serif)",
  fontSize: 32,
  fontWeight: 600,
  letterSpacing: "-0.015em",
  color: "var(--ink)",
  lineHeight: 1.15,
};

const DESC_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: "var(--ink-2)",
  lineHeight: 1.5,
  maxWidth: 760,
};

const TIER_NOTE_STYLE: CSSProperties = {
  fontSize: 12,
  color: "var(--ink-3)",
  marginTop: 8,
  fontStyle: "italic",
};

const CONFIG_ERROR_STYLE: CSSProperties = {
  padding: "14px 16px",
  borderRadius: "var(--radius)",
  border: "1px solid color-mix(in oklab, var(--terracotta) 60%, var(--rule))",
  backgroundColor:
    "color-mix(in oklab, var(--terracotta) 10%, var(--bg-raised))",
  fontSize: 13,
  color: "var(--ink)",
  lineHeight: 1.5,
};

function ConfigErrorBanner() {
  return (
    <div role="alert" style={CONFIG_ERROR_STYLE}>
      <strong>Coordinator token not configured.</strong> The
      <code
        style={{
          margin: "0 4px",
          padding: "1px 4px",
          background: "var(--bg-sunken)",
          borderRadius: 2,
          fontSize: 12,
        }}
      >
        COORDINATOR_API_TOKEN
      </code>
      env var is missing on this deployment, so the dashboard can&apos;t
      authenticate to the API. Panels below will show empty. See{" "}
      <code
        style={{
          margin: "0 2px",
          padding: "1px 4px",
          background: "var(--bg-sunken)",
          borderRadius: 2,
          fontSize: 12,
        }}
      >
        OPERATIONS.md §11.2
      </code>{" "}
      for the setup steps.
    </div>
  );
}

export default async function CoordinatorDashboardPage({
  searchParams,
}: PageProps) {
  const params = (await searchParams) ?? {};
  const endemicOnly = params.endemic_only !== "false";
  const tokenConfigured = isCoordinatorTokenConfigured();

  const [coverage, studbook, sexRatio, staleCensus] = await Promise.all([
    fetchCoverageGap({ endemicOnly }),
    fetchStudbookStatus(),
    fetchSexRatioRisk(),
    fetchStaleCensus(),
  ]);

  return (
    <main style={PAGE_WRAPPER}>
      <header style={HEADER_STYLE}>
        <p style={EYEBROW_STYLE}>Gate 3 · Ex-situ coordinator view</p>
        <h1 style={TITLE_STYLE}>Coordinator Dashboard</h1>
        <p style={DESC_STYLE}>
          Triage view for ex-situ coordinators — where are the gaps, which
          populations are at demographic risk, and whose census is overdue.
          Source of truth is the registry; this view is a read-only summary.
        </p>
        <p style={TIER_NOTE_STYLE}>
          Contains population-level detail. Tier 3+ audience; served via
          server-side token.
        </p>
      </header>

      {tokenConfigured ? null : <ConfigErrorBanner />}

      <CoverageGapPanel data={coverage} />
      <StudbookStatusPanel data={studbook} />
      <SexRatioRiskPanel data={sexRatio} />
      <StaleCensusPanel data={staleCensus} />
    </main>
  );
}
