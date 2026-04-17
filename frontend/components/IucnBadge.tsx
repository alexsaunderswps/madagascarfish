import { IUCN_LABELS, type IucnStatus } from "@/lib/species";

const BADGE_CLASSES: Record<string, string> = {
  CR: "bg-red-100 text-red-900 ring-red-200",
  EN: "bg-orange-100 text-orange-900 ring-orange-200",
  VU: "bg-amber-100 text-amber-900 ring-amber-200",
  NT: "bg-yellow-100 text-yellow-900 ring-yellow-200",
  LC: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  DD: "bg-slate-100 text-slate-700 ring-slate-200",
  NE: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function IucnBadge({
  status,
  showLabel = false,
  criteria,
}: {
  status: IucnStatus | null;
  showLabel?: boolean;
  criteria?: string;
}) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
        Not yet assessed
      </span>
    );
  }
  const label = IUCN_LABELS[status];
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ring-1 ${BADGE_CLASSES[status]}`}
      title={criteria ? `${label} — criteria ${criteria}` : label}
      aria-label={`IUCN status: ${label}${criteria ? `, criteria ${criteria}` : ""}`}
    >
      {showLabel ? `${label} (${status})` : status}
    </span>
  );
}
