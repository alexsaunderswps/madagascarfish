"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { CSSProperties } from "react";

import IucnBadge from "@/components/IucnBadge";
import { Link } from "@/i18n/routing";
import type { CoverageGapRow } from "@/lib/coordinatorDashboard";
import type { IucnStatus } from "@/lib/species";

const DEFAULT_VISIBLE = 10;

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

const ACTIONS_ROW_STYLE: CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
  fontSize: 13,
};

const EXPAND_BUTTON_STYLE: CSSProperties = {
  appearance: "none",
  background: "none",
  border: "1px solid var(--rule)",
  borderRadius: "var(--radius)",
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink)",
  cursor: "pointer",
};

const DIRECTORY_LINK_STYLE: CSSProperties = {
  fontSize: 12,
  color: "var(--accent-2)",
  textDecoration: "underline",
};

interface Props {
  rows: CoverageGapRow[];
  endemicOnly: boolean;
}

function directoryHref(endemicOnly: boolean): string {
  const params = new URLSearchParams({
    iucn_status: "CR,EN,VU",
    has_captive_population: "false",
  });
  if (endemicOnly) {
    params.set("endemic_status", "endemic");
  }
  return `/species/?${params.toString()}`;
}

export default function CoverageGapTable({ rows, endemicOnly }: Props) {
  const t = useTranslations("dashboard.coordinator.panels.coverage.table");
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = rows.length - visible.length;

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              <th style={TH_STYLE}>{t("status")}</th>
              <th style={TH_STYLE}>{t("species")}</th>
              <th style={TH_STYLE}>{t("family")}</th>
              <th style={TH_STYLE}>{t("endemic")}</th>
              <th style={TH_STYLE}>{t("trend")}</th>
              <th style={TH_STYLE}>{t("cares")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.species_id}>
                <td style={TD_STYLE}>
                  <IucnBadge status={row.iucn_status as IucnStatus} />
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
                      title={t("shoalTitle")}
                    >
                      {t("shoalLabel")}
                    </span>
                  ) : null}
                </td>
                <td style={TD_STYLE}>{row.family}</td>
                <td style={TD_STYLE}>{row.endemic_status}</td>
                <td style={TD_STYLE}>{row.population_trend ?? t("emDash")}</td>
                <td style={TD_STYLE}>{row.cares_status ?? t("emDash")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={ACTIONS_ROW_STYLE}>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={EXPAND_BUTTON_STYLE}
            aria-expanded={expanded}
            aria-controls="coverage-gap-table"
          >
            {t("showMore", { count: hiddenCount })}
          </button>
        ) : null}
        {expanded && rows.length > DEFAULT_VISIBLE ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            style={EXPAND_BUTTON_STYLE}
          >
            {t("collapse", { limit: DEFAULT_VISIBLE })}
          </button>
        ) : null}
        <Link href={directoryHref(endemicOnly)} style={DIRECTORY_LINK_STYLE}>
          {t("viewAll")}
        </Link>
      </div>
    </>
  );
}
