import { Link } from "@/i18n/routing";
import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How we handle the data — Madagascar Freshwater Fish Conservation Platform",
  description:
    "Where the platform's species data comes from, how conservation status is mirrored from IUCN, how sensitive locations are generalized, and the limitations we are honest about.",
};

export const revalidate = 3600;

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
  fontSize: 22,
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

const LIST_STYLE: CSSProperties = {
  ...BODY_STYLE,
  margin: 0,
  paddingLeft: 20,
  display: "flex",
  flexDirection: "column",
  gap: 8,
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

export default function DataHandlingPage() {
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
            <Link href="/about/" style={{ color: "inherit", textDecoration: "none" }}>
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
            How we handle the data
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
            The platform aggregates from authoritative upstream sources and
            tries to be explicit about provenance, limitations, and what is
            deliberately not public. This page explains how.
          </p>
        </div>
      </section>

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "48px 32px 96px",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <Section eyebrow="Sources" title="Where species data comes from">
          <p style={BODY_STYLE}>
            The registry combines records from several upstream sources, each
            authoritative for a different slice of the picture:
          </p>
          <ul style={LIST_STYLE}>
            <li>
              <strong>IUCN Red List</strong> — the source of record for
              conservation assessments (category, criteria, assessment date,
              assessors).
            </li>
            <li>
              <strong>FishBase</strong> — ecological and morphological data
              (habitat, maximum length, diet notes).
            </li>
            <li>
              <strong>GBIF</strong> — occurrence records (georeferenced
              observations and museum specimens) published under Darwin Core.
            </li>
            <li>
              <strong>CARES</strong> — the Conservation, Awareness, Recognition
              and Encouragement for Species priority list maintained by the
              fishkeeping-hobbyist community, distinct from the IUCN Red List
              and focused on species held in private breeding programs.
            </li>
            <li>
              <strong>SHOAL 1,000 Fishes Blueprint</strong> — global priority
              alignment for freshwater fish conservation.
            </li>
            <li>
              <strong>Expert contributions</strong> — named researchers and
              keepers who have published or shared records for Malagasy
              endemics. Individual contributors are credited on the records
              they informed.
            </li>
          </ul>
        </Section>

        <Section
          eyebrow="Policy"
          title="Conservation status is mirrored, not edited"
        >
          <p style={BODY_STYLE}>
            The IUCN category shown on every species profile is a mirror of
            the most recent accepted assessment for that species. The platform
            does not hand-edit the badge. When a new IUCN assessment is
            ingested, the mirror updates; when no assessment exists, the
            profile reads &quot;not yet assessed&quot; rather than showing a
            stale category.
          </p>
          <p style={BODY_STYLE}>
            Manual expert input is supported, but only by creating a new
            assessment record with an assessor, date, and reasoning — the same
            path IUCN data takes. If a human-reviewed assessment disagrees
            with an incoming IUCN assessment, the conflict is flagged for
            review rather than silently overwritten. One source of truth,
            auditable back to the assessment record.
          </p>
        </Section>

        <Section eyebrow="Geography" title="How coordinates are handled">
          <p style={BODY_STYLE}>
            Occurrence records for non-sensitive species are shown with their
            original coordinates. For species assessed as threatened
            (Critically Endangered, Endangered, or Vulnerable), coordinates
            are generalized to roughly 0.1 degrees — about 11 km at the
            equator — following GBIF&apos;s sensitive-species best practices.
            This obscures exact localities while preserving the overall
            distribution pattern, which is what the public map is for.
          </p>
          <p style={BODY_STYLE}>
            Exact coordinates for sensitive species are available to
            conservation coordinator accounts (Tier 3) and above, for the
            organizations coordinating field work and transfers. The rationale
            is straightforward: small, range-restricted populations have been
            targeted by collectors in the past, and obscuring the precise pin
            is a cheap and effective protection.
          </p>
        </Section>

        <Section eyebrow="Caveats" title="Known limitations">
          <p style={BODY_STYLE}>
            The upstream record is imperfect, and the platform does not
            pretend otherwise.
          </p>
          <ul style={LIST_STYLE}>
            <li>
              <strong>Transcription errors in source records.</strong> A small
              number of GBIF occurrences place Madagascar endemics in the
              Indian Ocean, on the wrong coast, or in other countries
              entirely. These are almost always data-entry or georeferencing
              errors in the source. The platform flags suspect records for
              admin review rather than silently dropping them; corrected
              records are published back where possible.
            </li>
            <li>
              <strong>Undescribed species.</strong> Madagascar&apos;s
              freshwater fish fauna includes morphospecies awaiting formal
              description. These appear in the registry under provisional
              names (for example,{" "}
              <em>Ptychochromis sp. &quot;Tsimembo&quot;</em>) with a status
              of &quot;not yet assessed.&quot; They are real species that
              keepers and researchers are working on; leaving them out would
              misrepresent the fauna.
            </li>
            <li>
              <strong>Introduced species.</strong> Introduced and invasive
              species in Malagasy waters (tilapia, gambusia, and others) are
              hidden from the directory by default to keep the focus on
              endemics. They can be surfaced with a filter toggle, because
              they are part of the ecological picture even when they are not
              the subject of conservation effort.
            </li>
            <li>
              <strong>Sparse husbandry data.</strong> For many species,
              published keeping and breeding guidance is thin or absent.
              Profiles say so plainly rather than inventing content.
            </li>
          </ul>
        </Section>

        <Section eyebrow="Access" title="What is not public">
          <p style={BODY_STYLE}>
            Some data is deliberately behind tier-gated accounts:
          </p>
          <ul style={LIST_STYLE}>
            <li>Exact coordinates for sensitive (threatened) species.</li>
            <li>
              Per-institution captive inventory detail from ZIMS and partner
              records (public view shows aggregates only).
            </li>
            <li>
              Breeding-program genetics, studbook-level data, and transfer
              recommendations.
            </li>
            <li>Contact information for individual keepers and researchers.</li>
          </ul>
          <p style={BODY_STYLE}>
            Access is granted by the platform operator on request to qualified
            individuals at partner organizations.
          </p>
        </Section>

        <Section eyebrow="Interop" title="Standards alignment">
          <p style={BODY_STYLE}>
            Occurrence data is modeled against the Darwin Core standard, which
            is the biodiversity community&apos;s shared vocabulary for species
            records. Publication of the platform&apos;s datasets to GBIF via
            an Integrated Publishing Toolkit (IPT) instance is planned after
            the MVP. IUCN categories, assessment criteria, and CARES priority
            status are carried through without re-interpretation.
          </p>
        </Section>

        <Section eyebrow="Feedback" title="Questions or corrections">
          <p style={BODY_STYLE}>
            If you see a record that looks wrong, or you have data that
            should be here and is not, the{" "}
            <Link href="/about/" style={LINK_STYLE}>
              About page
            </Link>{" "}
            has contact and repository links. Corrections are welcomed and
            credited.
          </p>
        </Section>
      </main>
    </>
  );
}
