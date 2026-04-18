import Link from "next/link";

/**
 * Sourcing ethics block for species husbandry pages.
 *
 * Public (Tier 1) copy. Intended to appear on every
 * `/species/[id]/husbandry/` page. Self-contained; no props at MVP.
 *
 * Voice decision (2026-04-18): takes a "responsible-collection-is-part-of-
 * conservation" stance rather than a blanket anti-wild-collection line.
 * See docs/planning/business-analysis/species-profile-husbandry.md.
 */
export default function HusbandrySourcingEthics() {
  return (
    <section
      aria-labelledby="sourcing-ethics-heading"
      className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-6"
    >
      <h2
        id="sourcing-ethics-heading"
        className="text-lg font-semibold text-slate-900"
      >
        Sourcing ethics
      </h2>

      <div className="mt-3 space-y-3 text-slate-700">
        <p>
          Keeping Malagasy freshwater fish in captivity is part of how these
          species survive. Habitat loss, introduced predators, and altered
          hydrology have reduced wild populations to the point that some
          species now depend on coordinated ex-situ (captive) programs for a
          demographic safety net. That work requires wild-sourced founders
          and, occasionally, genetic refreshment — it cannot be done from
          captive stock alone indefinitely.
        </p>

        <p>
          Responsible wild collection happens under permit, by programs
          working in partnership with Malagasy authorities and in-country
          researchers, usually tied to a specific institutional or CARES
          breeding plan. It is documented, reported, and accountable.
          Rescue collections after habitat-loss events — dam construction,
          wetland drainage, pollution incidents — have also been a source of
          founder stock for some of the most imperiled species. This is
          conservation work, not the aquarium trade.
        </p>

        <p>
          Hobbyists should not collect from the wild on trips or through
          informal exporters. Instead, source fish from CARES-registered
          breeders, Citizen Conservation, or partner institutions; document
          lineage where known; and share surplus fry back into the breeder
          network so founder genetics are preserved across multiple
          keepers. A well-distributed captive population is worth more to
          the species than any single tank of wild-caught fish.
        </p>

        <p className="text-sm text-slate-600">
          More on how the platform handles data, sources, and sensitive
          locations:{" "}
          <Link
            href="/about/data/"
            className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
          >
            how we handle the data
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
