import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import { Link } from "@/i18n/routing";
import type {
  OpenRecommendationRow,
  OpenRecommendationsResponse,
  RecommendationPriority,
} from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

const SPECIES_LINK_STYLE: CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  borderBottom: "1px dotted var(--rule)",
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

export default async function OpenRecommendationsPanel({ data }: Props) {
  const t = await getTranslations("dashboard.coordinator.panels.openRecs");

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

  const { total_open, overdue_count, results, reference_date } = data;
  const titleString =
    overdue_count > 0
      ? t("titleWithOverdue", { total: total_open, overdue: overdue_count })
      : t("titleWithCount", { total: total_open });

  return (
    <PanelShell
      title={titleString}
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
                <th style={TH_STYLE}>{t("table.priority")}</th>
                <th style={TH_STYLE}>{t("table.species")}</th>
                <th style={TH_STYLE}>{t("table.type")}</th>
                <th style={TH_STYLE}>{t("table.target")}</th>
                <th style={TH_STYLE}>{t("table.issued")}</th>
                <th style={TH_STYLE}>{t("table.due")}</th>
                <th style={TH_STYLE}>{t("table.status")}</th>
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
                        {t(`priorities.${row.priority}`)}
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE, fontStyle: "italic" }}>
                      <Link
                        href={`/species/${row.species.id}`}
                        style={SPECIES_LINK_STYLE}
                      >
                        {row.species.scientific_name}
                      </Link>
                      {row.rationale ? (
                        <div style={RATIONALE_STYLE}>{row.rationale}</div>
                      ) : null}
                    </td>
                    <td style={TD_STYLE}>
                      {t(`types.${row.recommendation_type}`)}
                    </td>
                    <td style={TD_STYLE}>
                      {row.target_institution?.name ?? (
                        <span style={{ color: "var(--ink-3)" }}>{t("emDash")}</span>
                      )}
                    </td>
                    <td style={TD_STYLE}>{row.issued_date ?? t("emDash")}</td>
                    <td style={{ ...TD_STYLE, ...(overdue ? OVERDUE_STYLE : {}) }}>
                      {row.due_date ?? (
                        <span style={{ color: "var(--ink-3)" }}>{t("emDash")}</span>
                      )}
                      {overdue ? " ⚠︎" : null}
                    </td>
                    <td style={TD_STYLE}>
                      {row.status === "in_progress"
                        ? t("statuses.inProgress")
                        : t("statuses.open")}
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
