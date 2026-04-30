import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import { Link } from "@/i18n/routing";
import type { SexRatioRiskResponse } from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const SPECIES_LINK_STYLE: CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  borderBottom: "1px dotted var(--rule)",
};

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

const MFU_STYLE: CSSProperties = {
  fontFamily: "var(--mono, ui-monospace, monospace)",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.02em",
};

const TAG_STYLE: CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 600,
  color: "var(--ink)",
  backgroundColor: "color-mix(in oklab, var(--highlight) 30%, transparent)",
  border: "1px solid color-mix(in oklab, var(--highlight) 60%, var(--rule))",
  marginRight: 4,
};

interface Props {
  data: SexRatioRiskResponse | null;
}

const KNOWN_REASONS = new Set([
  "no_males",
  "no_females",
  "skewed_ratio",
  "mostly_unsexed",
]);

export default async function SexRatioRiskPanel({ data }: Props) {
  const t = await getTranslations("dashboard.coordinator.panels.sexRatio");

  if (!data) {
    return (
      <PanelShell
        title={t("title")}
        caption={t("captionShort")}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          {t("unavailable")}
        </p>
      </PanelShell>
    );
  }

  const { total_populations, total_at_risk, results } = data;

  return (
    <PanelShell
      title={t("titleWithCount", {
        atRisk: total_at_risk,
        total: total_populations,
      })}
      caption={t("captionFull")}
    >
      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          {t("noResults")}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>{t("table.species")}</th>
                <th style={TH_STYLE}>{t("table.institution")}</th>
                <th style={{ ...TH_STYLE, textAlign: "right" }}>{t("table.mfu")}</th>
                <th style={TH_STYLE}>{t("table.reasons")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.population_id}>
                  <td style={{ ...TD_STYLE, fontStyle: "italic" }}>
                    <Link
                      href={`/species/${row.species.id}`}
                      style={SPECIES_LINK_STYLE}
                    >
                      {row.species.scientific_name}
                    </Link>
                  </td>
                  <td style={TD_STYLE}>{row.institution.name}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>
                    <span style={MFU_STYLE}>{row.mfu}</span>
                  </td>
                  <td style={TD_STYLE}>
                    {row.risk_reasons.map((r) => (
                      <span key={r} style={TAG_STYLE}>
                        {KNOWN_REASONS.has(r) ? t(`reasons.${r}`) : r}
                      </span>
                    ))}
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
