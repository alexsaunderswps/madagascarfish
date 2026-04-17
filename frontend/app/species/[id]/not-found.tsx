import EmptyState from "@/components/EmptyState";

export default function SpeciesNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <EmptyState
        title="Species not found"
        body="This species ID doesn't exist in our directory — it may have been merged with a related taxon, or the link is out of date."
        primaryAction={{ href: "/species/", label: "Browse all species" }}
      />
    </main>
  );
}
