"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { routing, type Locale } from "@/i18n/routing";

/**
 * Header dropdown to switch the active locale. Flag-gated by
 * `NEXT_PUBLIC_FEATURE_I18N`; per-locale flags
 * (`NEXT_PUBLIC_FEATURE_I18N_FR/DE/ES`) further gate which entries
 * appear so French can ship before German/Spanish are reviewed.
 *
 * Switching locales navigates to the equivalent URL on the new
 * locale, preserving the path. Default locale (en) lives at root
 * (`/species/123`); other locales prefix (`/fr/species/123`).
 */

const LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
};

const PER_LOCALE_FLAG_ENV: Record<Locale, string | undefined> = {
  en: undefined, // default; always available when master flag is on
  fr: process.env.NEXT_PUBLIC_FEATURE_I18N_FR,
  de: process.env.NEXT_PUBLIC_FEATURE_I18N_DE,
  es: process.env.NEXT_PUBLIC_FEATURE_I18N_ES,
};

function isLocaleEnabled(locale: Locale): boolean {
  if (locale === routing.defaultLocale) return true;
  return PER_LOCALE_FLAG_ENV[locale] === "true";
}

/**
 * Strip the leading locale segment (if any) from a path so we can
 * re-prefix with the target locale. `/fr/species/123` → `/species/123`;
 * `/species/123` → `/species/123` (already unprefixed for default).
 */
function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      const stripped = pathname.slice(`/${locale}`.length);
      return stripped === "" ? "/" : stripped;
    }
  }
  return pathname;
}

function buildLocalizedPath(pathname: string, target: Locale): string {
  const base = stripLocale(pathname);
  if (target === routing.defaultLocale) return base;
  return base === "/" ? `/${target}` : `/${target}${base}`;
}

export default function LocaleSwitcher() {
  const flagOn = process.env.NEXT_PUBLIC_FEATURE_I18N === "true";
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!flagOn) return null;

  const enabled = routing.locales.filter(isLocaleEnabled);
  // Don't render if only English is enabled (nothing to switch to).
  if (enabled.length <= 1) return null;

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const target = event.target.value as Locale;
    if (target === currentLocale) return;
    const dest = buildLocalizedPath(pathname || "/", target);
    startTransition(() => {
      router.push(dest);
    });
  }

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        color: "var(--ink-2)",
      }}
    >
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={currentLocale}
        onChange={onChange}
        disabled={isPending}
        style={{
          appearance: "none",
          background: "transparent",
          border: "1px solid var(--rule)",
          borderRadius: 6,
          padding: "4px 8px",
          fontFamily: "var(--sans)",
          fontSize: 14,
          color: "var(--ink)",
          cursor: isPending ? "wait" : "pointer",
        }}
      >
        {enabled.map((locale) => (
          <option key={locale} value={locale}>
            {LABELS[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
