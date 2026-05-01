import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import CoverageGapPanel from "@/components/coordinator/CoverageGapPanel";
import OpenRecommendationsPanel from "@/components/coordinator/OpenRecommendationsPanel";
import ReproductiveActivityPanel from "@/components/coordinator/ReproductiveActivityPanel";
import SexRatioRiskPanel from "@/components/coordinator/SexRatioRiskPanel";
import StaleCensusPanel from "@/components/coordinator/StaleCensusPanel";
import StudbookStatusPanel from "@/components/coordinator/StudbookStatusPanel";
import TransferActivityPanel from "@/components/coordinator/TransferActivityPanel";
import { getServerDrfToken, getServerTier } from "@/lib/auth";
import {
  fetchCoverageGap,
  fetchOpenRecommendations,
  fetchReproductiveActivity,
  fetchSexRatioRisk,
  fetchStaleCensus,
  fetchStudbookStatus,
  fetchTransferActivity,
  isCoordinatorTokenConfigured,
} from "@/lib/coordinatorDashboard";
import { fetchDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("dashboard.coordinator");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

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

async function ConfigErrorBanner() {
  // Operator hint — appears in Vercel function logs when the user-facing
  // banner is rendered. Reachable only post-tier-gate, so the visitor is
  // already Tier 3+; the banner means their DRF token couldn't be read
  // from the JWT AND no COORDINATOR_API_TOKEN is configured as a server
  // fallback. See OPERATIONS.md §11.2.
  console.warn(
    "[coordinator-dashboard] ConfigErrorBanner rendered — the viewer's " +
      "session token did not reach the coordination API and " +
      "COORDINATOR_API_TOKEN is not configured. See OPERATIONS.md §11.2.",
  );
  const t = await getTranslations("dashboard.coordinator.configError");
  return (
    <div role="alert" style={CONFIG_ERROR_STYLE}>
      <strong>{t("title")}</strong> {t("body")}
    </div>
  );
}

export default async function CoordinatorDashboardPage({
  searchParams,
}: PageProps) {
  // Defense-in-depth tier gate. The middleware is the front-line guard;
  // this catches the case where a request reaches the server component
  // without going through middleware (matcher misconfiguration, internal
  // rewrites, etc.). Tier 1/2 and anonymous visitors are bounced home —
  // population-level detail at identified institutions has never been
  // public regardless of auth-UX flag state.
  const tier = (await getServerTier()) ?? 0;
  if (tier < 3) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const endemicOnly = params.endemic_only !== "false";

  const userToken = await getServerDrfToken();

  const tokenConfigured = isCoordinatorTokenConfigured() || Boolean(userToken);

  const [
    coverage,
    studbook,
    sexRatio,
    staleCensus,
    transferActivity,
    openRecommendations,
    reproductiveActivity,
    t,
    pulse,
  ] = await Promise.all([
    fetchCoverageGap({ endemicOnly, authToken: userToken }),
    fetchStudbookStatus({ authToken: userToken }),
    fetchSexRatioRisk({ authToken: userToken }),
    fetchStaleCensus({ authToken: userToken }),
    fetchTransferActivity({ authToken: userToken }),
    fetchOpenRecommendations({ authToken: userToken }),
    fetchReproductiveActivity({ authToken: userToken }),
    getTranslations("dashboard.coordinator"),
    // Public dashboard payload — surfaces the `contributors` pulse data.
    fetchDashboard(),
  ]);
  const contributors = pulse?.contributors ?? null;

  return (
    <main style={PAGE_WRAPPER}>
      <header style={HEADER_STYLE}>
        <p style={EYEBROW_STYLE}>{t("eyebrow")}</p>
        <h1 style={TITLE_STYLE}>{t("title")}</h1>
        <p style={DESC_STYLE}>{t("description")}</p>
        <p style={TIER_NOTE_STYLE}>{t("tierNote")}</p>
      </header>

      {contributors ? (
        <div
          aria-label={t("pulse.ariaLabel")}
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--rule)",
            backgroundColor: "var(--bg-raised)",
            fontSize: 13,
            color: "var(--ink-2)",
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              marginRight: 12,
            }}
          >
            {t("pulse.eyebrow", { days: contributors.activity_window_days })}
          </span>
          {t("pulse.line", {
            edits: contributors.populations_edited_recent,
            events: contributors.breeding_events_recent,
            census: contributors.populations_recent_census,
            institutions: contributors.active_institutions_total,
            countries: contributors.countries_represented,
          })}
        </div>
      ) : null}

      {tokenConfigured ? null : <ConfigErrorBanner />}

      <CoverageGapPanel data={coverage} />
      <StudbookStatusPanel data={studbook} />
      <SexRatioRiskPanel data={sexRatio} />
      <StaleCensusPanel data={staleCensus} />
      <TransferActivityPanel data={transferActivity} />
      <OpenRecommendationsPanel data={openRecommendations} />
      <ReproductiveActivityPanel data={reproductiveActivity} />
    </main>
  );
}
