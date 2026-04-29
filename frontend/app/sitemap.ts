import type { MetadataRoute } from "next";

import { localizedUrl } from "@/lib/seo";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Sitemap with cross-locale `alternates.languages` annotations per
 * URL. Modern Google-recommended pattern (architect doc §7) — a
 * single sitemap whose entries express their locale variants inline
 * is preferred over per-locale sitemap files.
 *
 * Public, non-localized routes (api/, sitemap, robots) are excluded.
 *
 * Dynamic routes (e.g., `/species/[id]`) are *not* enumerated here in
 * L1 — adding species detail URLs requires a server fetch, and the
 * crawl budget for ~79 species is small enough that crawlers can
 * follow links from the directory page. If indexing latency becomes
 * an issue, expand this to fetch and enumerate species IDs at build
 * time.
 */

// Public routes, expressed in the de-localized form. The sitemap
// emits a row per locale per route.
const PUBLIC_PATHS = [
  "/",
  "/species",
  "/map",
  "/about",
  "/about/data",
  "/about/glossary",
  "/contribute/husbandry",
];

function buildLanguagesMap(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localizedUrl(path, locale);
  }
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const path of PUBLIC_PATHS) {
    for (const locale of routing.locales as readonly Locale[]) {
      entries.push({
        url: localizedUrl(path, locale),
        alternates: {
          languages: buildLanguagesMap(path),
        },
        // No `lastModified` — content updates flow through admin
        // and are not exposed as page-level timestamps yet.
      });
    }
  }
  return entries;
}
