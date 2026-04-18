import Link from "next/link";
import { fetchDashboard } from "@/lib/dashboard";

const COVERAGE_GAP_HREF =
  "/species/?iucn_status=CR,EN,VU&has_captive_population=false";

interface NavCard {
  href: string;
  title: string;
  description: string;
}

const NAV_CARDS: NavCard[] = [
  {
    href: "/species/",
    title: "Species Directory",
    description:
      "Browse endemic species. Filter by IUCN Red List category, family, or captive-population coverage.",
  },
  {
    href: "/map/",
    title: "Distribution Map",
    description:
      "Locality records across Madagascar's freshwater systems, color-coded by IUCN category.",
  },
  {
    href: "/dashboard/",
    title: "Conservation Dashboard",
    description:
      "Counts of species assessments, ex-situ coverage, and field programs, refreshed hourly.",
  },
];

export default async function HomePage() {
  const dashboard = await fetchDashboard();
  const gap = dashboard?.ex_situ_coverage;
  const hasStat =
    gap && typeof gap.threatened_species_without_captive_population === "number";

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <section className="flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
            Madagascar Freshwater Fish Conservation Platform
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            A shared record for Madagascar&apos;s endemic freshwater fish.
          </h1>
          <p className="max-w-3xl text-base text-slate-600 sm:text-lg">
            An open platform that brings together species profiles, ex-situ
            breeding coordination, and field program tracking for the roughly
            79 freshwater fish species found only in Madagascar. Built to
            complement IUCN, GBIF, FishBase, and ZIMS — not replace them.
          </p>
        </header>

        <Link
          href={COVERAGE_GAP_HREF}
          className="group block rounded-lg border border-amber-200 bg-amber-50 p-6 transition hover:border-amber-300 hover:bg-amber-100"
          data-testid="coverage-gap-stat"
        >
          {hasStat ? (
            <p className="text-lg font-medium text-amber-900 sm:text-xl">
              <span className="text-2xl font-semibold sm:text-3xl">
                {gap.threatened_species_without_captive_population.toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="text-2xl font-semibold sm:text-3xl">
                {gap.threatened_species_total.toLocaleString()}
              </span>{" "}
              threatened species have no known captive population.
              <span className="mt-2 block text-sm font-normal text-amber-800 underline-offset-2 group-hover:underline">
                See which species &rarr;
              </span>
            </p>
          ) : (
            <p className="text-base text-amber-900" data-testid="coverage-gap-fallback">
              Coverage statistics are refreshing. Counts will appear shortly.
            </p>
          )}
        </Link>

        <nav aria-label="Primary sections">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {NAV_CARDS.map((card) => (
              <li key={card.href}>
                <Link
                  href={card.href}
                  className="block h-full rounded-lg border border-slate-200 p-6 transition hover:border-sky-400 hover:bg-sky-50"
                >
                  <h2 className="text-lg font-semibold text-slate-900">
                    {card.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {card.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </main>
  );
}
