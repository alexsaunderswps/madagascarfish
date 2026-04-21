"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import type { LocalityFeature, LocalityFeatureCollection } from "@/lib/mapLocalities";
import { iucnColor } from "@/lib/mapLocalities";

type SortKey =
  | "scientific_name"
  | "iucn_status"
  | "locality_name"
  | "locality_type"
  | "presence_status"
  | "water_body"
  | "year_collected";
type SortDir = "asc" | "desc";

const IUCN_RANK: Record<string, number> = {
  CR: 0,
  EN: 1,
  VU: 2,
  NT: 3,
  LC: 4,
  DD: 5,
  NE: 6,
};

function compareValues(
  a: LocalityFeature,
  b: LocalityFeature,
  key: SortKey,
): number {
  const pa = a.properties;
  const pb = b.properties;
  switch (key) {
    case "iucn_status": {
      const ra = IUCN_RANK[pa.iucn_status ?? "NE"] ?? 99;
      const rb = IUCN_RANK[pb.iucn_status ?? "NE"] ?? 99;
      return ra - rb;
    }
    case "year_collected": {
      const ya = pa.year_collected ?? -Infinity;
      const yb = pb.year_collected ?? -Infinity;
      return ya - yb;
    }
    default: {
      const va = String((pa[key] ?? "") as string | number);
      const vb = String((pb[key] ?? "") as string | number);
      return va.localeCompare(vb, undefined, { sensitivity: "base" });
    }
  }
}

const TH_STYLE: CSSProperties = {
  padding: "10px 12px",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const TD_STYLE: CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--ink)",
  borderTop: "1px solid var(--rule)",
};

const CELL_LINK_STYLE: CSSProperties = {
  display: "block",
  color: "inherit",
  textDecoration: "none",
};

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  const indicator = active ? (dir === "asc" ? "▲" : "▼") : "↕";
  return (
    <th
      scope="col"
      style={TH_STYLE}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          font: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          color: active ? "var(--accent-2)" : "var(--ink-3)",
          fontWeight: 700,
        }}
      >
        <span>{label}</span>
        <span
          aria-hidden="true"
          style={{ color: active ? "var(--accent-2)" : "var(--ink-3)" }}
        >
          {indicator}
        </span>
      </button>
    </th>
  );
}

export default function MapListView({
  data,
}: {
  data: LocalityFeatureCollection;
}) {
  const features = data.features;
  const totalFeatures = features.length;
  const speciesCount = new Set(features.map((f) => f.properties.species_id)).size;

  const [sortKey, setSortKey] = useState<SortKey>("scientific_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const copy = features.slice();
    copy.sort((a, b) => {
      const c = compareValues(a, b, sortKey);
      return sortDir === "asc" ? c : -c;
    });
    return copy;
  }, [features, sortKey, sortDir]);

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "32px 24px 48px",
      }}
    >
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-2)" }}>
        Showing{" "}
        <strong style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
          {totalFeatures}
        </strong>{" "}
        locality records across{" "}
        <strong style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
          {speciesCount}
        </strong>{" "}
        species. Click a column header to sort; use the Locality link in each
        row to view it on the map.
      </p>
      <div
        style={{
          overflowX: "auto",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--rule)",
          backgroundColor: "var(--bg-raised)",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 960,
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <caption className="sr-only">
            Locality records for Madagascar freshwater fish, one row per marker
            visible on the map. Columns are sortable; use each row&rsquo;s
            Locality link to open that locality on the map.
          </caption>
          <thead style={{ backgroundColor: "var(--bg-sunken)" }}>
            <tr>
              <SortHeader label="Scientific name" sortKey="scientific_name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="IUCN" sortKey="iucn_status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Locality" sortKey="locality_name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Type" sortKey="locality_type" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Presence" sortKey="presence_status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Water body" sortKey="water_body" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Year" sortKey="year_collected" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th scope="col" style={TH_STYLE}>Source</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => {
              const p = f.properties;
              const localityId = f.id ?? p.id;
              const mapHref = `/map/?species_id=${p.species_id}&focus_locality=${localityId}`;
              return (
                <tr key={localityId}>
                  <td style={{ ...TD_STYLE, fontStyle: "italic" }}>
                    <Link
                      href={`/species/${p.species_id}/`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: "var(--accent-2)",
                        textDecoration: "none",
                        borderBottom:
                          "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
                      }}
                    >
                      {p.scientific_name}
                    </Link>
                  </td>
                  <td style={TD_STYLE}>
                    <Link href={mapHref} style={CELL_LINK_STYLE}>
                      {p.iucn_status ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "var(--radius)",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#fff",
                            backgroundColor: iucnColor(p.iucn_status),
                          }}
                        >
                          {p.iucn_status}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-3)" }}>—</span>
                      )}
                    </Link>
                  </td>
                  <td style={TD_STYLE}>
                    <Link href={mapHref} style={CELL_LINK_STYLE}>
                      {p.locality_name || "—"}
                    </Link>
                  </td>
                  <td style={{ ...TD_STYLE, textTransform: "capitalize" }}>
                    <Link href={mapHref} style={CELL_LINK_STYLE}>
                      {p.locality_type.replace(/_/g, " ")}
                    </Link>
                  </td>
                  <td style={{ ...TD_STYLE, textTransform: "capitalize" }}>
                    <Link href={mapHref} style={CELL_LINK_STYLE}>
                      {p.presence_status}
                    </Link>
                  </td>
                  <td style={TD_STYLE}>
                    <Link href={mapHref} style={CELL_LINK_STYLE}>
                      {p.water_body || (
                        <span style={{ color: "var(--ink-3)" }}>—</span>
                      )}
                      {p.water_body_type ? (
                        <span
                          style={{
                            marginLeft: 4,
                            fontSize: 11,
                            color: "var(--ink-3)",
                          }}
                        >
                          ({p.water_body_type})
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td style={{ ...TD_STYLE, fontVariantNumeric: "tabular-nums" }}>
                    <Link href={mapHref} style={CELL_LINK_STYLE}>
                      {p.year_collected ?? "—"}
                    </Link>
                  </td>
                  <td style={{ ...TD_STYLE, fontSize: 12, color: "var(--ink-3)" }}>
                    {p.source_citation || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
