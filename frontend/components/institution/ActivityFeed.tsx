import { getTranslations } from "next-intl/server";

import type { ActivityRow } from "@/lib/institutionDashboard";

const TARGET_LABEL_KEYS: Record<string, string> = {
  "populations.ExSituPopulation": "population",
  "populations.BreedingEvent": "breedingEvent",
  "fieldwork.FieldProgram": "fieldProgram",
};

export default async function ActivityFeed({
  rows,
}: {
  rows: ActivityRow[];
}) {
  const t = await getTranslations("dashboard.institution.activity");
  if (rows.length === 0) {
    return (
      <section className="mb-10 rounded border border-slate-200 bg-white p-6">
        <h2 className="mb-2 font-serif text-xl text-slate-900">{t("heading")}</h2>
        <p className="text-sm text-slate-600">{t("empty")}</p>
      </section>
    );
  }

  return (
    <section className="mb-10 rounded border border-slate-200 bg-white p-6">
      <header className="mb-4">
        <h2 className="font-serif text-xl text-slate-900">{t("heading")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
      </header>
      <ol role="list" className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-start gap-3 rounded border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <span
              className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                row.is_own_institution ? "bg-sky-500" : "bg-amber-500"
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-slate-900">
                <span className="font-medium">
                  {row.actor_email ?? t("systemActor")}
                </span>{" "}
                <span className="text-slate-600">
                  {t(`actions.${row.action}` as const)}{" "}
                  {t(`targetKinds.${TARGET_LABEL_KEYS[row.target_type] ?? "other"}`)}
                </span>
              </p>
              <p className="text-xs text-slate-700">{row.target_label}</p>
              {row.changes_summary ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  {t("changesLabel")} {row.changes_summary}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-400">
                {formatTimestamp(row.timestamp)}
                {!row.is_own_institution
                  ? ` · ${t("coordinatorOverrideTag")}`
                  : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
