import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import { Link } from "@/i18n/routing";
import type {
  TransferActivityResponse,
  TransferRow,
  TransferStatus,
} from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const SPECIES_LINK_STYLE: CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  borderBottom: "1px dotted var(--rule)",
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

interface Props {
  data: TransferActivityResponse | null;
}

interface PanelTranslations {
  statuses: (status: TransferStatus) => string;
  table: {
    species: string;
    fromTo: string;
    status: string;
    proposed: string;
    completed: string;
    mfu: string;
    cites: string;
  };
  emDash: string;
}

function TransferTable({
  rows,
  emptyMessage,
  showActual,
  tx,
}: {
  rows: TransferRow[];
  emptyMessage: string;
  showActual: boolean;
  tx: PanelTranslations;
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
            <th style={TH_STYLE}>{tx.table.species}</th>
            <th style={TH_STYLE}>{tx.table.fromTo}</th>
            <th style={TH_STYLE}>{tx.table.status}</th>
            <th style={TH_STYLE}>{showActual ? tx.table.completed : tx.table.proposed}</th>
            <th style={TH_STYLE}>{tx.table.mfu}</th>
            <th style={TH_STYLE}>{tx.table.cites}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mfu = formatMfu(row);
            const dateValue = showActual ? row.actual_date : row.proposed_date;
            return (
              <tr key={row.transfer_id}>
                <td style={{ ...TD_STYLE, fontStyle: "italic" }}>
                  <Link
                    href={`/species/${row.species.id}`}
                    style={SPECIES_LINK_STYLE}
                  >
                    {row.species.scientific_name}
                  </Link>
                </td>
                <td style={TD_STYLE}>
                  {row.source_institution.name} → {row.destination_institution.name}
                </td>
                <td style={TD_STYLE}>
                  <span style={{ ...BASE_TAG, ...STATUS_TAG_STYLE[row.status] }}>
                    {tx.statuses(row.status)}
                  </span>
                </td>
                <td style={TD_STYLE}>{dateValue ?? tx.emDash}</td>
                <td style={TD_STYLE}>{mfu ?? tx.emDash}</td>
                <td style={TD_STYLE}>
                  {row.cites_reference ?? (
                    <span style={{ color: "var(--ink-3)" }}>{tx.emDash}</span>
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

export default async function TransferActivityPanel({ data }: Props) {
  const t = await getTranslations("dashboard.coordinator.panels.transfers");

  const tx: PanelTranslations = {
    statuses: (status) => t(`statuses.${status}`),
    table: {
      species: t("table.species"),
      fromTo: t("table.fromTo"),
      status: t("table.status"),
      proposed: t("table.proposed"),
      completed: t("table.completed"),
      mfu: t("table.mfu"),
      cites: t("table.cites"),
    },
    emDash: t("emDash"),
  };

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

  const { window_days, in_flight, recent_completed } = data;

  return (
    <PanelShell
      title={t("titleWithCount", {
        inFlight: in_flight.length,
        recent: recent_completed.length,
      })}
      caption={t("captionFull", { windowDays: window_days })}
    >
      <h3 style={SECTION_TITLE_STYLE}>{t("inFlightHeading")}</h3>
      <TransferTable
        rows={in_flight}
        emptyMessage={t("inFlightEmpty")}
        showActual={false}
        tx={tx}
      />

      <h3 style={SECTION_TITLE_STYLE}>{t("recentHeading")}</h3>
      <TransferTable
        rows={recent_completed}
        emptyMessage={t("recentEmpty", { windowDays: window_days })}
        showActual={true}
        tx={tx}
      />
    </PanelShell>
  );
}
