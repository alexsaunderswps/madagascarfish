import dynamic from "next/dynamic";

import EmptyState from "@/components/EmptyState";
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
        <EmptyState
          title="Map temporarily unavailable"
          body="The locality data service is unreachable. Please try again shortly, or use the species directory for a text-based view."
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
              ? "This species has no public locality records. Try the directory for profile and conservation details."
              : "No locality records are currently published. The directory lists every species regardless of mapped localities."
          }
          primaryAction={{ href: "/species/", label: "Browse all species" }}
        />
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
