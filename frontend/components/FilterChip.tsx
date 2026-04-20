/**
 * FilterChip — toggleable filter primitive (§15.3).
 *
 * Used on the Directory for family / endemism / CARES / SHOAL / IUCN status.
 * Visual height is ~24px but the interactive hit target is padded to 44px so
 * touch and keyboard users can select without fine targeting.
 */

import type { ReactNode } from "react";

export type FilterChipProps = {
  children: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  count?: number;
  name?: string;
  value?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  ariaLabel?: string;
};

export default function FilterChip({
  children,
  selected = false,
  disabled = false,
  count,
  name,
  value,
  onClick,
  type = "button",
  ariaLabel,
}: FilterChipProps) {
  return (
    <button
      type={type}
      name={name}
      value={value}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className="mffcp-filter-chip"
      data-selected={selected ? "true" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 44,
        padding: "5px 10px",
        borderRadius: 999,
        fontFamily: "var(--sans)",
        fontSize: 11,
        fontWeight: selected ? 600 : 500,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        backgroundColor: selected ? "var(--accent-soft)" : "var(--bg-raised)",
        color: selected ? "var(--accent-2)" : "var(--ink-2)",
        border: `1px solid ${
          selected ? "var(--accent)" : "var(--rule-strong)"
        }`,
        transition: "background-color 120ms ease, border-color 120ms ease",
      }}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span
          aria-hidden="true"
          style={{
            fontVariantNumeric: "tabular-nums",
            color: selected ? "var(--accent-2)" : "var(--ink-3)",
            fontWeight: 500,
          }}
        >
          {count.toLocaleString()}
        </span>
      ) : null}
    </button>
  );
}
