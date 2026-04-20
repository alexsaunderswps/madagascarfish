/**
 * Registry "last synced" strip (docs/design.md §16 + S5 of Gate 1 spec).
 *
 * Sits between the site header and page content on Home. Reads the latest
 * completed IUCN SyncJob timestamp from the dashboard payload the page is
 * already hydrating. When no sync has ever completed, renders an "awaiting
 * first sync" line with a muted dot (no pulse).
 */

function formatSyncedAt(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
}

export type LastSyncStripProps = {
  lastSyncAt: string | null;
};

export default function LastSyncStrip({ lastSyncAt }: LastSyncStripProps) {
  const formatted = lastSyncAt ? formatSyncedAt(lastSyncAt) : null;
  const hasSync = formatted !== null;
  const label = hasSync
    ? `Last synced ${formatted} — IUCN Red List`
    : "Awaiting first IUCN sync";

  return (
    <div
      aria-label={label}
      className="border-b"
      style={{
        backgroundColor: "var(--bg-sunken)",
        borderColor: "var(--rule)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-7 py-2.5 text-[12px] text-slate-600">
        <span
          aria-hidden="true"
          className={hasSync ? "pulse-dot" : undefined}
          style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            backgroundColor: hasSync ? "var(--accent)" : "var(--rule-strong)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
