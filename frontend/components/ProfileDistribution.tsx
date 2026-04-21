import { fetchLocalities } from "@/lib/mapLocalities";
import { fetchSiteMapAsset } from "@/lib/siteMapAssets";

/**
 * ProfileDistribution — S20 profile Distribution panel.
 *
 * Renders the curated `profile_panel` SiteMapAsset when present with the
 * locality count caption underneath. When no SMA is uploaded, the panel
 * drops out entirely and only the count line remains — the previous
 * stripe-hatched fallback looked like a missing-image placeholder
 * (2026-04-20 review).
 *
 * The "Open full map" CTA lives in the top-of-page Distribution summary
 * box; this section stays informational to avoid duplicating the action.
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
    <section id="distribution" style={{ marginTop: 48 }}>
      <p
        style={{
          fontFamily: "var(--sans)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          margin: 0,
        }}
      >
        Distribution
      </p>
      <h2
        style={{
          marginTop: 8,
          fontFamily: "var(--serif)",
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--ink)",
          lineHeight: 1.15,
        }}
      >
        Where it&rsquo;s found
      </h2>

      {sma ? (
        <figure
          style={{
            marginTop: 16,
            marginInline: 0,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--rule)",
            overflow: "hidden",
            backgroundColor: "var(--bg-raised)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sma.url}
            alt={sma.alt || "Distribution overview"}
            width={sma.width}
            height={sma.height}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: 260,
              objectFit: "cover",
            }}
          />
          {sma.credit ? (
            <figcaption
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                padding: "8px 16px",
                borderTop: "1px solid var(--rule)",
              }}
            >
              {sma.credit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <p
        style={{
          marginTop: 16,
          fontSize: 13,
          color: hasLocalities && count > 0 ? "var(--ink-2)" : "var(--ink-3)",
        }}
      >
        {hasLocalities && count > 0
          ? `${count} locality record${count === 1 ? "" : "s"} on record.`
          : "No locality records are currently mapped for this species."}
      </p>
    </section>
  );
}
