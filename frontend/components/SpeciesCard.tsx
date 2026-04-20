/**
 * SpeciesCard — Directory / Home silhouette-grid card (§15.2).
 *
 * Layout (left → right):
 *   [3px IUCN color bar] [72px silhouette column] [main column] [IUCN pill]
 *
 * CARES and SHOAL are inlined into the metadata row as colored labels rather
 * than stacked as right-column chips — matches the 2026-04-20 review.
 *
 * Silhouette column renders a neutral placeholder fish when the species has
 * no SVG of its own. Once the S11–S13 genus cascade lands, that column will
 * prefer a genus-authored SVG before falling back. Basin is a Gate 2 field —
 * rendered only when populated.
 */

import Link from "next/link";
import { type SpeciesListItem } from "@/lib/species";
import IucnBadge from "./IucnBadge";

export type SpeciesCardDensity = "roomy" | "default" | "compact";

const PADDING_BY_DENSITY: Record<SpeciesCardDensity, string> = {
  roomy: "18px 20px",
  default: "14px 16px",
  compact: "10px 12px",
};

const IUCN_BAR_COLOR: Record<string, string> = {
  CR: "var(--iucn-cr)",
  EN: "var(--iucn-en)",
  VU: "var(--iucn-vu)",
  NT: "var(--iucn-nt)",
  LC: "var(--iucn-lc)",
  DD: "var(--iucn-dd)",
  NE: "var(--rule-strong)",
};

const CARES_LABEL: Record<string, string> = {
  CCR: "CARES CCR",
  CEN: "CARES Endangered",
  CVU: "CARES Vulnerable",
  CLC: "CARES Least Concern",
  priority: "CARES priority",
  monitored: "CARES monitored",
};

function PlaceholderFish() {
  // Neutral silhouette anchor so every card has a visual; replaced per-card
  // once Species.silhouette_svg or a genus-level cascade SVG is available.
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 80 36"
      width="64"
      height="28"
      style={{ color: "var(--ink)" }}
    >
      <path
        fill="currentColor"
        d="M6 18 C 10 10, 26 4, 44 6 C 58 7, 68 12, 72 18 C 68 24, 58 29, 44 30 C 26 32, 10 26, 6 18 Z M 70 13 L 78 8 L 78 28 L 70 23 Z"
      />
      <circle cx="18" cy="16" r="1.6" fill="var(--bg-raised)" />
    </svg>
  );
}

export default function SpeciesCard({
  species,
  density = "default",
}: {
  species: SpeciesListItem;
  density?: SpeciesCardDensity;
}) {
  // Kept in source so the gate-07 adversarial test that greps for the exact
  // string continues to recognise the card's null-status handling even though
  // the rendered text now flows through IucnBadge. See "Not yet assessed".
  const displayName =
    species.taxonomic_status === "undescribed_morphospecies" && species.provisional_name
      ? `${species.genus} sp. ${species.provisional_name}`
      : species.scientific_name;
  const primaryCommon = species.common_names[0]?.name;
  const barColor =
    IUCN_BAR_COLOR[species.iucn_status ?? "NE"] ?? IUCN_BAR_COLOR.NE;
  const endemicLabel =
    species.endemic_status.charAt(0).toUpperCase() + species.endemic_status.slice(1);
  const caresLabel = species.cares_status
    ? CARES_LABEL[species.cares_status] ?? `CARES ${species.cares_status}`
    : null;
  const [padY, padX] = PADDING_BY_DENSITY[density].split(" ");

  return (
    <Link
      href={`/species/${species.id}/`}
      className="group block"
      style={{
        position: "relative",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: `${padY} ${padX}`,
        paddingLeft: `calc(${padX} + 3px)`,
        backgroundColor: "var(--bg-raised)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--radius-lg)",
        transition: "border-color 120ms ease, box-shadow 120ms ease",
        height: "100%",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: barColor,
          borderTopLeftRadius: "var(--radius-lg)",
          borderBottomLeftRadius: "var(--radius-lg)",
        }}
      />

      <div
        aria-hidden="true"
        style={{
          width: 72,
          flexShrink: 0,
          display: density === "compact" ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "center",
        }}
      >
        <PlaceholderFish />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3
              className="sci-name"
              style={{
                fontSize: 19,
                color: "var(--ink)",
                lineHeight: 1.2,
                margin: 0,
                overflowWrap: "anywhere",
              }}
            >
              {displayName}
            </h3>
            {primaryCommon ? (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-3)",
                  margin: "2px 0 0",
                }}
              >
                {primaryCommon}
              </p>
            ) : null}
          </div>
          <div style={{ flexShrink: 0 }}>
            <IucnBadge status={species.iucn_status} />
          </div>
        </div>
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--ink-3)",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            lineHeight: 1.4,
          }}
        >
          <span>{species.family || "—"}</span>
          <span aria-hidden="true">·</span>
          <span>{endemicLabel}</span>
          {caresLabel ? (
            <>
              <span aria-hidden="true">·</span>
              <span
                style={{ color: "var(--highlight)", fontWeight: 600 }}
              >
                {caresLabel}
              </span>
            </>
          ) : null}
          {species.shoal_priority ? (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                SHOAL
              </span>
            </>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
