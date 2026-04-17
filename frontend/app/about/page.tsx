import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Madagascar Freshwater Fish Conservation Platform",
  description:
    "About the Madagascar Freshwater Fish Conservation Platform: ownership, source code, and citations.",
};

const REPO_URL = "https://github.com/alexsaunderswps/madagascarfish";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
        About
      </h1>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Project</h2>
        <p>
          An open-source platform for Madagascar&apos;s ~79 endemic freshwater
          fish — the island&apos;s most imperiled vertebrate group. Combines
          public species profiles, ex-situ breeding coordination, field program
          tracking, and cross-sector networking between zoos, researchers, and
          hobbyist breeders.
        </p>
        <p>
          Designed to complement existing systems (ZIMS, IUCN Red List,
          FishBase, GBIF) rather than replace them.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Ownership</h2>
        <p>
          Maintained by Aleksei Saunders (Wildlife Protection Solutions). Source
          code:{" "}
          <a
            href={REPO_URL}
            className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
            target="_blank"
            rel="noreferrer"
          >
            github.com/alexsaunderswps/madagascarfish
          </a>
          . Licensed Apache-2.0.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Citations</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Leiss, A., et al. (2022). The extinction crisis of Madagascar&apos;s
            freshwater fishes.
          </li>
          <li>
            IUCN. Red List of Threatened Species. Version consulted at build
            time.
          </li>
          <li>
            SHOAL. 1,000 Fishes Blueprint — global conservation priorities for
            freshwater fishes.
          </li>
        </ul>
      </section>
    </main>
  );
}
