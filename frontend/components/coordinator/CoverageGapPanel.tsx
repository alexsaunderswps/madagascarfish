import Link from "next/link";
import type { CSSProperties } from "react";

import type { CoverageGapResponse } from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const STATUS_COLORS: Record<string, string> = {
  CR: "#c0392b",
  EN: "#d35400",
  VU: "#c18a1f",
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

const BADGE_STYLE: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  color: "white",
  letterSpacing: "0.04em",
};

const DD_CARD_STYLE: CSSProperties = {
  marginTop: 16,
  padding: "12px 14px",
  borderRadius: "var(--radius)",
  border: "1px dashed var(--rule)",
  backgroundColor: "color-mix(in oklab, var(--highlight) 8%, var(--bg-raised))",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 13,
};

const TOGGLE_ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const TOGGLE_LINK_STYLE: CSSProperties = {
  fontSize: 12,
  color: "var(--accent-2)",
  textDecoration: "underline",
  cursor: "pointer",
};

const TOGGLE_ACTIVE_STYLE: CSSProperties = {
  ...TOGGLE_LINK_STYLE,
  color: "var(--ink-3)",
  textDecoration: "none",
  cursor: "default",
};

interface Props {
  data: CoverageGapResponse | null;
}

export default function CoverageGapPanel({ data }: Props) {
  if (!data) {
    return (
      <PanelShell
        eyebrow="Panel 1"
        title="Coverage gap"
        caption="Threatened species with no ex-situ backstop."
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          Unable to load coverage data. Check the coordinator token
          configuration.
        </p>
      </PanelShell>
    );
  }

  const { endemic_only, total, results, data_deficient } = data;

  return (
    <PanelShell
      eyebrow="Panel 1"
      title={`Coverage gap — ${total} ${endemic_only ? "endemic " : ""}species`}
      caption="Critically Endangered, Endangered, and Vulnerable species with no ex-situ population on record. The highest-signal triage list for coordinators."
    >
      <div style={TOGGLE_ROW_STYLE} role="tablist" aria-label="Endemic filter">
        <Link
          href="/dashboard/coordinator"
          style={endemic_only ? TOGGLE_ACTIVE_STYLE : TOGGLE_LINK_STYLE}
          aria-current={endemic_only ? "page" : undefined}
        >
          Endemic only
        </Link>
        <span aria-hidden="true" style={{ color: "var(--ink-3)" }}>
          ·
        </span>
        <Link
          href="/dashboard/coordinator?endemic_only=false"
          style={!endemic_only ? TOGGLE_ACTIVE_STYLE : TOGGLE_LINK_STYLE}
          aria-current={!endemic_only ? "page" : undefined}
        >
          All threatened
        </Link>
      </div>

      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          No gaps at this filter. Either coverage is complete or no species
          match.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Status</th>
                <th style={TH_STYLE}>Species</th>
                <th style={TH_STYLE}>Family</th>
                <th style={TH_STYLE}>Endemic</th>
                <th style={TH_STYLE}>Trend</th>
                <th style={TH_STYLE}>CARES</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.species_id}>
                  <td style={TD_STYLE}>
                    <span
                      style={{
                        ...BADGE_STYLE,
                        backgroundColor:
                          STATUS_COLORS[row.iucn_status] ?? "var(--ink-3)",
                      }}
                    >
                      {row.iucn_status}
                    </span>
                  </td>
                  <td style={TD_STYLE}>
                    <Link
                      href={`/species/${row.species_id}`}
                      style={{
                        color: "var(--accent-2)",
                        textDecoration: "none",
                        fontStyle: "italic",
                      }}
                    >
                      {row.scientific_name}
                    </Link>
                    {row.shoal_priority ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          color: "var(--accent-2)",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                        }}
                        title="SHOAL 1,000 Fishes priority species"
                      >
                        SHOAL
                      </span>
                    ) : null}
                  </td>
                  <td style={TD_STYLE}>{row.family}</td>
                  <td style={TD_STYLE}>{row.endemic_status}</td>
                  <td style={TD_STYLE}>{row.population_trend ?? "—"}</td>
                  <td style={TD_STYLE}>{row.cares_status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={DD_CARD_STYLE}>
        <div>
          <strong>Data Deficient</strong> —{" "}
          {data_deficient.total > 0
            ? `${data_deficient.total} species (${data_deficient.endemic_count} endemic) need assessment.`
            : "No DD species in the registry."}
        </div>
        {data_deficient.total > 0 ? (
          <Link
            href="/species/?iucn_status=DD"
            style={{
              fontSize: 12,
              color: "var(--accent-2)",
              textDecoration: "underline",
              whiteSpace: "nowrap",
            }}
          >
            View list →
          </Link>
        ) : null}
      </div>
    </PanelShell>
  );
}
