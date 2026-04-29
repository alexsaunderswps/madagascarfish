import type { Metadata } from "next";

import DirectoryDensityControl from "@/components/DirectoryDensityControl";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import SpeciesCard from "@/components/SpeciesCard";
import SpeciesFilters from "@/components/SpeciesFilters";
import type { Locale } from "@/i18n/routing";
import { fetchDashboard } from "@/lib/dashboard";
import { fetchGenusSilhouette } from "@/lib/genusSilhouette";
import { buildAlternates } from "@/lib/seo";
import {
  EMPTY_PAGE,
  IUCN_LABELS,
  PAGE_SIZE,
  fetchSpeciesListSafe,
  parseDensity,
  parseSpeciesFilterState,
  type IucnStatus,
  type SpeciesFilterState,
} from "@/lib/species";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Species Directory — Madagascar Freshwater Fish",
    description:
      "Browse endemic freshwater fish species of Madagascar. Filter by IUCN Red List category, family, and captive-population coverage.",
    alternates: buildAlternates("/species", locale),
  };
}

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

/**
 * Build a human-readable summary of the filters that produced an empty
 * directory result. Matches the conservation-writer voice rule that empty
 * states should name the constraint, not just say "no results".
 */
function describeActiveFilters(state: SpeciesFilterState): string[] {
  const parts: string[] = [];
  if (state.search) parts.push(`search "${state.search}"`);
  if (state.iucn_status && state.iucn_status.length > 0) {
    const labels = state.iucn_status.map(
      (s) => IUCN_LABELS[s as IucnStatus] ?? s,
    );
    parts.push(`IUCN ${labels.join(" / ")}`);
  }
  if (state.family) parts.push(`family ${state.family}`);
  if (state.taxonomic_status === "undescribed_morphospecies") {
    parts.push("undescribed morphospecies only");
  } else if (state.taxonomic_status === "described") {
    parts.push("described species only");
  }
  if (state.has_cares === "true") parts.push("CARES priority");
  if (state.shoal_priority === "true") parts.push("SHOAL priority");
  if (state.has_captive_population === "true") {
    parts.push("with a captive population");
  } else if (state.has_captive_population === "false") {
    parts.push("without a captive population");
  }
  if (state.include_introduced === "true") parts.push("including introduced");
  return parts;
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
  const filterSummary = filtered ? describeActiveFilters(state) : [];

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
                body="The species data service is unreachable right now. The registry is unchanged — try again in a moment."
                primaryAction={{ href: "/species/", label: "Try again" }}
              />
            ) : (
              <EmptyState
                title="No species match these filters"
                body={
                  filtered ? (
                    <>
                      Active filters: {filterSummary.join(", ")}. Of{" "}
                      {counts?.total ?? "the"} species in the registry, none
                      currently match. Clear one or more filters to widen the
                      search.
                    </>
                  ) : (
                    "No species are currently listed."
                  )
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
