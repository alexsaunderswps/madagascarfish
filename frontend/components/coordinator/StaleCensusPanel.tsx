import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import type { StaleCensusResponse } from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const TABLE_STYLE: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const TH_STYLE: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid var(--rule)",
  fontWeight: 600,
  color: "var(--ink-2)",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const TD_STYLE: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--rule)",
  color: "var(--ink)",
};

const NEVER_TAG_STYLE: CSSProperties = {
  fontSize: 11,
  color: "var(--danger)",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

interface Props {
  data: StaleCensusResponse | null;
}

interface FormatRangeT {
  (key: "neverCensused"): string;
  (key: "daysSuffix" | "monthsSuffix", values: { count: number }): string;
}

function formatDaysStale(
  days: number | null,
  t: FormatRangeT,
): string {
  if (days === null) {
    return t("neverCensused");
  }
  if (days < 730) {
    return t("daysSuffix", { count: days });
  }
  return t("monthsSuffix", { count: Math.round(days / 30) });
}

export default async function StaleCensusPanel({ data }: Props) {
  const t = await getTranslations("dashboard.coordinator.panels.staleCensus");

  if (!data) {
    return (
      <PanelShell
        eyebrow={t("eyebrow")}
        title={t("title")}
        caption={t("captionShort")}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          {t("unavailable")}
        </p>
      </PanelShell>
    );
  }

  const { threshold_months, total_stale, total_populations, results } = data;

  return (
    <PanelShell
      eyebrow={t("eyebrow")}
      title={t("titleWithCount", { stale: total_stale, total: total_populations })}
      caption={t("captionFull", { threshold: threshold_months })}
    >
      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          {t("noResults", { threshold: threshold_months })}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>{t("table.species")}</th>
                <th style={TH_STYLE}>{t("table.institution")}</th>
                <th style={TH_STYLE}>{t("table.lastSignal")}</th>
                <th style={TH_STYLE}>{t("table.staleFor")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.population_id}>
                  <td style={{ ...TD_STYLE, fontStyle: "italic" }}>
                    {row.species.scientific_name}
                  </td>
                  <td style={TD_STYLE}>{row.institution.name}</td>
                  <td style={TD_STYLE}>
                    {row.effective_last_update ?? (
                      <span style={NEVER_TAG_STYLE}>{t("noneRecorded")}</span>
                    )}
                  </td>
                  <td style={TD_STYLE}>
                    {formatDaysStale(row.days_since_update, t as FormatRangeT)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelShell>
  );
}
