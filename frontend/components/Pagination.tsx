import Link from "next/link";

export default function Pagination({
  page,
  totalCount,
  pageSize,
  searchParams,
}: {
  page: number;
  totalCount: number;
  pageSize: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v == null) continue;
      const val = Array.isArray(v) ? v[0] : v;
      if (val) params.set(k, val);
    }
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/species/?${qs}` : "/species/";
  };

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
      <div className="text-slate-600">
        Page {page} of {totalPages} — {totalCount} total
      </div>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="rounded border border-slate-300 px-3 py-1 hover:border-slate-400"
          >
            ← Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            className="rounded border border-slate-300 px-3 py-1 hover:border-slate-400"
          >
            Next →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
