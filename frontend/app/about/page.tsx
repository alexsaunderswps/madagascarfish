import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Madagascar Freshwater Fish Conservation Platform",
  description:
    "About the Madagascar Freshwater Fish Conservation Platform: mission, data sources, ownership, and citations.",
};

const REPO_URL = "https://github.com/alexsaunderswps/madagascarfish";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
        About
      </h1>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Why this platform exists</h2>
        <p>
          Madagascar&apos;s freshwater fish are the most imperiled vertebrate
          group on the island. Of the roughly 79 described and undescribed
          endemic species, the majority are assessed as threatened on the IUCN
          Red List, and a significant share have no known captive population to
          serve as a demographic safety net. Coordination across the
          institutions working on these species — zoos, aquariums, academic
          researchers, hobbyist breeders, and in-country field programs — has
          historically relied on email threads, personal networks, and
          one-off spreadsheets.
        </p>
        <p>
          This platform is a single, open record of what is known: which
          species exist, how they are assessed, where they have been observed,
          and which institutions hold captive populations. It aggregates from
          authoritative upstream sources rather than competing with them, and
          publishes back to them (via Darwin Core Archives) where the data
          flow is appropriate.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">What the platform does</h2>
        <p>
          Public profiles cover every endemic species in the registry,
          including undescribed morphospecies that do not yet appear on the
          IUCN Red List. Conservation status mirrors the most recent accepted
          assessment; species with no assessment are marked &quot;not yet
          assessed&quot; rather than given a stale category. The distribution
          map shows locality records generalized per GBIF sensitive-species
          protocols; exact coordinates for threatened species are restricted
          to coordinator-tier accounts to protect wild populations.
        </p>
        <p>
          Restricted tiers support ex-situ breeding coordination, transfer
          recommendations, and studbook-level data for registered partners.
          Those features are not visible on the public site.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Data sources</h2>
        <p>
          Species and assessment data are pulled from the IUCN Red List and
          FishBase. Occurrence records follow the Darwin Core standard and can
          be published to GBIF. Captive-population figures are entered by
          partner institutions and, where available, reconciled with ZIMS
          (Species360). Priority lists from SHOAL (1,000 Fishes Blueprint) and
          CARES inform filtering and sort order but do not override IUCN
          categories.
        </p>
        <p>
          Definitions of IUCN categories, CARES, Darwin Core, and other
          terminology used across the site are collected in the{" "}
          <Link href="/about/glossary/" className="text-sky-700 underline underline-offset-2 hover:text-sky-900">
            glossary
          </Link>
          .
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Ownership</h2>
        <p>
          Maintained by Aleksei Saunders (Wildlife Protection Solutions).
          Long-term stewardship is under discussion with partner organizations.
          Source code:{" "}
          <a
            href={REPO_URL}
            className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
            target="_blank"
            rel="noreferrer"
          >
            github.com/alexsaunderswps/madagascarfish
          </a>
          . Licensed Apache-2.0.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Citations</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Leiss, A., et al. (2022). The extinction crisis of Madagascar&apos;s
            freshwater fishes.
          </li>
          <li>
            IUCN. Red List of Threatened Species. Version consulted at build
            time; category and criteria mirrored from the most recent accepted
            assessment per species.
          </li>
          <li>
            SHOAL. 1,000 Fishes Blueprint — global conservation priorities for
            freshwater fishes.
          </li>
          <li>
            GBIF. Darwin Core Archive standard and sensitive-species
            coordinate-generalization guidance.
          </li>
        </ul>
      </section>
    </main>
  );
}
