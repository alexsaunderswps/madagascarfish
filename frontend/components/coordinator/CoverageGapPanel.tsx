import Link from "next/link";
import type { CSSProperties } from "react";

import type { CoverageGapResponse } from "@/lib/coordinatorDashboard";

import CoverageGapTable from "./CoverageGapTable";
import PanelShell from "./PanelShell";

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
          Coverage data is temporarily unavailable. The view will populate
          once the coordination API is reachable again.
        </p>
      </PanelShell>
    );
  }

  const { endemic_only, total, results, data_deficient } = data;

  return (
    <PanelShell
      eyebrow="Panel 1"
      title={`Coverage gap — ${total} ${endemic_only ? "endemic " : ""}species`}
      caption="Critically Endangered, Endangered, and Vulnerable species with no ex-situ population on record. The first list a coordinator should triage: each row is a species that has no captive safety net at all."
    >
      <nav style={TOGGLE_ROW_STYLE} aria-label="Endemic filter">
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
      </nav>

      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          No threatened species are missing ex-situ coverage at this filter.
          Either every threatened species in scope has a captive population
          on record, or the filter has narrowed the list to zero.
        </p>
      ) : (
        <CoverageGapTable rows={results} endemicOnly={endemic_only} />
      )}

      <div style={DD_CARD_STYLE}>
        <div>
          <strong>Data Deficient</strong> —{" "}
          {data_deficient.total > 0
            ? `${data_deficient.total} species (${data_deficient.endemic_count} endemic) need a current Red List assessment before their conservation status can be acted on.`
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
