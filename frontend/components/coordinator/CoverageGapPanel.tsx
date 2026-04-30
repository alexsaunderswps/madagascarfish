import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
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

export default async function CoverageGapPanel({ data }: Props) {
  const t = await getTranslations("dashboard.coordinator.panels.coverage");

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

  const { endemic_only, total, results, data_deficient } = data;

  return (
    <PanelShell
      title={t("titleWithCount", {
        total,
        scope: endemic_only ? t("scopeEndemic") : t("scopeAll"),
      })}
      caption={t("captionFull")}
    >
      <nav style={TOGGLE_ROW_STYLE} aria-label={t("endemicFilterAriaLabel")}>
        <Link
          href="/dashboard/coordinator"
          style={endemic_only ? TOGGLE_ACTIVE_STYLE : TOGGLE_LINK_STYLE}
          aria-current={endemic_only ? "page" : undefined}
        >
          {t("endemicOnly")}
        </Link>
        <span aria-hidden="true" style={{ color: "var(--ink-3)" }}>
          ·
        </span>
        <Link
          href="/dashboard/coordinator?endemic_only=false"
          style={!endemic_only ? TOGGLE_ACTIVE_STYLE : TOGGLE_LINK_STYLE}
          aria-current={!endemic_only ? "page" : undefined}
        >
          {t("allThreatened")}
        </Link>
      </nav>

      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          {t("noResults")}
        </p>
      ) : (
        <CoverageGapTable rows={results} endemicOnly={endemic_only} />
      )}

      <div style={DD_CARD_STYLE}>
        <div>
          <strong>{t("ddTitle")}</strong> —{" "}
          {data_deficient.total > 0
            ? t("ddBody", {
                total: data_deficient.total,
                endemic: data_deficient.endemic_count,
              })
            : t("ddNone")}
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
            {t("ddViewList")}
          </Link>
        ) : null}
      </div>
    </PanelShell>
  );
}
