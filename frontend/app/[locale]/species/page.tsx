import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations({ locale, namespace: "species.directory" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
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
 *
 * Receives a localized `t` function (under the `species.directory` namespace)
 * and a locale-aware IUCN label resolver so chip text translates per locale.
 */
function describeActiveFilters(
  state: SpeciesFilterState,
  t: (key: string, values?: Record<string, string | number>) => string,
  iucnLabel: (s: IucnStatus) => string,
): string[] {
  const parts: string[] = [];
  if (state.search) parts.push(t("activeFilters.search", { query: state.search }));
  if (state.iucn_status && state.iucn_status.length > 0) {
    const labels = state.iucn_status.map((s) => iucnLabel(s as IucnStatus));
    parts.push(t("activeFilters.iucn", { labels: labels.join(" / ") }));
  }
  if (state.family) parts.push(t("activeFilters.family", { family: state.family }));
  if (state.taxonomic_status === "undescribed_morphospecies") {
    parts.push(t("activeFilters.undescribedMorphospecies"));
  } else if (state.taxonomic_status === "described") {
    parts.push(t("activeFilters.describedOnly"));
  }
  if (state.has_cares === "true") parts.push(t("activeFilters.cares"));
  if (state.shoal_priority === "true") parts.push(t("activeFilters.shoal"));
  if (state.has_captive_population === "true") {
    parts.push(t("activeFilters.withCaptive"));
  } else if (state.has_captive_population === "false") {
    parts.push(t("activeFilters.withoutCaptive"));
  }
  if (state.include_introduced === "true") parts.push(t("activeFilters.includingIntroduced"));
  return parts;
}

export default async function SpeciesDirectoryPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const state = parseSpeciesFilterState(searchParams);
  const density = parseDensity(searchParams);
  const [listResult, dashboard, t, tCommon] = await Promise.all([
    fetchSpeciesListSafe(state),
    fetchDashboard(),
    getTranslations("species.directory"),
    getTranslations("common"),
  ]);
  const list = listResult ?? EMPTY_PAGE;
  const backendUnavailable = listResult === null;
  const iucnLabel = (s: IucnStatus): string => tCommon(`iucn.${s}`);

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
  const filterSummary = filtered ? describeActiveFilters(state, t, iucnLabel) : [];

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
            {t("title")}
          </h1>
          {counts ? (
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-2)" }}>
              {t("headerCounts", {
                total: counts.total,
                described: counts.described,
                undescribed: counts.undescribed,
              })}
            </p>
          ) : (
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>
              {t("headerCountsLoading")}
            </p>
          )}
          {filtered ? (
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink)" }}>
              {t.rich("matchCount", {
                count: list.count,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
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
                title={t("emptyStateBackendDown.title")}
                body={t("emptyStateBackendDown.body")}
                primaryAction={{ href: "/species/", label: t("emptyStateBackendDown.tryAgain") }}
              />
            ) : (
              <EmptyState
                title={t("emptyState.title")}
                body={
                  filtered
                    ? t("emptyState.bodyFiltered", {
                        filters: filterSummary.join(", "),
                        total: counts?.total ?? 0,
                      })
                    : t("emptyState.bodyUnfiltered")
                }
                primaryAction={
                  filtered ? { href: "/species/", label: t("emptyState.clearAction") } : undefined
                }
                secondaryAction={
                  filtered ? { href: "/species/", label: t("emptyState.browseAction") } : undefined
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
