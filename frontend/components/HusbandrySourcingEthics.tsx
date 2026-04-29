import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";

/**
 * Sourcing ethics block for species husbandry pages.
 *
 * Public (Tier 1) copy. Intended to appear on every
 * `/species/[id]/husbandry/` page. Self-contained; no props at MVP.
 *
 * Voice decision (2026-04-18): takes a "responsible-collection-is-part-of-
 * conservation" stance rather than a blanket anti-wild-collection line.
 * See docs/planning/business-analysis/species-profile-husbandry.md.
 */
export default function HusbandrySourcingEthics() {
  const t = useTranslations("species.profile.sourcingEthics");
  return (
    <section
      aria-labelledby="sourcing-ethics-heading"
      className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-6"
    >
      <h2
        id="sourcing-ethics-heading"
        className="text-lg font-semibold text-slate-900"
      >
        {t("heading")}
      </h2>

      <div className="mt-3 space-y-3 text-slate-700">
        <p>{t("para1")}</p>
        <p>{t("para2")}</p>
        <p>{t("para3")}</p>
        <p className="text-sm text-slate-600">
          {t.rich("footerLine", {
            dataLink: (chunks) => (
              <Link
                href="/about/data/"
                className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </section>
  );
}
