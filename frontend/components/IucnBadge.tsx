import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { type IucnStatus } from "@/lib/species";

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
  compactUnassessed = false,
}: {
  status: IucnStatus | null;
  showLabel?: boolean;
  criteria?: string;
  compactUnassessed?: boolean;
}) {
  const tBadge = useTranslations("common.iucnBadge");
  const tIucn = useTranslations("common.iucn");
  const tAbbrev = useTranslations("common.iucnAbbrev");

  // Null == "Not yet assessed". Directory cards pass compactUnassessed so the
  // pill renders as "NE" (keeps the card name from wrapping); the profile page
  // keeps the full "Not yet assessed" wording.
  if (!status) {
    return (
      <span
        style={pillStyle("NE")}
        aria-label={tBadge("ariaLabelUnassessed")}
      >
        <span aria-hidden="true" style={dotStyle("NE")} />
        {compactUnassessed ? tAbbrev("NE") : tIucn("NE")}
      </span>
    );
  }

  const label = tIucn(status);
  const ariaLabel = criteria
    ? tBadge("ariaLabelWithCriteria", { label, criteria })
    : tBadge("ariaLabelTemplate", { label });
  const title = criteria ? tBadge("titleWithCriteria", { label, criteria }) : label;
  return (
    <span
      style={pillStyle(status)}
      title={title}
      aria-label={ariaLabel}
    >
      <span aria-hidden="true" style={dotStyle(status)} />
      {showLabel ? tBadge("labelWithStatus", { status, label }) : status}
    </span>
  );
}
