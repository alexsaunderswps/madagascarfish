import type { MetadataRoute } from "next";

/**
 * `/robots.txt`. Allows public crawling of the site and points at
 * `/sitemap.xml` so search engines can discover all locale variants
 * via the cross-locale `xhtml:link` annotations there.
 *
 * `/api/`, `/account`, `/dashboard` are disallowed — they're not
 * intended for public indexing.
 */

function resolveHost(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  const host = fromEnv && fromEnv.length > 0 ? fromEnv : "https://malagasyfishes.org";
  return host.replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/dashboard"],
      },
    ],
    sitemap: `${resolveHost()}/sitemap.xml`,
  };
}
