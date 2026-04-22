import type { CSSProperties } from "react";

import type { StudbookStatusResponse } from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const BUCKET_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  marginBottom: 16,
};

const TILE_STYLE: CSSProperties = {
  padding: "14px 12px",
  borderRadius: "var(--radius)",
  backgroundColor: "var(--bg)",
  border: "1px solid var(--rule)",
};

const TILE_COUNT_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 28,
  fontWeight: 600,
  color: "var(--ink)",
  lineHeight: 1,
};

const TILE_LABEL_STYLE: CSSProperties = {
  margin: 0,
  marginTop: 6,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "var(--ink-2)",
  textTransform: "uppercase",
};

const SPECIES_LIST_STYLE: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  fontSize: 13,
  columnCount: 2,
  columnGap: 24,
};

const SUBHEAD_STYLE: CSSProperties = {
  margin: 0,
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink-2)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

interface Props {
  data: StudbookStatusResponse | null;
}

const BUCKET_LABELS: Record<string, string> = {
  studbook_managed: "Studbook-managed",
  breeding_not_studbook: "Breeding, not studbook",
  holdings_only: "Holdings only",
  no_captive_population: "No captive population",
};

export default function StudbookStatusPanel({ data }: Props) {
  if (!data) {
    return (
      <PanelShell
        eyebrow="Panel 2"
        title="Studbook status"
        caption="Per-species program classification."
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          Unable to load studbook data.
        </p>
      </PanelShell>
    );
  }

  const { buckets } = data;
  const order = [
    "studbook_managed",
    "breeding_not_studbook",
    "holdings_only",
    "no_captive_population",
  ] as const;

  return (
    <PanelShell
      eyebrow="Panel 2"
      title="Studbook status"
      caption="Species counts across four coordinator-relevant buckets. The breeding-not-studbook row catches ad-hoc populations that aren't part of a coordinated program — a fragility the three-bucket view hides."
    >
      <div style={BUCKET_GRID_STYLE}>
        {order.map((key) => (
          <div key={key} style={TILE_STYLE}>
            <p style={TILE_COUNT_STYLE}>{buckets[key].count}</p>
            <p style={TILE_LABEL_STYLE}>{BUCKET_LABELS[key]}</p>
          </div>
        ))}
      </div>

      {(
        ["studbook_managed", "breeding_not_studbook", "holdings_only"] as const
      ).map((key) => {
        const bucket = buckets[key];
        if (!bucket.species || bucket.species.length === 0) {
          return null;
        }
        return (
          <div key={key} style={{ marginTop: 12 }}>
            <p style={SUBHEAD_STYLE}>{BUCKET_LABELS[key]}</p>
            <ul style={SPECIES_LIST_STYLE}>
              {bucket.species.map((sp) => (
                <li
                  key={sp.species_id}
                  style={{
                    fontStyle: "italic",
                    color: "var(--ink)",
                    marginBottom: 2,
                  }}
                >
                  {sp.scientific_name}
                  <span
                    style={{
                      marginLeft: 6,
                      fontStyle: "normal",
                      color: "var(--ink-3)",
                      fontSize: 11,
                    }}
                  >
                    ({sp.population_count})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </PanelShell>
  );
}
