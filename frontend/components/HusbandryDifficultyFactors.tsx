import { collectDifficultyFactors, type SpeciesHusbandry } from "@/lib/husbandry";

/**
 * Renders the seven `difficulty_*` factor fields as a descriptive list.
 * Elides blanks. NEVER renders a single aggregate label ("Beginner",
 * "Intermediate", "Advanced", "Expert-only") — locked Q2, 2026-04-18,
 * enforced by AC-09.5.
 *
 * When more than VISIBLE_FACTORS non-blank factors exist, the remainder is
 * placed inside a native <details> so the page doesn't push body copy down
 * on thoroughly documented species (UX review 2026-04-19, Option A).
 * Factor text itself is still rendered — progressive disclosure, not
 * aggregation.
 *
 * If every factor is blank, the component renders nothing so the parent
 * page can elide the whole subsection heading.
 */
const VISIBLE_FACTORS = 2;

export default function HusbandryDifficultyFactors({
  husbandry,
}: {
  husbandry: SpeciesHusbandry;
}) {
  const factors = collectDifficultyFactors(husbandry);
  if (factors.length === 0) return null;

  const visible = factors.slice(0, VISIBLE_FACTORS);
  const hidden = factors.slice(VISIBLE_FACTORS);

  return (
    <section aria-labelledby="difficulty-heading" className="mt-8">
      <h2 id="difficulty-heading" className="font-serif text-xl text-slate-900">
        Difficulty Factors
      </h2>
      <dl className="mt-2 space-y-2 text-sm text-slate-700">
        {visible.map((f) => (
          <div key={f.key}>
            <dt className="font-medium text-slate-500">{f.label}</dt>
            <dd className="mt-0.5">{f.value}</dd>
          </div>
        ))}
      </dl>
      {hidden.length > 0 ? (
        <details className="mt-3 text-sm text-slate-700">
          <summary className="cursor-pointer text-sky-700 hover:underline">
            Show {hidden.length} more factor{hidden.length === 1 ? "" : "s"}
          </summary>
          <dl className="mt-2 space-y-2">
            {hidden.map((f) => (
              <div key={f.key}>
                <dt className="font-medium text-slate-500">{f.label}</dt>
                <dd className="mt-0.5">{f.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
