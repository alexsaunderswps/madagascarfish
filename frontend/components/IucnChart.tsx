import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { type IucnStatus } from "@/lib/species";

const BAR_ORDER: IucnStatus[] = ["CR", "EN", "VU", "NT", "LC", "DD", "NE"];

const BAR_VAR: Record<IucnStatus, string> = {
  CR: "--iucn-cr",
  EN: "--iucn-en",
  VU: "--iucn-vu",
  NT: "--iucn-nt",
  LC: "--iucn-lc",
  DD: "--iucn-dd",
  NE: "--iucn-ne",
};

export default function IucnChart({
  counts,
  caption,
}: {
  counts: Record<string, number>;
  caption: string;
}) {
  const t = useTranslations("common.iucnChart");
  const tIucn = useTranslations("common.iucn");
  const max = Math.max(1, ...BAR_ORDER.map((s) => counts[s] ?? 0));
  return (
    <figure
      aria-labelledby="iucn-chart-caption"
      style={{ display: "flex", flexDirection: "column", gap: 12, margin: 0 }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--serif)",
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--ink)",
        }}
      >
        {t("title")}
      </h2>
      <ul
        role="list"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {BAR_ORDER.map((status) => {
          const count = counts[status] ?? 0;
          const pct = (count / max) * 100;
          const iucnLabel = tIucn(status);
          const label = t("barLabel", { label: iucnLabel, status });
          return (
            <li key={status}>
              <Link
                href={`/species/?iucn_status=${status}`}
                aria-label={t("barAriaLabel", { count, label: iucnLabel })}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(13rem, 1fr) 3fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "4px 6px",
                  borderRadius: "var(--radius)",
                  fontSize: 13,
                  color: "var(--ink-2)",
                  textDecoration: "none",
                }}
              >
                <span>{label}</span>
                <span
                  aria-hidden="true"
                  style={{
                    position: "relative",
                    display: "block",
                    height: 20,
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--bg-sunken)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      left: 0,
                      width: `${pct}%`,
                      backgroundColor: `var(${BAR_VAR[status]})`,
                    }}
                  />
                </span>
                <span
                  style={{
                    minWidth: 40,
                    textAlign: "right",
                    fontFamily: "var(--serif)",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--ink)",
                  }}
                >
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <figcaption
        id="iucn-chart-caption"
        style={{ fontSize: 12, color: "var(--ink-3)" }}
      >
        {caption}
      </figcaption>
    </figure>
  );
}
