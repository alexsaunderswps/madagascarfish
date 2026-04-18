import { collectDifficultyFactors, type SpeciesHusbandry } from "@/lib/husbandry";

/**
 * Renders the seven `difficulty_*` factor fields as a descriptive list.
 * Elides blanks. NEVER renders a single aggregate label ("Beginner",
 * "Intermediate", "Advanced", "Expert-only") — locked Q2, 2026-04-18,
 * enforced by AC-09.5.
 *
 * If every factor is blank, the component renders nothing so the parent
 * page can elide the whole subsection heading.
 */
export default function HusbandryDifficultyFactors({
  husbandry,
}: {
  husbandry: SpeciesHusbandry;
}) {
  const factors = collectDifficultyFactors(husbandry);
  if (factors.length === 0) return null;

  return (
    <section aria-labelledby="difficulty-heading" className="mt-8">
      <h2 id="difficulty-heading" className="font-serif text-xl text-slate-900">
        Difficulty Factors
      </h2>
      <dl className="mt-2 space-y-2 text-sm text-slate-700">
        {factors.map((f) => (
          <div key={f.key}>
            <dt className="font-medium text-slate-500">{f.label}</dt>
            <dd className="mt-0.5">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
