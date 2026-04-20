import { IUCN_LABELS, type IucnStatus } from "@/lib/species";
import type { CSSProperties } from "react";

type Variant = "solid" | "soft" | "outline";

const VARIANT_BY_STATUS: Record<IucnStatus, Variant> = {
  CR: "solid",
  EN: "solid",
  VU: "soft",
  NT: "soft",
  LC: "soft",
  DD: "soft",
  NE: "outline",
};

const COLOR_VAR_BY_STATUS: Record<IucnStatus, string> = {
  CR: "--iucn-cr",
  EN: "--iucn-en",
  VU: "--iucn-vu",
  NT: "--iucn-nt",
  LC: "--iucn-lc",
  DD: "--iucn-dd",
  NE: "--iucn-ne",
};

function pillStyle(status: IucnStatus): CSSProperties {
  const variant = VARIANT_BY_STATUS[status];
  const colorVar = COLOR_VAR_BY_STATUS[status];
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 20,
    padding: "0 10px",
    borderRadius: 999,
    fontFamily: "var(--sans)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
  if (variant === "solid") {
    return {
      ...base,
      backgroundColor: `var(${colorVar})`,
      color: "#FFFFFF",
      border: `1px solid var(${colorVar})`,
    };
  }
  if (variant === "soft") {
    return {
      ...base,
      backgroundColor: `color-mix(in oklab, var(${colorVar}) 20%, var(--bg-raised))`,
      color: "var(--ink)",
      border: `1px solid color-mix(in oklab, var(${colorVar}) 55%, var(--rule))`,
    };
  }
  return {
    ...base,
    backgroundColor: "transparent",
    color: "var(--ink-2)",
    border: "1px solid var(--rule)",
  };
}

function dotStyle(status: IucnStatus): CSSProperties {
  const colorVar = COLOR_VAR_BY_STATUS[status];
  const variant = VARIANT_BY_STATUS[status];
  return {
    width: 8,
    height: 8,
    borderRadius: 9999,
    flexShrink: 0,
    backgroundColor:
      variant === "solid" ? "#FFFFFF" : `var(${colorVar})`,
    border:
      variant === "outline"
        ? "1px solid var(--rule-strong)"
        : undefined,
  };
}

export default function IucnBadge({
  status,
  showLabel = false,
  criteria,
}: {
  status: IucnStatus | null;
  showLabel?: boolean;
  criteria?: string;
}) {
  // Null == "Not yet assessed". Rendered as the NE outlined variant, but the
  // visible text reads "Not yet assessed" rather than the code, so the public
  // profile never shows a raw "NE" pill for an unassessed species.
  if (!status) {
    return (
      <span
        style={pillStyle("NE")}
        aria-label="IUCN status: Not yet assessed"
      >
        <span aria-hidden="true" style={dotStyle("NE")} />
        Not yet assessed
      </span>
    );
  }

  const label = IUCN_LABELS[status];
  const ariaLabel = `IUCN status: ${label}${
    criteria ? `, criteria ${criteria}` : ""
  }`;
  return (
    <span
      style={pillStyle(status)}
      title={criteria ? `${label} — criteria ${criteria}` : label}
      aria-label={ariaLabel}
    >
      <span aria-hidden="true" style={dotStyle(status)} />
      {showLabel ? `${status} · ${label}` : status}
    </span>
  );
}
