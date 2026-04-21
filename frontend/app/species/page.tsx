import DirectoryDensityControl from "@/components/DirectoryDensityControl";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import SpeciesCard from "@/components/SpeciesCard";
import SpeciesFilters from "@/components/SpeciesFilters";
import { fetchDashboard } from "@/lib/dashboard";
import { fetchGenusSilhouette } from "@/lib/genusSilhouette";
import {
  EMPTY_PAGE,
  PAGE_SIZE,
  fetchSpeciesListSafe,
  parseDensity,
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
    "shoal_priority",
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
  const density = parseDensity(searchParams);
  const [listResult, dashboard] = await Promise.all([
    fetchSpeciesListSafe(state),
    fetchDashboard(),
  ]);
  const list = listResult ?? EMPTY_PAGE;
  const backendUnavailable = listResult === null;

  // Fetch genus silhouettes once per unique genus in the result set so cards
  // can render the species → genus → placeholder cascade without N round-trips.
  const genusNames = Array.from(
    new Set(
      list.results
        .filter((sp) => !sp.silhouette_svg && sp.genus_fk?.has_silhouette === true)
        .map((sp) => sp.genus_fk!.name),
    ),
  );
  const genusEntries = await Promise.all(
    genusNames.map(async (name) => {
      const res = await fetchGenusSilhouette(name);
      return [name, res?.svg ?? null] as const;
    }),
  );
  const genusSilhouettes: Record<string, string> = {};
  for (const [name, svg] of genusEntries) {
    if (svg) genusSilhouettes[name] = svg;
  }

  const counts = dashboard?.species_counts;
  const filtered = hasAnyFilter(searchParams);

  // Density controls grid gap + card padding. "comfortable" ≈ current default,
  // "compact" tightens both so researchers can scan more rows in a viewport.
  const gridGap = density === "compact" ? 8 : 16;
  const cardDensity = density === "compact" ? "compact" : "default";

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px" }}>
      <header
        style={{
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, color: "var(--ink)", margin: 0 }}>
            Species Directory
          </h1>
          {counts ? (
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-2)" }}>
              {counts.total} endemic freshwater fish species ({counts.described} described,{" "}
              {counts.undescribed} undescribed)
            </p>
          ) : (
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>
              Species count is loading…
            </p>
          )}
          {filtered ? (
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink)" }}>
              <strong>{list.count}</strong> species match the current filters.
            </p>
          ) : null}
        </div>
        <DirectoryDensityControl density={density} />
      </header>

      <div
        style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns: "minmax(0, 18rem) minmax(0, 1fr)",
        }}
      >
        <SpeciesFilters initial={state} />

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
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: gridGap,
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                }}
              >
                {list.results.map((sp) => (
                  <li key={sp.id}>
                    <SpeciesCard
                      species={sp}
                      density={cardDensity}
                      genusSilhouettes={genusSilhouettes}
                    />
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
