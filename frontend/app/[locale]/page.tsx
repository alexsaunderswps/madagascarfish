import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

import IucnChart from "@/components/IucnChart";
import LastSyncStrip from "@/components/LastSyncStrip";
import type { Locale } from "@/i18n/routing";
import { fetchDashboard } from "@/lib/dashboard";
import { buildAlternates } from "@/lib/seo";
import { fetchSiteMapAsset } from "@/lib/siteMapAssets";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: buildAlternates("/", locale),
  };
}

const COVERAGE_GAP_HREF =
  "/species/?iucn_status=CR,EN,VU&has_captive_population=false";

interface NavCard {
  href: string;
  /** i18n key under `home.navCards.<key>` */
  key: "directory" | "map" | "dashboard";
}

const NAV_CARDS: NavCard[] = [
  { href: "/species/", key: "directory" },
  { href: "/map/", key: "map" },
  { href: "/dashboard/", key: "dashboard" },
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
  const [dashboard, heroAsset, t, tCommon] = await Promise.all([
    fetchDashboard(),
    fetchSiteMapAsset("hero_thumb"),
    getTranslations("home"),
    getTranslations("common"),
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
          <p style={EYEBROW_STYLE}>{t("hero.eyebrow")}</p>
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
            {t("hero.title")}
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
            {t("hero.subtitle")}
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
                  {tCommon("coverageGap.eyebrow")}
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
                  {tCommon.rich("coverageGap.body", {
                    withoutCaptive:
                      gap.threatened_species_without_captive_population.toLocaleString(),
                    total: gap.threatened_species_total.toLocaleString(),
                    gap: (chunks) => (
                      <span
                        style={{
                          fontSize: 40,
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {chunks}
                      </span>
                    ),
                    ts: (chunks) => (
                      <span
                        style={{
                          fontSize: 26,
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--accent-2)",
                  }}
                >
                  {tCommon("coverageGap.seeWhich")}
                </p>
              </>
            ) : (
              <p
                data-testid="coverage-gap-fallback"
                style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}
              >
                {tCommon("coverageGap.fallback")}
              </p>
            )}
          </Link>
        </section>

        {hasIucn ? (
          <section>
            <p style={EYEBROW_STYLE}>{t("redListSection.eyebrow")}</p>
            <h2 style={SECTION_H2_STYLE}>{t("redListSection.title")}</h2>
            <div style={{ marginTop: 20 }}>
              <IucnChart
                counts={iucnCounts}
                caption={t("redListSection.chartCaption")}
              />
            </div>
          </section>
        ) : null}

        <nav aria-label={t("exploreSection.ariaLabel")}>
          <p style={EYEBROW_STYLE}>{t("exploreSection.eyebrow")}</p>
          <h2 style={SECTION_H2_STYLE}>{t("exploreSection.title")}</h2>
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
                  <span style={EYEBROW_STYLE}>{t(`navCards.${card.key}.eyebrow`)}</span>
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 20,
                      fontWeight: 600,
                      color: "var(--ink)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {t(`navCards.${card.key}.title`)}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "var(--ink-2)",
                    }}
                  >
                    {t(`navCards.${card.key}.description`)}
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
                    {t("exploreSection.openLink")}
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
