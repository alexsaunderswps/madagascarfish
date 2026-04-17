import Link from "next/link";

import type { LocalityFeatureCollection } from "@/lib/mapLocalities";
import { iucnColor } from "@/lib/mapLocalities";

export default function MapListView({
  data,
}: {
  data: LocalityFeatureCollection;
}) {
  const features = data.features;
  const totalFeatures = features.length;
  const speciesCount = new Set(features.map((f) => f.properties.species_id)).size;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <p className="mb-4 text-sm text-slate-600">
        Showing <strong>{totalFeatures}</strong> locality records across{" "}
        <strong>{speciesCount}</strong> species.
      </p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <caption className="sr-only">
            Locality records for Madagascar freshwater fish, one row per marker
            visible on the map. Columns: scientific name, IUCN status, locality,
            type, presence, water body, year, source.
          </caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">
                Scientific name
              </th>
              <th scope="col" className="px-3 py-2">
                IUCN
              </th>
              <th scope="col" className="px-3 py-2">
                Locality
              </th>
              <th scope="col" className="px-3 py-2">
                Type
              </th>
              <th scope="col" className="px-3 py-2">
                Presence
              </th>
              <th scope="col" className="px-3 py-2">
                Water body
              </th>
              <th scope="col" className="px-3 py-2">
                Year
              </th>
              <th scope="col" className="px-3 py-2">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
            {features.map((f) => {
              const p = f.properties;
              return (
                <tr key={f.id ?? p.id}>
                  <td className="px-3 py-2 italic">
                    <Link
                      href={`/species/${p.species_id}/`}
                      className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
                    >
                      {p.scientific_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                  <td className="px-3 py-2">{p.locality_name || "—"}</td>
                  <td className="px-3 py-2 capitalize">
                    {p.locality_type.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2 capitalize">{p.presence_status}</td>
                  <td className="px-3 py-2">
                    {p.water_body || (
                      <span className="text-slate-400">—</span>
                    )}
                    {p.water_body_type ? (
                      <span className="ml-1 text-xs text-slate-500">
                        ({p.water_body_type})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {p.year_collected ?? "—"}
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
