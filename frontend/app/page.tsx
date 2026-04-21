import Link from "next/link";

import IucnChart from "@/components/IucnChart";
import LastSyncStrip from "@/components/LastSyncStrip";
import { fetchDashboard } from "@/lib/dashboard";
import { fetchSiteMapAsset } from "@/lib/siteMapAssets";

const COVERAGE_GAP_HREF =
  "/species/?iucn_status=CR,EN,VU&has_captive_population=false";

interface NavCard {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
}

const NAV_CARDS: NavCard[] = [
  {
    href: "/species/",
    eyebrow: "Directory",
    title: "Species Directory",
    description:
      "Browse endemic species. Filter by IUCN Red List category, family, or captive-population coverage.",
  },
  {
    href: "/map/",
    eyebrow: "Map",
    title: "Distribution Map",
    description:
      "Locality records across Madagascar's freshwater systems, color-coded by IUCN category.",
  },
  {
    href: "/dashboard/",
    eyebrow: "Dashboard",
    title: "Conservation Dashboard",
    description:
      "Counts of species assessments, ex-situ coverage, and field programs, refreshed hourly.",
  },
];

const EYEBROW_STYLE = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: "var(--ink-3)",
};

const SECTION_H2_STYLE = {
  margin: 0,
  marginTop: 8,
  fontFamily: "var(--serif)",
  fontSize: 28,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  lineHeight: 1.15,
};

export default async function HomePage() {
  const [dashboard, heroAsset] = await Promise.all([
    fetchDashboard(),
    fetchSiteMapAsset("hero_thumb"),
  ]);

  const gap = dashboard?.ex_situ_coverage;
  const hasStat =
    gap && typeof gap.threatened_species_without_captive_population === "number";
  const iucnCounts = dashboard?.species_counts?.by_iucn_status ?? {};
  const hasIucn = Object.values(iucnCounts).some((n) => (n ?? 0) > 0);

  return (
    <>
      <LastSyncStrip lastSyncAt={dashboard?.last_sync_at ?? null} />

      <section
        style={{
          position: "relative",
          backgroundColor: "var(--bg-sunken)",
          borderBottom: "1px solid var(--rule)",
          overflow: "hidden",
        }}
      >
        {heroAsset ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroAsset.url}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.22,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, color-mix(in oklab, var(--bg-sunken) 55%, transparent) 0%, var(--bg-sunken) 100%)",
              }}
            />
          </>
        ) : null}
        <div
          style={{
            position: "relative",
            maxWidth: 1280,
            margin: "0 auto",
            padding: "72px 32px 80px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <p style={EYEBROW_STYLE}>
            Madagascar Freshwater Fish Conservation Platform
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--serif)",
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
              lineHeight: 1.1,
              maxWidth: 880,
            }}
          >
            A shared record for Madagascar&rsquo;s endemic freshwater fish.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              maxWidth: 760,
            }}
          >
            An open platform that brings together species profiles, ex-situ
            breeding coordination, and field program tracking for the roughly
            79 freshwater fish species found only in Madagascar. Built to
            complement IUCN, GBIF, FishBase, and ZIMS — not replace them.
          </p>
        </div>
      </section>

      <main
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "48px 32px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 56,
        }}
      >
        <section>
          <Link
            href={COVERAGE_GAP_HREF}
            data-testid="coverage-gap-stat"
            style={{
              display: "block",
              padding: "24px 28px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid color-mix(in oklab, var(--highlight) 45%, var(--rule))",
              backgroundColor: "color-mix(in oklab, var(--highlight) 12%, var(--bg-raised))",
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            {hasStat ? (
              <>
                <p style={{ ...EYEBROW_STYLE, color: "var(--ink-2)" }}>
                  Coverage gap
                </p>
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
                    {gap.threatened_species_without_captive_population.toLocaleString()}
                  </span>{" "}
                  of{" "}
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {gap.threatened_species_total.toLocaleString()}
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
              </>
            ) : (
              <p
                data-testid="coverage-gap-fallback"
                style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}
              >
                Coverage statistics are refreshing. Counts will appear shortly.
              </p>
            )}
          </Link>
        </section>

        {hasIucn ? (
          <section>
            <p style={EYEBROW_STYLE}>Red List breakdown</p>
            <h2 style={SECTION_H2_STYLE}>Species by Red List category</h2>
            <div style={{ marginTop: 20 }}>
              <IucnChart
                counts={iucnCounts}
                caption="Counts reflect the current mirror of each species' most recent accepted IUCN assessment. Click a bar to open the directory filtered to that category."
              />
            </div>
          </section>
        ) : null}

        <nav aria-label="Primary sections">
          <p style={EYEBROW_STYLE}>Explore</p>
          <h2 style={SECTION_H2_STYLE}>Where to go next</h2>
          <ul
            role="list"
            style={{
              listStyle: "none",
              margin: "20px 0 0",
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {NAV_CARDS.map((card) => (
              <li key={card.href}>
                <Link
                  href={card.href}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    height: "100%",
                    padding: "20px 22px",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--rule)",
                    backgroundColor: "var(--bg-raised)",
                    color: "var(--ink)",
                    textDecoration: "none",
                  }}
                >
                  <span style={EYEBROW_STYLE}>{card.eyebrow}</span>
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 20,
                      fontWeight: 600,
                      color: "var(--ink)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {card.title}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "var(--ink-2)",
                    }}
                  >
                    {card.description}
                  </span>
                  <span
                    style={{
                      marginTop: "auto",
                      paddingTop: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--accent-2)",
                    }}
                  >
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </>
  );
}
