import Link from "next/link";

import { IUCN_LABELS, type SpeciesListItem } from "@/lib/species";

const IUCN_BADGE_CLASSES: Record<string, string> = {
  CR: "bg-red-100 text-red-900 ring-red-200",
  EN: "bg-orange-100 text-orange-900 ring-orange-200",
  VU: "bg-amber-100 text-amber-900 ring-amber-200",
  NT: "bg-yellow-100 text-yellow-900 ring-yellow-200",
  LC: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  DD: "bg-slate-100 text-slate-700 ring-slate-200",
  NE: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function SpeciesCard({ species }: { species: SpeciesListItem }) {
  const status = species.iucn_status ?? "NE";
  const badgeClass = IUCN_BADGE_CLASSES[status] ?? IUCN_BADGE_CLASSES.NE;
  const label = species.iucn_status ? IUCN_LABELS[species.iucn_status] : "Not yet assessed";
  const displayName =
    species.taxonomic_status === "undescribed_morphospecies" && species.provisional_name
      ? `${species.genus} sp. ${species.provisional_name}`
      : species.scientific_name;
  const primaryCommon = species.common_names[0]?.name;

  return (
    <Link
      href={`/species/${species.id}/`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md focus-visible:border-sky-500 focus-visible:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg italic text-slate-900">{displayName}</h3>
          {primaryCommon ? (
            <p className="truncate text-sm text-slate-600">{primaryCommon}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ring-1 ${badgeClass}`}
          title={label}
          aria-label={`IUCN status: ${label}`}
        >
          {status}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
        <div>
          <dt className="inline font-medium text-slate-500">Family: </dt>
          <dd className="inline">{species.family || "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-500">Endemic: </dt>
          <dd className="inline capitalize">{species.endemic_status}</dd>
        </div>
        {species.cares_status ? (
          <div>
            <dt className="inline font-medium text-slate-500">CARES: </dt>
            <dd className="inline">{species.cares_status}</dd>
          </div>
        ) : null}
        {species.shoal_priority ? (
          <div className="text-sky-700">SHOAL priority</div>
        ) : null}
      </dl>
    </Link>
  );
}
