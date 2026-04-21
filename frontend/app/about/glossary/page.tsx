import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";

import type { IucnStatus } from "@/lib/species";

export const metadata: Metadata = {
  title: "Glossary — Madagascar Freshwater Fish Conservation Platform",
  description:
    "Definitions of IUCN categories, CARES, SHOAL, Darwin Core, GBIF, ex-situ / in-situ, studbook, and endemic as used on this platform.",
};

interface Entry {
  term: string;
  iucnCode?: IucnStatus;
  definition: ReactNode;
}

const ENTRIES: Entry[] = [
  {
    term: "CARES",
    definition: (
      <>
        The Conservation, Awareness, Recognition, and Encouragement for
        Species program — a hobbyist-led priority list for freshwater fishes
        whose wild populations need ex-situ backup. Used on this platform to
        flag species that are prioritized by the aquarium-keeping community;
        distinct from the IUCN Red List assessment.
      </>
    ),
  },
  {
    term: "Critically Endangered (CR)",
    iucnCode: "CR",
    definition: (
      <>
        IUCN Red List category for species facing an extremely high risk of
        extinction in the wild. On this platform, CR is the most severe
        assessed category displayed.
      </>
    ),
  },
  {
    term: "Data Deficient (DD)",
    iucnCode: "DD",
    definition: (
      <>
        IUCN Red List category for species with inadequate information to
        make a direct or indirect assessment of extinction risk. Not a
        category of lower concern — a DD species may well be threatened.
      </>
    ),
  },
  {
    term: "Darwin Core",
    definition: (
      <>
        The biodiversity data standard maintained by TDWG and used by GBIF
        for occurrence records. This platform stores occurrence data in
        Darwin Core–compliant form and can publish it to GBIF as a Darwin
        Core Archive.
      </>
    ),
  },
  {
    term: "Endangered (EN)",
    iucnCode: "EN",
    definition: (
      <>
        IUCN Red List category for species facing a very high risk of
        extinction in the wild, one tier below Critically Endangered.
      </>
    ),
  },
  {
    term: "Endemic",
    definition: (
      <>
        Found only in a given area and nowhere else. For this platform, all
        species in the registry are endemic to Madagascar — native to the
        island&apos;s freshwater systems and not naturally occurring
        elsewhere.
      </>
    ),
  },
  {
    term: "Ex-situ",
    definition: (
      <>
        Conservation activity that takes place outside a species&apos;
        natural habitat — for example, captive breeding at a zoo, public
        aquarium, or private hobbyist facility. Contrast with in-situ.
      </>
    ),
  },
  {
    term: "GBIF",
    definition: (
      <>
        The Global Biodiversity Information Facility — an international
        network and data infrastructure that aggregates species occurrence
        records. This platform can publish locality data to GBIF via Darwin
        Core Archives.
      </>
    ),
  },
  {
    term: "In-situ",
    definition: (
      <>
        Conservation activity that takes place within a species&apos; natural
        habitat — field surveys, habitat restoration, community-managed
        protected areas. Contrast with ex-situ.
      </>
    ),
  },
  {
    term: "Least Concern (LC)",
    iucnCode: "LC",
    definition: (
      <>
        IUCN Red List category for species that have been evaluated and do
        not qualify for a threatened category. Among Madagascar&apos;s
        endemic freshwater fish, very few species reach LC.
      </>
    ),
  },
  {
    term: "Near Threatened (NT)",
    iucnCode: "NT",
    definition: (
      <>
        IUCN Red List category for species close to qualifying for, or
        likely to qualify for, a threatened category in the near future.
      </>
    ),
  },
  {
    term: "Not Evaluated (NE) / not yet assessed",
    iucnCode: "NE",
    definition: (
      <>
        A species that has not been evaluated against the IUCN Red List
        criteria. Public profiles on this platform display &quot;not yet
        assessed&quot; rather than a category abbreviation; the NE code
        appears only in space-constrained contexts such as badges and map
        legends.
      </>
    ),
  },
  {
    term: "SHOAL",
    definition: (
      <>
        A global conservation initiative focused on freshwater species. Its
        1,000 Fishes Blueprint identifies priority species for coordinated
        action; species flagged as SHOAL priorities are marked on their
        profile here.
      </>
    ),
  },
  {
    term: "Studbook",
    definition: (
      <>
        A structured record of pedigree, demographics, and transfer history
        for a captive population of a single species. Used to manage genetic
        diversity and demographic viability across institutions.
        Studbook-level data on this platform is restricted to program-manager
        accounts.
      </>
    ),
  },
  {
    term: "Threatened",
    definition: (
      <>
        Shorthand for the combined set of Critically Endangered, Endangered,
        and Vulnerable IUCN categories. Does not include Near Threatened.
      </>
    ),
  },
  {
    term: "Vulnerable (VU)",
    iucnCode: "VU",
    definition: (
      <>
        IUCN Red List category for species facing a high risk of extinction
        in the wild, one tier below Endangered.
      </>
    ),
  },
  {
    term: "ZIMS",
    definition: (
      <>
        The Zoological Information Management System, operated by Species360.
        It is the standard record system for captive animal populations at
        accredited zoos and aquariums. This platform references ZIMS records
        where partner institutions have shared access.
      </>
    ),
  },
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

export default function GlossaryPage() {
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
              ← About
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
            Glossary
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
            Terms used across the platform, defined for a
            conservation-professional audience. IUCN Red List categories are
            listed individually; the full category hierarchy and criteria are
            documented by the IUCN.
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
            return (
              <div
                key={entry.term}
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
                    {entry.term}
                  </dt>
                  <dd
                    style={{
                      margin: "6px 0 0",
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "var(--ink-2)",
                    }}
                  >
                    {entry.definition}
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
