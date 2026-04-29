import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import type {
  BreedingEventRow,
  BreedingEventType,
  ReproductiveActivityResponse,
} from "@/lib/coordinatorDashboard";

import PanelShell from "./PanelShell";

// Subtle category coloring — the panel reads as a ledger, not an alarm.
// Mortality is the only event type where a louder signal is genuinely
// useful, so it gets a warmer chip; the rest stay neutral.
const EVENT_TAG_STYLE: Record<BreedingEventType, CSSProperties> = {
  spawning: { backgroundColor: "transparent", color: "var(--ink-2)", border: "1px solid var(--rule)" },
  hatching: {
    backgroundColor: "color-mix(in oklab, var(--accent-2) 12%, transparent)",
    color: "var(--ink)",
    border: "1px solid color-mix(in oklab, var(--accent-2) 35%, var(--rule))",
  },
  mortality: {
    backgroundColor: "color-mix(in oklab, var(--terracotta) 18%, transparent)",
    color: "var(--ink)",
    border: "1px solid color-mix(in oklab, var(--terracotta) 50%, var(--rule))",
  },
  acquisition: { backgroundColor: "transparent", color: "var(--ink-2)", border: "1px solid var(--rule)" },
  disposition: { backgroundColor: "transparent", color: "var(--ink-2)", border: "1px solid var(--rule)" },
  other: { backgroundColor: "transparent", color: "var(--ink-3)", border: "1px solid var(--rule)" },
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

const ROLLUP_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  marginBottom: 18,
};

const ROLLUP_CELL: CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: "var(--radius)",
  padding: "10px 12px",
  backgroundColor: "var(--bg)",
};

const ROLLUP_LABEL: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const ROLLUP_COUNT: CSSProperties = {
  margin: "4px 0 0",
  fontVariantNumeric: "tabular-nums",
  fontSize: 22,
  fontWeight: 700,
  color: "var(--ink)",
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

const NOTES_STYLE: CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: "var(--ink-3)",
  lineHeight: 1.4,
};

const EVENT_TYPE_ORDER: BreedingEventType[] = [
  "hatching",
  "spawning",
  "mortality",
  "acquisition",
  "disposition",
  "other",
];

function formatDelta(row: BreedingEventRow, emDash: string): string {
  const parts: string[] = [];
  const m = row.count_delta_male;
  const f = row.count_delta_female;
  const u = row.count_delta_unsexed;
  if (m != null) parts.push(`${m > 0 ? "+" : ""}${m} M`);
  if (f != null) parts.push(`${f > 0 ? "+" : ""}${f} F`);
  if (u != null) parts.push(`${u > 0 ? "+" : ""}${u} U`);
  return parts.length > 0 ? parts.join(" · ") : emDash;
}

interface Props {
  data: ReproductiveActivityResponse | null;
}

export default async function ReproductiveActivityPanel({ data }: Props) {
  const t = await getTranslations("dashboard.coordinator.panels.reproductive");

  if (!data) {
    return (
      <PanelShell
        eyebrow={t("eyebrow")}
        title={t("title")}
        caption={t("captionShort")}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          {t("unavailable")}
        </p>
      </PanelShell>
    );
  }

  const { window_days, total_events, result_limit, by_event_type, results } = data;
  const emDash = t("emDash");

  return (
    <PanelShell
      eyebrow={t("eyebrow")}
      title={t("titleWithCount", { count: total_events })}
      caption={t("captionFull", { windowDays: window_days, limit: result_limit })}
    >
      {total_events === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          {t("noResults", { windowDays: window_days })}
        </p>
      ) : (
        <>
          <div style={ROLLUP_GRID}>
            {EVENT_TYPE_ORDER.map((evt) => {
              const bucket = by_event_type[evt];
              if (!bucket || bucket.count === 0) return null;
              return (
                <div key={evt} style={ROLLUP_CELL}>
                  <p style={ROLLUP_LABEL}>{t(`events.${evt}`)}</p>
                  <p style={ROLLUP_COUNT}>{bucket.count}</p>
                  {bucket.recent_species.length > 0 ? (
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 11,
                        color: "var(--ink-3)",
                        fontStyle: "italic",
                        lineHeight: 1.35,
                      }}
                    >
                      {bucket.recent_species.slice(0, 3).join(", ")}
                      {bucket.recent_species.length > 3 ? "…" : ""}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>{t("table.date")}</th>
                  <th style={TH_STYLE}>{t("table.event")}</th>
                  <th style={TH_STYLE}>{t("table.speciesInstitution")}</th>
                  <th style={TH_STYLE}>{t("table.countDelta")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.event_id}>
                    <td style={TD_STYLE}>{row.event_date ?? emDash}</td>
                    <td style={TD_STYLE}>
                      <span
                        style={{
                          ...BASE_TAG,
                          ...EVENT_TAG_STYLE[row.event_type],
                        }}
                      >
                        {t(`events.${row.event_type}`)}
                      </span>
                    </td>
                    <td style={TD_STYLE}>
                      <span style={{ fontStyle: "italic" }}>
                        {row.population.species.scientific_name}
                      </span>
                      <span style={{ color: "var(--ink-3)" }}>
                        {" · "}
                        {row.population.institution.name}
                      </span>
                      {row.notes ? <div style={NOTES_STYLE}>{row.notes}</div> : null}
                    </td>
                    <td
                      style={{
                        ...TD_STYLE,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDelta(row, emDash)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PanelShell>
  );
}
