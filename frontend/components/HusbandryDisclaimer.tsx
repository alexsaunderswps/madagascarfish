/**
 * Platform husbandry disclaimer.
 *
 * Copy is the single source of truth in
 * `docs/planning/copy/husbandry-platform-copy.md` §1 — do not paraphrase
 * without a conservation-writer review. Appears directly beneath the page
 * title, above the at-a-glance panel, on every `/species/[id]/husbandry/`.
 */
export default function HusbandryDisclaimer() {
  return (
    <section
      aria-labelledby="husbandry-disclaimer-heading"
      className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
    >
      <h2 id="husbandry-disclaimer-heading" className="sr-only">
        About this guidance
      </h2>
      <p>
        This guidance reflects practices reported by keepers and drawn from
        published sources. It is not a protocol, and conditions vary between
        systems, regions, and individual fish.
      </p>
      <p className="mt-2">
        Use it as a starting point, compare it against other references, and
        consult a qualified aquatic veterinarian for health concerns.
      </p>
    </section>
  );
}
