import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import SpeciesCard from "@/components/SpeciesCard";
import SpeciesFilters from "@/components/SpeciesFilters";
import { fetchDashboard } from "@/lib/dashboard";
import {
  EMPTY_PAGE,
  PAGE_SIZE,
  fetchSpeciesListSafe,
  parseSpeciesFilterState,
} from "@/lib/species";

export const revalidate = 3600;

export const metadata = {
  title: "Species Directory — Madagascar Freshwater Fish",
  description:
    "Browse endemic freshwater fish species of Madagascar. Filter by IUCN Red List category, family, and captive-population coverage.",
};

function hasAnyFilter(searchParams: Record<string, string | string[] | undefined>): boolean {
  const keys = [
    "search",
    "iucn_status",
    "family",
    "taxonomic_status",
    "cares_status",
    "endemic_status",
    "has_captive_population",
    "include_introduced",
  ];
  return keys.some((k) => {
    const v = searchParams[k];
    const val = Array.isArray(v) ? v[0] : v;
    return val != null && val !== "";
  });
}

export default async function SpeciesDirectoryPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const state = parseSpeciesFilterState(searchParams);
  const [listResult, dashboard] = await Promise.all([
    fetchSpeciesListSafe(state),
    fetchDashboard(),
  ]);
  const list = listResult ?? EMPTY_PAGE;
  const backendUnavailable = listResult === null;

  const counts = dashboard?.species_counts;
  const filtered = hasAnyFilter(searchParams);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="font-serif text-3xl text-slate-900">Species Directory</h1>
        {counts ? (
          <p className="mt-1 text-sm text-slate-600">
            {counts.total} endemic freshwater fish species
            {" "}({counts.described} described, {counts.undescribed} undescribed)
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Counts refreshing…</p>
        )}
        {filtered ? (
          <p className="mt-1 text-sm text-slate-700">
            <strong>{list.count}</strong> species match the current filters.
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside>
          <SpeciesFilters initial={state} />
        </aside>

        <section>
          {list.results.length === 0 ? (
            backendUnavailable ? (
              <EmptyState
                title="Species directory temporarily unavailable"
                body="The species data service is unreachable. Try again in a moment."
                primaryAction={{ href: "/species/", label: "Try again" }}
              />
            ) : (
              <EmptyState
                title="No species match the current filters"
                body={
                  filtered
                    ? "Clear one or more filters to widen the search, or browse the full directory."
                    : "No species are currently listed."
                }
                primaryAction={
                  filtered ? { href: "/species/", label: "Clear filters" } : undefined
                }
                secondaryAction={
                  filtered ? { href: "/species/", label: "Browse all species" } : undefined
                }
              />
            )
          ) : (
            <>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.results.map((sp) => (
                  <li key={sp.id}>
                    <SpeciesCard species={sp} />
                  </li>
                ))}
              </ul>
              <Pagination
                page={state.page ?? 1}
                totalCount={list.count}
                pageSize={PAGE_SIZE}
                searchParams={searchParams}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
