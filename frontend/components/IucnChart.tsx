import Link from "next/link";

import { IUCN_LABELS, type IucnStatus } from "@/lib/species";

const BAR_ORDER: IucnStatus[] = ["CR", "EN", "VU", "NT", "LC", "DD", "NE"];

const BAR_COLORS: Record<IucnStatus, string> = {
  CR: "bg-red-600",
  EN: "bg-orange-500",
  VU: "bg-amber-400",
  NT: "bg-yellow-300",
  LC: "bg-emerald-500",
  DD: "bg-slate-400",
  NE: "bg-slate-300",
};

export default function IucnChart({
  counts,
  caption,
}: {
  counts: Record<string, number>;
  caption: string;
}) {
  const max = Math.max(1, ...BAR_ORDER.map((s) => counts[s] ?? 0));
  return (
    <figure className="flex flex-col gap-3" aria-labelledby="iucn-chart-caption">
      <h2 className="text-lg font-semibold text-slate-900">Species by IUCN status</h2>
      <ul className="flex flex-col gap-2" role="list">
        {BAR_ORDER.map((status) => {
          const count = counts[status] ?? 0;
          const pct = (count / max) * 100;
          const label = `${IUCN_LABELS[status]} (${status})`;
          return (
            <li key={status}>
              <Link
                href={`/species/?iucn_status=${status}`}
                className="group grid grid-cols-[minmax(13rem,1fr)_3fr_auto] items-center gap-3 rounded px-1 py-1 text-sm hover:bg-slate-50"
                aria-label={`${count} species with status ${IUCN_LABELS[status]}`}
              >
                <span className="text-slate-700 group-hover:text-sky-700 group-hover:underline">
                  {label}
                </span>
                <span
                  className="relative h-5 w-full overflow-hidden rounded bg-slate-100"
                  aria-hidden
                >
                  <span
                    className={`absolute inset-y-0 left-0 ${BAR_COLORS[status]}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="min-w-[2.5rem] text-right font-semibold tabular-nums text-slate-900">
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <figcaption id="iucn-chart-caption" className="text-xs text-slate-500">
        {caption}
      </figcaption>
    </figure>
  );
}
