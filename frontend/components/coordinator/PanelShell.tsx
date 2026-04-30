import type { CSSProperties, ReactNode } from "react";

interface PanelShellProps {
  title: string;
  caption?: string;
  children: ReactNode;
}

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
  title,
  caption,
  children,
}: PanelShellProps) {
  return (
    <section style={SHELL_STYLE}>
      <h2 style={TITLE_STYLE}>{title}</h2>
      {caption ? <p style={CAPTION_STYLE}>{caption}</p> : null}
      {children}
    </section>
  );
}
