import { getTranslations } from "next-intl/server";

import type { InstitutionSummaryResponse } from "@/lib/institutionDashboard";

const IUCN_BADGE_STYLES: Record<string, string> = {
  CR: "bg-red-100 text-red-800",
  EN: "bg-orange-100 text-orange-800",
  VU: "bg-amber-100 text-amber-800",
  NT: "bg-yellow-100 text-yellow-800",
  LC: "bg-green-100 text-green-800",
  DD: "bg-slate-100 text-slate-700",
  NE: "bg-slate-100 text-slate-700",
};

export default async function AggregatePanel({
  summary,
}: {
  summary: InstitutionSummaryResponse | null;
}) {
  const t = await getTranslations("dashboard.institution.aggregate");
  if (summary === null) {
    return (
      <section
        role="alert"
        className="mb-8 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        {t("unavailable")}
      </section>
    );
  }

  const { totals, species_breakdown } = summary;
  const top = species_breakdown.slice(0, 5);

  return (
    <section className="mb-10 rounded border border-slate-200 bg-white p-6">
      <header className="mb-5">
        <h2 className="font-serif text-xl text-slate-900">{t("heading")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("stats.populations")} value={totals.populations} />
        <Stat label={t("stats.species")} value={totals.species} />
        <Stat
          label={t("stats.breedingEvents")}
          value={totals.breeding_events_last_12_months}
          help={t("stats.breedingEventsHelp")}
        />
        <Stat
          label={t("stats.freshCensus")}
          value={`${totals.fresh_census_count} / ${totals.populations}`}
          help={t("stats.freshCensusHelp")}
        />
      </dl>

      {top.length > 0 ? (
        <div className="mt-8">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            {t("breakdown.heading")}
          </h3>
          <ul className="space-y-3">
            {top.map((row) => {
              const badgeStyle =
                IUCN_BADGE_STYLES[row.species.iucn_status ?? ""] ??
                IUCN_BADGE_STYLES.NE;
              const widthPct = Math.min(100, Math.max(2, row.share_pct));
              return (
                <li key={row.species.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif italic text-slate-900">
                        {row.species.scientific_name}
                      </span>
                      {row.species.iucn_status ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeStyle}`}
                        >
                          {row.species.iucn_status}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-slate-600">
                      {t("breakdown.shareLine", {
                        own: row.this_institution_count,
                        global: row.global_count,
                        pct: row.share_pct,
                      })}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-sky-600"
                      style={{ width: `${widthPct}%` }}
                      aria-label={t("breakdown.barLabel", {
                        species: row.species.scientific_name,
                        pct: row.share_pct,
                      })}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("breakdown.contextLine", {
                      institutions: row.institutions_holding,
                      events: row.recent_breeding_events,
                    })}
                  </p>
                </li>
              );
            })}
          </ul>
          {species_breakdown.length > top.length ? (
            <p className="mt-4 text-xs text-slate-500">
              {t("breakdown.more", {
                count: species_breakdown.length - top.length,
              })}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  help,
}: {
  label: string;
  value: number | string;
  help?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-serif text-2xl text-slate-900">{value}</dd>
      {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}
