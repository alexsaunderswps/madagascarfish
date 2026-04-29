/**
 * SEO helpers for locale-aware metadata.
 *
 * Use `buildAlternates(path)` from any page's metadata declaration to
 * emit `<link rel="canonical">` plus `<link rel="alternate">` tags for
 * all four locales and `x-default`. Search engines use these to
 * understand that the four locale URLs are the same logical page in
 * different languages, and to pick the right one per visitor.
 *
 * Architect doc §2 / S8.
 */

import { routing, type Locale } from "@/i18n/routing";

const PROD_HOST = "https://malagasyfishes.org";

/**
 * Resolve the public canonical host. In production this is the
 * primary domain; in preview / local dev we fall back to whatever
 * `NEXT_PUBLIC_SITE_URL` is set to (Vercel preview URLs differ per
 * deploy). Trailing slashes are stripped.
 */
function resolveHost(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  const host = fromEnv && fromEnv.length > 0 ? fromEnv : PROD_HOST;
  return host.replace(/\/$/, "");
}

/**
 * Build the locale-prefixed URL for a given path.
 * - en (default): no prefix → `/species/123`
 * - other locales: `/<locale>/species/123`
 */
export function localizedPath(path: string, locale: Locale): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === routing.defaultLocale) return normalized;
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

export function localizedUrl(path: string, locale: Locale): string {
  return `${resolveHost()}${localizedPath(path, locale)}`;
}

/**
 * Build the `alternates` block for a Next.js `Metadata` export.
 * `path` is the de-localized path (the path as if English were the
 * only language — `/species/123`, not `/fr/species/123`).
 *
 * Returns `canonical` pointing at the *current locale's* URL, plus
 * a `languages` map covering all four locales and `x-default`.
 */
export function buildAlternates(path: string, currentLocale: Locale) {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localizedUrl(path, locale);
  }
  // x-default points at the unprefixed (English) URL — Google's
  // recommended pattern for sites that have a clear default language.
  languages["x-default"] = localizedUrl(path, routing.defaultLocale);

  return {
    canonical: localizedUrl(path, currentLocale),
    languages,
  };
}
