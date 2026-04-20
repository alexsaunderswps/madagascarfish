import Link from "next/link";

import { fetchLocalities } from "@/lib/mapLocalities";
import { fetchSiteMapAsset } from "@/lib/siteMapAssets";

/**
 * ProfileDistribution — S20 profile Distribution summary box.
 *
 * Renders the curated `profile_panel` SiteMapAsset (or stripe fallback)
 * alongside a locality-count line + "Open full map" link. The interactive
 * MapClient is reserved for /map; embedding it on every profile made the
 * page heavy and visually noisy (2026-04-20 review).
 */

export default async function ProfileDistribution({
  speciesId,
  hasLocalities,
}: {
  speciesId: number;
  hasLocalities: boolean;
}) {
  const [sma, localities] = await Promise.all([
    fetchSiteMapAsset("profile_panel"),
    hasLocalities
      ? fetchLocalities({ species_id: String(speciesId) })
      : Promise.resolve(null),
  ]);

  const count = localities?.features.length ?? 0;

  return (
    <section aria-labelledby="distribution-heading" style={{ marginTop: 32 }}>
      <h2
        id="distribution-heading"
        style={{
          fontFamily: "var(--serif)",
          fontSize: 22,
          color: "var(--ink)",
          margin: "0 0 12px",
        }}
      >
        Distribution
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--rule)",
          overflow: "hidden",
          backgroundColor: "var(--bg-raised)",
        }}
      >
        {sma ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sma.url}
            alt={sma.alt || "Distribution overview"}
            width={sma.width}
            height={sma.height}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: 220,
              objectFit: "cover",
              borderBottom: "1px solid var(--rule)",
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="bg-stripe-fallback"
            style={{
              height: 120,
              borderBottom: "1px solid var(--rule)",
            }}
          />
        )}

        <div style={{ padding: "14px 16px" }}>
          {hasLocalities && count > 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>
              {count} locality record{count === 1 ? "" : "s"} on record.{" "}
              <Link
                href={`/map?species_id=${speciesId}`}
                style={{ color: "var(--accent-2)", textDecoration: "underline" }}
              >
                Open full map →
              </Link>
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
              No locality records are currently mapped for this species.
            </p>
          )}

          {sma?.credit ? (
            <p
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                marginTop: 8,
                marginBottom: 0,
              }}
            >
              Map panel: {sma.credit}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
