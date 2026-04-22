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
  color: "#c0392b",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

interface Props {
  data: StaleCensusResponse | null;
}

function formatDaysStale(days: number | null): string {
  if (days === null) {
    return "Never censused";
  }
  if (days < 730) {
    return `${days} days`;
  }
  return `${Math.round(days / 30)} months`;
}

export default function StaleCensusPanel({ data }: Props) {
  if (!data) {
    return (
      <PanelShell
        eyebrow="Panel 4"
        title="Stale census"
        caption="Populations overdue for a census update."
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          Unable to load stale-census data.
        </p>
      </PanelShell>
    );
  }

  const { threshold_months, total_stale, total_populations, results } = data;

  return (
    <PanelShell
      eyebrow="Panel 4"
      title={`Stale census — ${total_stale} of ${total_populations} populations`}
      caption={`Populations with no census signal (last_census_date or a holding record) in the past ${threshold_months} months, or never censused at all.`}
    >
      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          All populations are within the {threshold_months}-month census
          window.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Species</th>
                <th style={TH_STYLE}>Institution</th>
                <th style={TH_STYLE}>Last signal</th>
                <th style={TH_STYLE}>Stale for</th>
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
                      <span style={NEVER_TAG_STYLE}>none recorded</span>
                    )}
                  </td>
                  <td style={TD_STYLE}>
                    {formatDaysStale(row.days_since_update)}
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
