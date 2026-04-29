import { Link } from "@/i18n/routing";

/**
 * Gate 09 placeholder for the Gate 10 husbandry contribute form.
 *
 * Spec §Sequencing (gate-09-husbandry-frontend.md): if Gate 10 slips, this
 * route renders a "coming soon" message with the mailto fallback. The demo
 * requires the CTA to be **present** as a visible frame — not functional.
 */
export const metadata = {
  title: "Contribute husbandry updates — Madagascar Freshwater Fish",
};

export default function ContributeHusbandryStub({
  searchParams,
}: {
  searchParams: { species?: string };
}) {
  const speciesId = searchParams.species;
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-2xl text-slate-900">Contribute husbandry updates</h1>
      <p className="mt-4 text-slate-700">
        The contribution form is not yet live. In the meantime, please email{" "}
        <a
          href={`mailto:alex.saunders@wildlifeprotectionsolutions.org?subject=${encodeURIComponent(
            speciesId
              ? `Husbandry update — species ${speciesId}`
              : "Husbandry update",
          )}`}
          className="text-sky-700 hover:underline"
        >
          alex.saunders@wildlifeprotectionsolutions.org
        </a>{" "}
        with your corrections or additional content. Reference the species URL
        so we can route the update to the right record.
      </p>
      {speciesId ? (
        <p className="mt-6 text-sm">
          <Link
            href={`/species/${speciesId}/husbandry/`}
            className="text-sky-700 hover:underline"
          >
            ← Back to husbandry page
          </Link>
        </p>
      ) : null}
    </main>
  );
}
