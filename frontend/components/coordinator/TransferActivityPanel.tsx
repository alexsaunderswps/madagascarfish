import type { CSSProperties } from "react";

import type {
  TransferActivityResponse,
  TransferRow,
  TransferStatus,
} from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const STATUS_LABELS: Record<TransferStatus, string> = {
  proposed: "Proposed",
  approved: "Approved",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_TAG_STYLE: Record<TransferStatus, CSSProperties> = {
  proposed: {
    backgroundColor: "color-mix(in oklab, var(--highlight) 25%, transparent)",
    border: "1px solid color-mix(in oklab, var(--highlight) 60%, var(--rule))",
  },
  approved: {
    backgroundColor: "color-mix(in oklab, var(--accent) 20%, transparent)",
    border: "1px solid color-mix(in oklab, var(--accent) 60%, var(--rule))",
  },
  in_transit: {
    backgroundColor: "color-mix(in oklab, var(--accent) 35%, transparent)",
    border: "1px solid var(--accent)",
  },
  completed: {
    backgroundColor: "transparent",
    border: "1px solid var(--rule)",
    color: "var(--ink-3)",
  },
  cancelled: {
    backgroundColor: "transparent",
    border: "1px dashed var(--rule)",
    color: "var(--ink-3)",
    textDecoration: "line-through",
  },
};

const BASE_TAG: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 600,
  color: "var(--ink)",
  letterSpacing: "0.04em",
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

const SECTION_TITLE_STYLE: CSSProperties = {
  margin: "18px 0 8px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink-2)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

function formatMfu(row: TransferRow): string | null {
  const m = row.count_male ?? 0;
  const f = row.count_female ?? 0;
  const u = row.count_unsexed ?? 0;
  if (m === 0 && f === 0 && u === 0) return null;
  return `${m}.${f}.${u}`;
}

function formatDate(date: string | null): string {
  return date ?? "—";
}

interface Props {
  data: TransferActivityResponse | null;
}

function TransferTable({
  rows,
  emptyMessage,
  showActual,
}: {
  rows: TransferRow[];
  emptyMessage: string;
  showActual: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
        {emptyMessage}
      </p>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={TH_STYLE}>Species</th>
            <th style={TH_STYLE}>From → To</th>
            <th style={TH_STYLE}>Status</th>
            <th style={TH_STYLE}>{showActual ? "Completed" : "Proposed"}</th>
            <th style={TH_STYLE}>M.F.U</th>
            <th style={TH_STYLE}>CITES</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mfu = formatMfu(row);
            return (
              <tr key={row.transfer_id}>
                <td style={{ ...TD_STYLE, fontStyle: "italic" }}>
                  {row.species.scientific_name}
                </td>
                <td style={TD_STYLE}>
                  {row.source_institution.name} → {row.destination_institution.name}
                </td>
                <td style={TD_STYLE}>
                  <span
                    style={{ ...BASE_TAG, ...STATUS_TAG_STYLE[row.status] }}
                  >
                    {STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td style={TD_STYLE}>
                  {formatDate(showActual ? row.actual_date : row.proposed_date)}
                </td>
                <td style={TD_STYLE}>{mfu ?? "—"}</td>
                <td style={TD_STYLE}>
                  {row.cites_reference ?? (
                    <span style={{ color: "var(--ink-3)" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TransferActivityPanel({ data }: Props) {
  if (!data) {
    return (
      <PanelShell
        eyebrow="Panel 5"
        title="Transfer activity"
        caption="Animal movement between institutions."
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          Unable to load transfer data.
        </p>
      </PanelShell>
    );
  }

  const { window_days, in_flight, recent_completed } = data;

  return (
    <PanelShell
      eyebrow="Panel 5"
      title={`Transfer activity — ${in_flight.length} in flight, ${recent_completed.length} recent`}
      caption={`Proposed, approved, and in-transit moves (any date) plus completed moves in the last ${window_days} days. Oldest-proposed first — stuck transfers float to the top.`}
    >
      <h3 style={SECTION_TITLE_STYLE}>In flight</h3>
      <TransferTable
        rows={in_flight}
        emptyMessage="Nothing currently proposed, approved, or in transit."
        showActual={false}
      />

      <h3 style={SECTION_TITLE_STYLE}>Recently completed</h3>
      <TransferTable
        rows={recent_completed}
        emptyMessage={`No completed transfers in the last ${window_days} days.`}
        showActual={true}
      />
    </PanelShell>
  );
}
