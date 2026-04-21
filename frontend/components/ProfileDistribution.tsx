import { fetchLocalities } from "@/lib/mapLocalities";
import { fetchSiteMapAsset } from "@/lib/siteMapAssets";

/**
 * ProfileDistribution — S20 profile Distribution panel.
 *
 * Renders the curated `profile_panel` SiteMapAsset and a "Found in"
 * breakdown of distinct drainage basins where the species has been
 * recorded, with per-basin locality counts.
 *
 * The locality count and the "View on Map" link live in the top-of-page
 * Distribution summary box, so this section stays focused on
 * where-specifically content rather than the repeat CTA.
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

  const basinCounts = new Map<string, number>();
  if (localities) {
    for (const f of localities.features) {
      const name = (f.properties.drainage_basin_name || "").trim();
      if (!name || /^basin near/i.test(name)) continue;
      basinCounts.set(name, (basinCounts.get(name) ?? 0) + 1);
    }
  }
  const basins = Array.from(basinCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <section id="distribution" style={{ marginTop: 0 }}>
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

      {basins.length > 0 ? (
        <div style={{ marginTop: 20 }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--sans)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            Found in
          </p>
          <ul
            role="list"
            style={{
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {basins.map(([name, count], i) => (
              <li
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "8px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--rule)",
                  fontSize: 14,
                  color: "var(--ink-2)",
                }}
              >
                <span style={{ color: "var(--ink)" }}>{name}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {count} record{count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : hasLocalities ? null : (
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--ink-3)" }}>
          No locality records are currently mapped for this species.
        </p>
      )}
    </section>
  );
}
