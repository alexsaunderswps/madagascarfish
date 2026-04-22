import type { CSSProperties, ReactNode } from "react";

interface PanelShellProps {
  eyebrow: string;
  title: string;
  caption?: string;
  children: ReactNode;
}

const EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  marginBottom: 6,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  marginBottom: 4,
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  lineHeight: 1.2,
};

const CAPTION_STYLE: CSSProperties = {
  margin: 0,
  marginBottom: 14,
  fontSize: 13,
  color: "var(--ink-2)",
  lineHeight: 1.45,
};

const SHELL_STYLE: CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "var(--bg-raised)",
  padding: "20px 22px",
};

export default function PanelShell({
  eyebrow,
  title,
  caption,
  children,
}: PanelShellProps) {
  return (
    <section style={SHELL_STYLE}>
      <p style={EYEBROW_STYLE}>{eyebrow}</p>
      <h2 style={TITLE_STYLE}>{title}</h2>
      {caption ? <p style={CAPTION_STYLE}>{caption}</p> : null}
      {children}
    </section>
  );
}
