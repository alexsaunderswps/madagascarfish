import { getTranslations } from "next-intl/server";
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

const TILE_HINT_STYLE: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 11,
  color: "var(--ink-3)",
  lineHeight: 1.35,
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

export default async function StudbookStatusPanel({ data }: Props) {
  const t = await getTranslations("dashboard.coordinator.panels.studbook");

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

  const { buckets } = data;
  const order = [
    "studbook_managed",
    "breeding_not_studbook",
    "holdings_only",
    "no_captive_population",
  ] as const;

  return (
    <PanelShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      caption={t("captionFull")}
    >
      <div style={BUCKET_GRID_STYLE}>
        {order.map((key) => (
          <div key={key} style={TILE_STYLE}>
            <p style={TILE_COUNT_STYLE}>{buckets[key].count}</p>
            <p style={TILE_LABEL_STYLE}>{t(`buckets.${key}.label`)}</p>
            <p style={TILE_HINT_STYLE}>{t(`buckets.${key}.hint`)}</p>
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
            <p style={SUBHEAD_STYLE}>{t(`buckets.${key}.label`)}</p>
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
