/**
 * BasinPill — primary basin / watershed context (§15.7).
 *
 * Rendered in card metadata rows and the profile header. Muted fill + hairline
 * border, deliberately lighter than an IUCN pill so it reads as context rather
 * than status. Renders nothing when the basin is absent (no empty outline).
 */

export type BasinPillProps = {
  basin?: string | null;
};

export default function BasinPill({ basin }: BasinPillProps) {
  if (!basin) return null;
  return (
    <span
      aria-label={`Basin: ${basin}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontFamily: "var(--sans)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        backgroundColor: "var(--bg)",
        border: "1px solid var(--rule)",
        whiteSpace: "nowrap",
        lineHeight: 1.3,
      }}
    >
      {basin}
    </span>
  );
}
