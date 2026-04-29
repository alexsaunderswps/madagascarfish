import { useTranslations } from "next-intl";

/**
 * Platform husbandry disclaimer.
 *
 * Copy is the single source of truth in
 * `docs/planning/copy/husbandry-platform-copy.md` §1 — do not paraphrase
 * without a conservation-writer review. Appears directly beneath the page
 * title, above the at-a-glance panel, on every `/species/[id]/husbandry/`.
 */
export default function HusbandryDisclaimer() {
  const t = useTranslations("husbandry.disclaimer");
  return (
    <section
      aria-labelledby="husbandry-disclaimer-heading"
      className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
    >
      <h2 id="husbandry-disclaimer-heading" className="sr-only">
        {t("srHeading")}
      </h2>
      <p>{t("para1")}</p>
      <p className="mt-2">{t("para2")}</p>
    </section>
  );
}
