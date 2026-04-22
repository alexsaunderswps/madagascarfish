import type { CSSProperties } from "react";

import type { SexRatioRiskResponse } from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const REASON_LABELS: Record<string, string> = {
  no_males: "No males",
  no_females: "No females",
  skewed_ratio: "Sex ratio > 4:1",
  mostly_unsexed: "Mostly unsexed",
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

export default function SexRatioRiskPanel({ data }: Props) {
  if (!data) {
    return (
      <PanelShell
        eyebrow="Panel 3"
        title="Sex-ratio risk"
        caption="Populations with demographic imbalance."
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          Unable to load sex-ratio data.
        </p>
      </PanelShell>
    );
  }

  const { total_populations, total_at_risk, results } = data;

  return (
    <PanelShell
      eyebrow="Panel 3"
      title={`Sex-ratio risk — ${total_at_risk} of ${total_populations} populations`}
      caption="M.F.U counts in the canonical males.females.unsexed convention. Flagged when skew exceeds 1:4, one sex is absent, or unsexed fraction exceeds 50%."
    >
      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          No populations currently flagged.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Species</th>
                <th style={TH_STYLE}>Institution</th>
                <th style={{ ...TH_STYLE, textAlign: "right" }}>M.F.U</th>
                <th style={TH_STYLE}>Reasons</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.population_id}>
                  <td style={{ ...TD_STYLE, fontStyle: "italic" }}>
                    {row.species.scientific_name}
                  </td>
                  <td style={TD_STYLE}>{row.institution.name}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>
                    <span style={MFU_STYLE}>{row.mfu}</span>
                  </td>
                  <td style={TD_STYLE}>
                    {row.risk_reasons.map((r) => (
                      <span key={r} style={TAG_STYLE}>
                        {REASON_LABELS[r] ?? r}
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
