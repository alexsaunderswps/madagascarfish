import dynamic from "next/dynamic";

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
      <MapClient initialData={data} />
    </main>
  );
}
