import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export interface EmptyStateAction {
  href: string;
  label: string;
}

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  variant?: "card" | "inline";
  "aria-label"?: string;
}

/**
 * Shared empty-state block. Uses the project design tokens (--bg-raised,
 * --rule, --ink, --accent-2) so the visual language matches the species
 * profile, directory, and dashboard surfaces.
 *
 * `inline` is used inside existing sections (smaller padding, left-aligned);
 * `card` is a standalone block (center-aligned, larger padding).
 */
export default function EmptyState({
  title,
  body,
  primaryAction,
  secondaryAction,
  variant = "card",
  "aria-label": ariaLabel,
}: EmptyStateProps) {
  const isInline = variant === "inline";
  const wrapperStyle: CSSProperties = {
    border: "1px solid var(--rule)",
    borderRadius: "var(--radius-lg)",
    backgroundColor: "var(--bg-raised)",
    padding: isInline ? "16px 20px" : "32px 24px",
    textAlign: isInline ? "left" : "center",
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontFamily: "var(--serif)",
    fontSize: isInline ? 18 : 20,
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1.2,
  };

  const bodyStyle: CSSProperties = {
    marginTop: 8,
    fontSize: 14,
    color: "var(--ink-2)",
    lineHeight: 1.55,
  };

  const actionsStyle: CSSProperties = {
    marginTop: 16,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: isInline ? "flex-start" : "center",
  };

  const primaryActionStyle: CSSProperties = {
    display: "inline-block",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "var(--accent-2)",
    border: "1px solid var(--accent-2)",
    borderRadius: "var(--radius)",
    textDecoration: "none",
  };

  const secondaryActionStyle: CSSProperties = {
    display: "inline-block",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--ink-2)",
    backgroundColor: "var(--bg)",
    border: "1px solid var(--rule-strong)",
    borderRadius: "var(--radius)",
    textDecoration: "none",
  };

  return (
    <div role="status" aria-label={ariaLabel ?? title} style={wrapperStyle}>
      <h2 style={titleStyle}>{title}</h2>
      {body ? <p style={bodyStyle}>{body}</p> : null}
      {(primaryAction || secondaryAction) && (
        <div style={actionsStyle}>
          {primaryAction ? (
            <Link href={primaryAction.href} style={primaryActionStyle}>
              {primaryAction.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link href={secondaryAction.href} style={secondaryActionStyle}>
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
