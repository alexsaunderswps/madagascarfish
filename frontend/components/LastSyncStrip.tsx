/**
 * Registry "last synced" strip (docs/design.md §16 + S5 of Gate 1 spec).
 *
 * Sits between the site header and page content on Home. Reads the latest
 * completed IUCN SyncJob timestamp from the dashboard payload the page is
 * already hydrating. When no sync has ever completed, renders an "awaiting
 * first sync" line with a muted dot (no pulse).
 */

import { getLocale, getTranslations } from "next-intl/server";

function formatSyncedAt(iso: string, locale: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  // Use the active locale (BCP-47 tag) so date formatting matches the
  // visitor's language: en → "Apr 29, 2026, 8:50 PM EDT", fr →
  // "29 avr. 2026 à 20:50 UTC−4", etc.
  return new Intl.DateTimeFormat(locale, {
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

export default async function LastSyncStrip({ lastSyncAt }: LastSyncStripProps) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("common.lastSync"),
  ]);
  const formatted = lastSyncAt ? formatSyncedAt(lastSyncAt, locale) : null;
  const hasSync = formatted !== null;
  const label = hasSync
    ? t("synced", { when: formatted })
    : t("awaiting");

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
