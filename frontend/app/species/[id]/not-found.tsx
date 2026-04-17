import Link from "next/link";

export default function SpeciesNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl text-slate-900">Species not found</h1>
      <p className="mt-4 text-slate-600">
        This species ID doesn&apos;t exist in our directory — it may have been merged with a
        related taxon, or the link is out of date.
      </p>
      <Link
        href="/species"
        className="mt-6 inline-block rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
      >
        Browse all species
      </Link>
    </main>
  );
}
