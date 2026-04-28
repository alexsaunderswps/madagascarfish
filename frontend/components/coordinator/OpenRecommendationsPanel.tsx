import type { CSSProperties } from "react";

import type {
  OpenRecommendationRow,
  OpenRecommendationsResponse,
  RecommendationPriority,
  RecommendationType,
} from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const TYPE_LABELS: Record<RecommendationType, string> = {
  breed: "Breed",
  non_breed: "Hold (do not breed)",
  transfer: "Transfer",
  other: "Other",
};

const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_TAG_STYLE: Record<RecommendationPriority, CSSProperties> = {
  critical: {
    backgroundColor: "var(--danger)",
    color: "white",
    border: "1px solid var(--danger)",
  },
  high: {
    backgroundColor: "color-mix(in oklab, var(--danger) 35%, transparent)",
    color: "var(--ink)",
    border: "1px solid color-mix(in oklab, var(--danger) 60%, var(--rule))",
  },
  medium: {
    backgroundColor: "color-mix(in oklab, var(--highlight) 25%, transparent)",
    color: "var(--ink)",
    border: "1px solid color-mix(in oklab, var(--highlight) 60%, var(--rule))",
  },
  low: {
    backgroundColor: "transparent",
    color: "var(--ink-2)",
    border: "1px solid var(--rule)",
  },
};

const STATUS_LABEL_IN_PROGRESS = "In progress";

const BASE_TAG: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
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
  verticalAlign: "top",
};

const RATIONALE_STYLE: CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: "var(--ink-3)",
  lineHeight: 1.4,
};

const OVERDUE_STYLE: CSSProperties = {
  color: "var(--danger)",
  fontWeight: 600,
};

function isOverdue(
  row: OpenRecommendationRow,
  referenceDate: string,
): boolean {
  return Boolean(row.due_date && row.due_date < referenceDate);
}

interface Props {
  data: OpenRecommendationsResponse | null;
}

export default function OpenRecommendationsPanel({ data }: Props) {
  if (!data) {
    return (
      <PanelShell
        eyebrow="Panel 6"
        title="Open breeding recommendations"
        caption="Coordinator action items."
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          Open recommendations are temporarily unavailable. Breed, hold,
          and transfer items will reappear once the coordination API is
          reachable.
        </p>
      </PanelShell>
    );
  }

  const { total_open, overdue_count, results, reference_date } = data;

  return (
    <PanelShell
      eyebrow="Panel 6"
      title={`Open breeding recommendations — ${total_open}${overdue_count > 0 ? ` (${overdue_count} overdue)` : ""}`}
      caption="Active breed, hold, and transfer items issued by coordinators, sorted by priority. Critical and high-priority rows surface first; completed and cancelled items are archived elsewhere."
    >
      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          No open recommendations on file. Either the breeding plan is
          fully addressed or coordinators have not yet logged any items
          for the current period.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Priority</th>
                <th style={TH_STYLE}>Species</th>
                <th style={TH_STYLE}>Type</th>
                <th style={TH_STYLE}>Target</th>
                <th style={TH_STYLE}>Issued</th>
                <th style={TH_STYLE}>Due</th>
                <th style={TH_STYLE}>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => {
                const overdue = isOverdue(row, reference_date);
                return (
                  <tr key={row.recommendation_id}>
                    <td style={TD_STYLE}>
                      <span
                        style={{
                          ...BASE_TAG,
                          ...PRIORITY_TAG_STYLE[row.priority],
                        }}
                      >
                        {PRIORITY_LABELS[row.priority]}
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE, fontStyle: "italic" }}>
                      {row.species.scientific_name}
                      {row.rationale ? (
                        <div style={RATIONALE_STYLE}>{row.rationale}</div>
                      ) : null}
                    </td>
                    <td style={TD_STYLE}>
                      {TYPE_LABELS[row.recommendation_type]}
                    </td>
                    <td style={TD_STYLE}>
                      {row.target_institution?.name ?? (
                        <span style={{ color: "var(--ink-3)" }}>—</span>
                      )}
                    </td>
                    <td style={TD_STYLE}>{row.issued_date ?? "—"}</td>
                    <td style={{ ...TD_STYLE, ...(overdue ? OVERDUE_STYLE : {}) }}>
                      {row.due_date ?? (
                        <span style={{ color: "var(--ink-3)" }}>—</span>
                      )}
                      {overdue ? " ⚠︎" : null}
                    </td>
                    <td style={TD_STYLE}>
                      {row.status === "in_progress"
                        ? STATUS_LABEL_IN_PROGRESS
                        : "Open"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PanelShell>
  );
}
