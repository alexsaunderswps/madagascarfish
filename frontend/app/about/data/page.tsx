import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How we handle the data — Madagascar Freshwater Fish Conservation Platform",
  description:
    "Where the platform's species data comes from, how conservation status is mirrored from IUCN, how sensitive locations are generalized, and the limitations we are honest about.",
};

export const revalidate = 3600;

export default function DataHandlingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
        How we handle the data
      </h1>
      <p className="mt-4 text-slate-700">
        The platform aggregates from authoritative upstream sources and tries
        to be explicit about provenance, limitations, and what is deliberately
        not public. This page explains how.
      </p>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Where species data comes from</h2>
        <p>
          The registry combines records from several upstream sources, each
          authoritative for a different slice of the picture:
        </p>
        <ul className="list-inside list-disc space-y-1">
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
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Conservation status is mirrored, not edited</h2>
        <p>
          The IUCN category shown on every species profile is a mirror of the
          most recent accepted assessment for that species. The platform does
          not hand-edit the badge. When a new IUCN assessment is ingested, the
          mirror updates; when no assessment exists, the profile reads &quot;not
          yet assessed&quot; rather than showing a stale category.
        </p>
        <p>
          Manual expert input is supported, but only by creating a new
          assessment record with an assessor, date, and reasoning — the same
          path IUCN data takes. If a human-reviewed assessment disagrees with
          an incoming IUCN assessment, the conflict is flagged for review
          rather than silently overwritten. One source of truth, auditable
          back to the assessment record.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">How coordinates are handled</h2>
        <p>
          Occurrence records for non-sensitive species are shown with their
          original coordinates. For species assessed as threatened (Critically
          Endangered, Endangered, or Vulnerable), coordinates are generalized
          to roughly 0.1 degrees — about 11 km at the equator — following
          GBIF&apos;s sensitive-species best practices. This obscures exact
          localities while preserving the overall distribution pattern, which
          is what the public map is for.
        </p>
        <p>
          Exact coordinates for sensitive species are available to
          conservation coordinator accounts (Tier 3) and above, for the
          organizations coordinating field work and transfers. The rationale
          is straightforward: small, range-restricted populations have been
          targeted by collectors in the past, and obscuring the precise pin
          is a cheap and effective protection.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Known limitations</h2>
        <p>
          The upstream record is imperfect, and the platform does not pretend
          otherwise.
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>Transcription errors in source records.</strong> A small
            number of GBIF occurrences place Madagascar endemics in the
            Indian Ocean, on the wrong coast, or in other countries entirely.
            These are almost always data-entry or georeferencing errors in
            the source. The platform flags suspect records for admin review
            rather than silently dropping them; corrected records are
            published back where possible.
          </li>
          <li>
            <strong>Undescribed species.</strong> Madagascar&apos;s freshwater
            fish fauna includes morphospecies awaiting formal description.
            These appear in the registry under provisional names (for
            example, <em>Ptychochromis sp. &quot;Tsimembo&quot;</em>) with a
            status of &quot;not yet assessed.&quot; They are real species
            that keepers and researchers are working on; leaving them out
            would misrepresent the fauna.
          </li>
          <li>
            <strong>Introduced species.</strong> Introduced and invasive
            species in Malagasy waters (tilapia, gambusia, and others) are
            hidden from the directory by default to keep the focus on
            endemics. They can be surfaced with a filter toggle, because they
            are part of the ecological picture even when they are not the
            subject of conservation effort.
          </li>
          <li>
            <strong>Sparse husbandry data.</strong> For many species,
            published keeping and breeding guidance is thin or absent.
            Profiles say so plainly rather than inventing content.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">What is not public</h2>
        <p>
          Some data is deliberately behind tier-gated accounts:
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>Exact coordinates for sensitive (threatened) species.</li>
          <li>Per-institution captive inventory detail from ZIMS and partner records (public view shows aggregates only).</li>
          <li>Breeding-program genetics, studbook-level data, and transfer recommendations.</li>
          <li>Contact information for individual keepers and researchers.</li>
        </ul>
        <p>
          Access is granted by the platform operator on request to qualified
          individuals at partner organizations.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Standards alignment</h2>
        <p>
          Occurrence data is modeled against the Darwin Core standard, which
          is the biodiversity community&apos;s shared vocabulary for species
          records. Publication of the platform&apos;s datasets to GBIF via
          an Integrated Publishing Toolkit (IPT) instance is planned after
          the MVP. IUCN categories, assessment criteria, and CARES priority
          status are carried through without re-interpretation.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Questions or corrections</h2>
        <p>
          If you see a record that looks wrong, or you have data that should
          be here and is not, the{" "}
          <Link href="/about/" className="text-sky-700 underline underline-offset-2 hover:text-sky-900">
            About page
          </Link>{" "}
          has contact and repository links. Corrections are welcomed and
          credited.
        </p>
      </section>
    </main>
  );
}
