import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";

import type { Locale } from "@/i18n/routing";
import { fetchDashboard } from "@/lib/dashboard";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "About — Madagascar Freshwater Fish Conservation Platform",
    description:
      "About the Madagascar Freshwater Fish Conservation Platform: mission, data sources, ownership, and citations.",
    alternates: buildAlternates("/about", locale),
  };
}

export const revalidate = 3600;

const REPO_URL = "https://github.com/alexsaunderswps/madagascarfish";
const ADMIN_URL = "https://api.malagasyfishes.org/admin/";

const EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const H2_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 24,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  lineHeight: 1.2,
};

const BODY_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.65,
  color: "var(--ink-2)",
};

const LINK_STYLE: CSSProperties = {
  color: "var(--accent-2)",
  textDecoration: "none",
  borderBottom:
    "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={EYEBROW_STYLE}>{eyebrow}</p>
      <h2 style={H2_STYLE}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

export default async function AboutPage() {
  const dashboard = await fetchDashboard();
  const speciesTotal = dashboard?.species_counts.total ?? null;

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
            padding: "64px 32px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <p style={EYEBROW_STYLE}>About</p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--serif)",
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
              lineHeight: 1.15,
            }}
          >
            A shared record of Madagascar&rsquo;s endemic freshwater fish.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              maxWidth: 720,
            }}
          >
            An open platform for species profiles, ex-situ breeding
            coordination, and field program tracking — built to complement
            IUCN, GBIF, FishBase, and ZIMS, not replace them.
          </p>
        </div>
      </section>

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "56px 32px 96px",
          display: "flex",
          flexDirection: "column",
          gap: 48,
        }}
      >
        <Section eyebrow="Mission" title="Why this platform exists">
          <p style={BODY_STYLE}>
            Madagascar&apos;s freshwater fish are the most imperiled vertebrate
            group on the island. Of the{" "}
            {speciesTotal !== null ? speciesTotal : "~79"} described and
            undescribed endemic species in the registry, the majority are
            assessed as threatened on the IUCN Red List, and a significant share
            have no known captive population to serve as a demographic safety
            net. Coordination across the institutions working on these species —
            zoos, aquariums, academic researchers, hobbyist breeders, and
            in-country field programs — has historically relied on email
            threads, personal networks, and one-off spreadsheets.
          </p>
          <p style={BODY_STYLE}>
            This platform is a single, open record of what is known: which
            species exist, how they are assessed, where they have been observed,
            and which institutions hold captive populations. It aggregates from
            authoritative upstream sources rather than competing with them, and
            publishes back to them (via Darwin Core Archives) where the data
            flow is appropriate.
          </p>
        </Section>

        <Section eyebrow="Scope" title="What the platform does">
          <p style={BODY_STYLE}>
            Public profiles cover every endemic species in the registry,
            including undescribed morphospecies that do not yet appear on the
            IUCN Red List. Conservation status mirrors the most recent accepted
            assessment; species with no assessment are marked &quot;not yet
            assessed&quot; rather than given a stale category. The distribution
            map shows locality records generalized per GBIF sensitive-species
            protocols; exact coordinates for threatened species are restricted
            to coordinator-tier accounts to protect wild populations.
          </p>
          <p style={BODY_STYLE}>
            Restricted tiers support ex-situ breeding coordination, transfer
            recommendations, and studbook-level data for registered partners.
            Those features are not visible on the public site.
          </p>
        </Section>

        <Section eyebrow="Provenance" title="Data sources">
          <p style={BODY_STYLE}>
            Species and assessment data are pulled from the IUCN Red List and
            FishBase. Occurrence records follow the Darwin Core standard and
            can be published to GBIF. Captive-population figures are entered by
            partner institutions and, where available, reconciled with ZIMS
            (Species360). Priority lists from SHOAL (1,000 Fishes Blueprint)
            and CARES inform filtering and sort order but do not override IUCN
            categories.
          </p>
          <p style={BODY_STYLE}>
            For a fuller account of provenance, the mirror policy for IUCN
            status, coordinate generalization, and known limitations, see{" "}
            <Link href="/about/data/" style={LINK_STYLE}>
              how we handle the data
            </Link>
            .
          </p>
          <p style={BODY_STYLE}>
            Definitions of IUCN categories, CARES, Darwin Core, and other
            terminology used across the site are collected in the{" "}
            <Link href="/about/glossary/" style={LINK_STYLE}>
              glossary
            </Link>
            .
          </p>
        </Section>

        <Section eyebrow="Stewardship" title="Ownership">
          <p style={BODY_STYLE}>
            Maintained by Aleksei Saunders (Wildlife Protection Solutions).
            Long-term stewardship is under discussion with partner
            organizations. Source code:{" "}
            <a
              href={REPO_URL}
              style={LINK_STYLE}
              target="_blank"
              rel="noreferrer"
            >
              github.com/alexsaunderswps/madagascarfish
            </a>
            . Licensed Apache-2.0.
          </p>
        </Section>

        <Section eyebrow="References" title="Citations">
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              ...BODY_STYLE,
            }}
          >
            <li>
              Leiss L, Rauhaus A, Rakotoarison A, Fusari C, Vences M, Ziegler T.
              Review of threatened Malagasy freshwater fishes in zoos and
              aquaria: The necessity of an ex situ conservation network — A
              call for action. <em>Zoo Biol.</em> 2022 May;41(3):244–262.{" "}
              <a
                href="https://doi.org/10.1002/zoo.21661"
                style={LINK_STYLE}
                target="_blank"
                rel="noreferrer"
              >
                doi:10.1002/zoo.21661
              </a>
              . PMID: 34870879; PMCID: PMC9299897.
            </li>
            <li>
              IUCN. Red List of Threatened Species. Version consulted at build
              time; category and criteria mirrored from the most recent
              accepted assessment per species.
            </li>
            <li>
              SHOAL. 1,000 Fishes Blueprint — global conservation priorities
              for freshwater fishes.
            </li>
            <li>
              GBIF. Darwin Core Archive standard and sensitive-species
              coordinate-generalization guidance.
            </li>
          </ul>
        </Section>

        <p
          style={{
            marginTop: 24,
            textAlign: "right",
            fontSize: 12,
            color: "var(--ink-3)",
          }}
        >
          <a href={ADMIN_URL} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
            Staff sign-in
          </a>
        </p>
      </main>
    </>
  );
}
