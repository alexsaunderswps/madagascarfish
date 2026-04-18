"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

// IUCN severity ordering (CR most imperiled → NE unassessed) so sorting by
// "IUCN" surfaces the species that need attention first, not alphabetical nonsense.
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
    <th scope="col" className="px-3 py-2" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-sky-700"
      >
        <span>{label}</span>
        <span aria-hidden className={active ? "text-sky-700" : "text-slate-400"}>
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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <p className="mb-4 text-sm text-slate-600">
        Showing <strong>{totalFeatures}</strong> locality records across{" "}
        <strong>{speciesCount}</strong> species. Click a column header to sort;
        click a row to view that locality on the map.
      </p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <caption className="sr-only">
            Locality records for Madagascar freshwater fish, one row per marker
            visible on the map. Columns are sortable; clicking a row opens that
            locality on the map.
          </caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <SortHeader label="Scientific name" sortKey="scientific_name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="IUCN" sortKey="iucn_status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Locality" sortKey="locality_name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Type" sortKey="locality_type" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Presence" sortKey="presence_status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Water body" sortKey="water_body" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Year" sortKey="year_collected" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th scope="col" className="px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
            {sorted.map((f) => {
              const p = f.properties;
              const localityId = f.id ?? p.id;
              // Row-level navigation to the map focused on this locality.
              // Keeping the species-profile link intact via stopPropagation on
              // the scientific-name cell so the name still links to the profile.
              const mapHref = `/map/?species_id=${p.species_id}&focus_locality=${localityId}`;
              return (
                <tr
                  key={localityId}
                  className="cursor-pointer hover:bg-sky-50 focus-within:bg-sky-50"
                >
                  <td className="px-3 py-2 italic">
                    <Link
                      href={`/species/${p.species_id}/`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
                    >
                      {p.scientific_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={mapHref} className="block">
                      {p.iucn_status ? (
                        <span
                          className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                          style={{ backgroundColor: iucnColor(p.iucn_status) }}
                        >
                          {p.iucn_status}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={mapHref} className="block text-slate-800 hover:text-sky-800">
                      {p.locality_name || "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 capitalize">
                    <Link href={mapHref} className="block">
                      {p.locality_type.replace(/_/g, " ")}
                    </Link>
                  </td>
                  <td className="px-3 py-2 capitalize">
                    <Link href={mapHref} className="block">
                      {p.presence_status}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={mapHref} className="block">
                      {p.water_body || <span className="text-slate-400">—</span>}
                      {p.water_body_type ? (
                        <span className="ml-1 text-xs text-slate-500">
                          ({p.water_body_type})
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    <Link href={mapHref} className="block">
                      {p.year_collected ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
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
