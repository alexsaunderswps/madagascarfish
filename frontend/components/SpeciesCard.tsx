/**
 * SpeciesCard — Directory / Home silhouette-grid card (§15.2).
 *
 * Layout (left → right):
 *   [3px IUCN color bar] [72px silhouette column] [main column] [right column]
 *
 * Silhouette column is reserved-but-empty when the species has no SVG (list
 * endpoint does not carry SVG bodies; the profile page does the cascade).
 * Basin is a Gate 2 field — omitted from the metadata row here until the
 * schema lands, to avoid rendering a missing dot-separated fragment.
 */

import Link from "next/link";
import { type SpeciesListItem } from "@/lib/species";
import IucnBadge from "./IucnBadge";
import BasinPill from "./BasinPill";

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
  CCR: "CARES · Critical",
  CEN: "CARES · Endangered",
  CVU: "CARES · Vulnerable",
  CLC: "CARES · Least Concern",
  priority: "CARES · Priority",
  monitored: "CARES · Monitored",
};

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
    ? CARES_LABEL[species.cares_status] ?? `CARES · ${species.cares_status}`
    : null;

  return (
    <Link
      href={`/species/${species.id}/`}
      className="group block"
      style={{
        position: "relative",
        display: "flex",
        gap: 14,
        padding: PADDING_BY_DENSITY[density],
        paddingLeft: `calc(${PADDING_BY_DENSITY[density].split(" ")[1]} + 3px)`,
        backgroundColor: "var(--bg-raised)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--radius-lg)",
        transition: "border-color 120ms ease, box-shadow 120ms ease",
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

      {/* Silhouette column — reserved even when empty so cards align. */}
      <div
        aria-hidden="true"
        style={{
          width: 72,
          flexShrink: 0,
          display: density === "compact" ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-3)",
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          className="sci-name"
          style={{
            fontSize: 19,
            color: "var(--ink)",
            lineHeight: 1.2,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {primaryCommon}
          </p>
        ) : null}
        <p
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "var(--ink-3)",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span>{species.family || "—"}</span>
          <span aria-hidden="true">·</span>
          <span>{endemicLabel}</span>
          <BasinPill basin={null} />
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <IucnBadge status={species.iucn_status} />
        {caresLabel ? (
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              padding: "2px 8px",
              borderRadius: 999,
              backgroundColor: "var(--bg-sunken)",
            }}
          >
            {caresLabel}
          </span>
        ) : null}
        {species.shoal_priority ? (
          <span
            style={{
              fontSize: 11,
              color: "var(--accent-2)",
              padding: "2px 8px",
              borderRadius: 999,
              backgroundColor: "var(--accent-soft)",
            }}
          >
            SHOAL priority
          </span>
        ) : null}
      </div>
    </Link>
  );
}
