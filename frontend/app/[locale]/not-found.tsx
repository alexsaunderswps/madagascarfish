import Link from "next/link";

import EmptyState from "@/components/EmptyState";

export const metadata = {
  title: "Page not found — Madagascar Freshwater Fish",
};

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <EmptyState
        title="Page not found"
        body="This address does not match any page on the platform. The link may be out of date, or the page may have moved."
        primaryAction={{ href: "/", label: "Return home" }}
        secondaryAction={{ href: "/species/", label: "Browse all species" }}
      />
      <p className="mt-6 text-center text-sm text-slate-500">
        Looking for a specific species?{" "}
        <Link href="/species/" className="text-sky-700 underline underline-offset-2 hover:text-sky-900">
          Try the directory search.
        </Link>
      </p>
    </main>
  );
}
