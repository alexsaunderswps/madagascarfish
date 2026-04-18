import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glossary — Madagascar Freshwater Fish Conservation Platform",
  description:
    "Definitions of IUCN categories, CARES, SHOAL, Darwin Core, GBIF, ex-situ / in-situ, studbook, and endemic as used on this platform.",
};

interface Entry {
  term: string;
  definition: React.ReactNode;
}

const ENTRIES: Entry[] = [
  {
    term: "CARES",
    definition: (
      <>
        The Conservation, Awareness, Recognition, and Encouragement for Species
        program — a hobbyist-led priority list for freshwater fishes whose
        wild populations need ex-situ backup. Used on this platform to flag
        species that are prioritized by the aquarium-keeping community;
        distinct from the IUCN Red List assessment.
      </>
    ),
  },
  {
    term: "Critically Endangered (CR)",
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
    definition: (
      <>
        IUCN Red List category for species with inadequate information to make
        a direct or indirect assessment of extinction risk. Not a category of
        lower concern — a DD species may well be threatened.
      </>
    ),
  },
  {
    term: "Darwin Core",
    definition: (
      <>
        The biodiversity data standard maintained by TDWG and used by GBIF for
        occurrence records. This platform stores occurrence data in Darwin
        Core–compliant form and can publish it to GBIF as a Darwin Core
        Archive.
      </>
    ),
  },
  {
    term: "Endangered (EN)",
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
        Conservation activity that takes place outside a species&apos; natural
        habitat — for example, captive breeding at a zoo, public aquarium, or
        private hobbyist facility. Contrast with in-situ.
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
    definition: (
      <>
        IUCN Red List category for species that have been evaluated and do not
        qualify for a threatened category. Among Madagascar&apos;s endemic
        freshwater fish, very few species reach LC.
      </>
    ),
  },
  {
    term: "Near Threatened (NT)",
    definition: (
      <>
        IUCN Red List category for species close to qualifying for, or likely
        to qualify for, a threatened category in the near future.
      </>
    ),
  },
  {
    term: "Not Evaluated (NE) / not yet assessed",
    definition: (
      <>
        A species that has not been evaluated against the IUCN Red List
        criteria. Public profiles on this platform display &quot;not yet
        assessed&quot; rather than a category abbreviation; the NE code appears
        only in space-constrained contexts such as badges and map legends.
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
        diversity and demographic viability across institutions. Studbook-level
        data on this platform is restricted to program-manager accounts.
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
    definition: (
      <>
        IUCN Red List category for species facing a high risk of extinction in
        the wild, one tier below Endangered.
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

export default function GlossaryPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm">
        <Link href="/about/" className="text-sky-700 hover:underline">
          ← About
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        Glossary
      </h1>
      <p className="mt-4 text-slate-700">
        Terms used across the platform, defined for a conservation-professional
        audience. IUCN Red List categories are listed individually; the full
        category hierarchy and criteria are documented by the IUCN.
      </p>

      <dl className="mt-8 space-y-6">
        {ENTRIES.map((entry) => (
          <div key={entry.term}>
            <dt className="font-semibold text-slate-900">{entry.term}</dt>
            <dd className="mt-1 text-sm text-slate-700">{entry.definition}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
