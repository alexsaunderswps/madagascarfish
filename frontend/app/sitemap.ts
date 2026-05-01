import type { MetadataRoute } from "next";

import { routing, type Locale } from "@/i18n/routing";
import { apiFetch } from "@/lib/api";
import { localizedUrl } from "@/lib/seo";

/**
 * Sitemap with cross-locale `alternates.languages` annotations per
 * URL. Modern Google-recommended pattern (architect doc §7) — a
 * single sitemap whose entries express their locale variants inline
 * is preferred over per-locale sitemap files.
 *
 * Public, non-localized routes (api/, sitemap, robots) are excluded.
 *
 * Dynamic routes (`/species/[id]`, `/institutions/[id]`) are
 * enumerated at sitemap-generation time by fetching their list
 * endpoints. The dataset is small (~79 species, single-digit
 * institutions) so the fetches are cheap. The route is cached at
 * `revalidate = 3600` (one hour) so crawlers don't re-trigger the
 * fetches per request.
 */

export const revalidate = 3600;

// Public routes, expressed in the de-localized form. The sitemap
// emits a row per locale per route.
const PUBLIC_PATHS = [
  "/",
  "/species",
  "/map",
  "/field-programs",
  "/about",
  "/about/data",
  "/about/glossary",
  "/contribute/husbandry",
];

interface IdListResponse {
  results: { id: number }[];
  next: string | null;
}

function buildLanguagesMap(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localizedUrl(path, locale);
  }
  return languages;
}

async function _fetchAllIds(path: string, pageSize = 100): Promise<number[]> {
  // Walk the paginated DRF response. Bounded loop in case the API
  // misbehaves — at the platform's scale the totals are well under
  // any reasonable safety cap.
  const ids: number[] = [];
  let next: string | null = `${path}?page_size=${pageSize}`;
  let safety = 50;
  while (next && safety-- > 0) {
    let response: IdListResponse;
    try {
      response = await apiFetch<IdListResponse>(next);
    } catch {
      // Sitemap is best-effort — partial enumeration is better than a
      // 500 on the whole feed.
      break;
    }
    for (const row of response.results) {
      ids.push(row.id);
    }
    let nextUrl: string | null = response.next;
    if (nextUrl) {
      // Convert absolute `next` URLs into relative paths so apiFetch
      // can use the configured backend host.
      try {
        const u: URL = new URL(nextUrl);
        nextUrl = `${u.pathname}${u.search}`;
      } catch {
        // Already relative — leave as-is.
      }
    }
    next = nextUrl;
  }
  return ids;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static public paths, one row per locale.
  for (const path of PUBLIC_PATHS) {
    for (const locale of routing.locales as readonly Locale[]) {
      entries.push({
        url: localizedUrl(path, locale),
        alternates: { languages: buildLanguagesMap(path) },
        // No `lastModified` — content updates flow through admin
        // and are not exposed as page-level timestamps yet.
      });
    }
  }

  // Dynamic species + institution pages.
  const [speciesIds, institutionIds] = await Promise.all([
    _fetchAllIds("/api/v1/species/"),
    _fetchAllIds("/api/v1/institutions/"),
  ]);

  for (const id of speciesIds) {
    const path = `/species/${id}`;
    for (const locale of routing.locales as readonly Locale[]) {
      entries.push({
        url: localizedUrl(path, locale),
        alternates: { languages: buildLanguagesMap(path) },
      });
    }
  }

  for (const id of institutionIds) {
    const path = `/institutions/${id}`;
    for (const locale of routing.locales as readonly Locale[]) {
      entries.push({
        url: localizedUrl(path, locale),
        alternates: { languages: buildLanguagesMap(path) },
      });
    }
  }

  return entries;
}
