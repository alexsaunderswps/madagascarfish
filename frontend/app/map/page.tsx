import dynamic from "next/dynamic";

import EmptyState from "@/components/EmptyState";
import MapListView from "@/components/MapListView";
import MapViewToggle, { type MapView } from "@/components/MapViewToggle";
import { fetchLocalities } from "@/lib/mapLocalities";

export const revalidate = 3600;

export const metadata = {
  title: "Distribution Map — Madagascar Freshwater Fish",
  description:
    "Locality records for endemic freshwater fish across Madagascar, color-coded by IUCN Red List category. Exact coordinates for threatened species are generalized per GBIF sensitive-species guidance.",
};

const MapClient = dynamic(() => import("@/components/MapClient"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "calc(100vh - 8rem)",
        minHeight: 500,
        width: "100%",
        backgroundColor: "var(--bg-sunken)",
        color: "var(--ink-3)",
        fontSize: 14,
      }}
    >
      Loading map…
    </div>
  ),
});

export default async function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const speciesIdRaw = searchParams.species_id;
  const speciesId = Array.isArray(speciesIdRaw) ? speciesIdRaw[0] : speciesIdRaw;

  const viewRaw = searchParams.view;
  const viewParam = Array.isArray(viewRaw) ? viewRaw[0] : viewRaw;
  const view: MapView = viewParam === "list" ? "list" : "map";

  const data = await fetchLocalities(speciesId ? { species_id: speciesId } : {});

  if (!data) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 24px",
        }}
      >
        <EmptyState
          title="Map data temporarily unavailable"
          body="The locality data service is unreachable. Try again in a moment, or browse the species directory for profile and conservation details."
          primaryAction={{ href: "/map/", label: "Try again" }}
          secondaryAction={{ href: "/species/", label: "Browse all species" }}
        />
      </main>
    );
  }

  if (data.features.length === 0) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 24px",
        }}
      >
        <EmptyState
          title="No locality records to map"
          body={
            speciesId
              ? "No public locality records are available for this species. Exact coordinates for threatened species are restricted to coordinator-tier accounts; the species profile still lists conservation status and other details."
              : "No locality records are currently published. The species directory lists every species in the registry, whether or not their localities are mapped."
          }
          primaryAction={{ href: "/species/", label: "Browse all species" }}
        />
      </main>
    );
  }

  const focusLocalityRaw = searchParams.focus_locality;
  const focusLocalityId = Array.isArray(focusLocalityRaw) ? focusLocalityRaw[0] : focusLocalityRaw;

  const filterSpeciesName = speciesId
    ? data.features[0]?.properties.scientific_name ?? null
    : null;

  const clearHref = view === "list" ? "/map/?view=list" : "/map/";
  const count = data.features.length;

  return (
    <main>
      <h1 className="sr-only">Distribution Map</h1>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 24px",
          borderBottom: "1px solid var(--rule)",
          backgroundColor: "var(--bg-raised)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--sans)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            Distribution Map
          </p>
          <span
            style={{
              fontSize: 13,
              color: "var(--ink-2)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {count.toLocaleString()} locality record{count === 1 ? "" : "s"}
          </span>
          {speciesId ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                color: "var(--ink)",
                backgroundColor:
                  "color-mix(in oklab, var(--accent-2) 10%, var(--bg))",
                border:
                  "1px solid color-mix(in oklab, var(--accent-2) 30%, var(--rule))",
              }}
            >
              <span>
                Filtered to{" "}
                <em style={{ fontWeight: 600, fontStyle: "normal" }}>
                  {filterSpeciesName ?? `species #${speciesId}`}
                </em>
              </span>
              <a
                href={clearHref}
                aria-label="Clear species filter and show all locality records"
                style={{
                  fontWeight: 600,
                  color: "var(--accent-2)",
                  textDecoration: "none",
                  borderBottom:
                    "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
                }}
              >
                Clear
              </a>
            </span>
          ) : null}
        </div>
        <MapViewToggle current={view} searchParams={searchParams} />
      </div>
      <p
        id="map-keyboard-hint"
        style={{
          margin: 0,
          padding: "8px 24px",
          fontSize: 12,
          color: "var(--ink-3)",
          backgroundColor: "var(--bg-sunken)",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        For keyboard and screen-reader access, switch to the list view using the toggle above.
      </p>
      {view === "list" ? (
        <MapListView data={data} />
      ) : (
        <div
          aria-describedby="map-keyboard-hint"
          style={{ display: "contents" }}
        >
          <MapClient initialData={data} focusLocalityId={focusLocalityId ?? null} />
        </div>
      )}
    </main>
  );
}
