import Link from "next/link";

export type MapView = "map" | "list";

function buildHref(
  base: string,
  currentParams: Record<string, string | string[] | undefined>,
  nextView: MapView,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(currentParams)) {
    if (k === "view") continue;
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) params.append(k, item);
    } else {
      params.set(k, v);
    }
  }
  if (nextView === "list") {
    params.set("view", "list");
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function MapViewToggle({
  current,
  searchParams,
}: {
  current: MapView;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const mapHref = buildHref("/map/", searchParams, "map");
  const listHref = buildHref("/map/", searchParams, "list");

  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex overflow-hidden rounded border border-slate-300 text-sm"
    >
      <Link
        href={mapHref}
        aria-current={current === "map" ? "page" : undefined}
        prefetch={false}
        className={
          current === "map"
            ? "bg-sky-600 px-3 py-1.5 font-semibold text-white"
            : "bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
        }
      >
        Map
      </Link>
      <Link
        href={listHref}
        aria-current={current === "list" ? "page" : undefined}
        prefetch={false}
        className={
          current === "list"
            ? "bg-sky-600 px-3 py-1.5 font-semibold text-white"
            : "bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
        }
      >
        View as list
      </Link>
    </div>
  );
}

export { buildHref as _buildHrefForTesting };
