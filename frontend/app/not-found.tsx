import EmptyState from "@/components/EmptyState";

export const metadata = {
  title: "Page not found — Madagascar Freshwater Fish",
};

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <EmptyState
        title="Page not found"
        body="This link doesn't match anything on the platform. It may have moved, or the URL may be out of date."
        primaryAction={{ href: "/", label: "Return home" }}
        secondaryAction={{ href: "/species/", label: "Browse all species" }}
      />
    </main>
  );
}
