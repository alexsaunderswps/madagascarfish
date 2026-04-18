import dynamic from "next/dynamic";

import MapListView from "@/components/MapListView";
import MapViewToggle, { type MapView } from "@/components/MapViewToggle";
import EmptyState from "@/components/EmptyState";
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
      className="flex h-[calc(100vh-8rem)] min-h-[500px] w-full items-center justify-center bg-slate-50 text-sm text-slate-500"
      role="status"
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
      <main className="mx-auto max-w-3xl px-6 py-16">
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
      <main className="mx-auto max-w-3xl px-6 py-16">
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

  return (
    <main>
      <h1 className="sr-only">Distribution Map</h1>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <p className="text-sm text-slate-600">
          {data.features.length} locality record{data.features.length === 1 ? "" : "s"}
        </p>
        <MapViewToggle current={view} searchParams={searchParams} />
      </div>
      {view === "list" ? (
        <MapListView data={data} />
      ) : (
        <MapClient initialData={data} />
      )}
    </main>
  );
}
