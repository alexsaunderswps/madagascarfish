import dynamic from "next/dynamic";

import MapListView from "@/components/MapListView";
import MapViewToggle, { type MapView } from "@/components/MapViewToggle";
import { fetchLocalities } from "@/lib/mapLocalities";

export const revalidate = 3600;

export const metadata = {
  title: "Distribution Map — Madagascar Freshwater Fish",
  description:
    "Interactive map of endemic freshwater fish locality records across Madagascar. Color-coded by IUCN status.",
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
        <h1 className="text-2xl font-semibold text-slate-900">Distribution Map</h1>
        <p className="mt-4 text-slate-600">
          The map is temporarily unavailable because the data service is unreachable.
          Please try again shortly, or browse the{" "}
          <a href="/species/" className="text-sky-700 underline">
            species directory
          </a>{" "}
          for a text-based view.
        </p>
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
      {data.features.length === 0 ? (
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-slate-600">
            No locality records match the current filters.{" "}
            <a href="/species/" className="text-sky-700 underline">
              Browse the species directory
            </a>
            .
          </p>
        </div>
      ) : view === "list" ? (
        <MapListView data={data} />
      ) : (
        <MapClient initialData={data} />
      )}
    </main>
  );
}
