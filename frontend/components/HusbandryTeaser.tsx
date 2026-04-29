import { Link } from "@/i18n/routing";

import { teaserPresentation, teaserSentence, type TeaserContext } from "@/lib/husbandry";

/**
 * Husbandry teaser block for species profile pages.
 *
 * Renders only when `has_husbandry` is true (AC-09.1 / AC-09.2). Emphasized
 * variant (AC-09.8) applies when `cares_status` is populated OR
 * `shoal_priority` is true, per the locked visual treatment (2026-04-18):
 *   - left accent border (3–4px, sky-600) — decorative, `aria-hidden`
 *   - uppercase chip label in reading order BEFORE the heading
 *   - single chip ("CARES + SHOAL priority") when both flags set
 *   - no background fill, no icon, no h2 size/weight change
 *
 * Copy lives in docs/planning/copy/husbandry-platform-copy.md §2.
 */
export default function HusbandryTeaser({
  speciesId,
  ctx,
}: {
  speciesId: number;
  ctx: TeaserContext;
}) {
  const presentation = teaserPresentation(ctx);
  if (!presentation.render) return null;

  const { variant, chipText } = presentation;
  const isEmphasized = variant === "emphasized";
  const sentence = teaserSentence(ctx);

  // Accent border is a Tailwind class applied only when emphasized. The
  // border is decorative — the chip carries the textual signal so
  // color-blind / grayscale readers still get it.
  const sectionClasses = [
    "mt-8",
    isEmphasized ? "border-l-4 border-l-sky-600 pl-4" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      aria-labelledby="husbandry-teaser-heading"
      className={sectionClasses}
    >
      {isEmphasized && chipText ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-800">
          <span className="inline-block rounded bg-sky-50 px-2 py-0.5 ring-1 ring-sky-200">
            {chipText}
          </span>
        </p>
      ) : null}
      <h2
        id="husbandry-teaser-heading"
        className="font-serif text-xl text-slate-900"
      >
        Keeping this species
      </h2>
      <p className="mt-2 text-sm text-slate-700">{sentence}</p>
      <p className="mt-2 text-sm">
        <Link
          href={`/species/${speciesId}/husbandry/`}
          className="text-sky-700 hover:underline"
        >
          See husbandry guidance <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
