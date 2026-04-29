import EmptyState from "@/components/EmptyState";

export default function SpeciesNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <EmptyState
        title="Species not found"
        body="No species in the directory matches this identifier. It may have been merged with a related taxon, or the link may be out of date."
        primaryAction={{ href: "/species/", label: "Browse all species" }}
      />
    </main>
  );
}
