import { Link } from "@/i18n/routing";

const baseLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "8px 14px",
  borderRadius: "var(--radius)",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1,
  textDecoration: "none",
  border: "1px solid var(--rule-strong)",
  color: "var(--ink)",
  backgroundColor: "var(--bg-raised)",
  transition: "border-color 120ms ease, background-color 120ms ease",
} as const;

const disabledStyle = {
  ...baseLinkStyle,
  color: "var(--ink-3)",
  backgroundColor: "var(--bg-sunken)",
  borderColor: "var(--rule)",
  cursor: "not-allowed",
} as const;

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
    <nav
      aria-label="Pagination"
      style={{
        marginTop: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--ink-2)" }}>
        Page {page} of {totalPages} — {totalCount} total
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {page > 1 ? (
          <Link href={buildHref(page - 1)} style={baseLinkStyle}>
            ← Previous
          </Link>
        ) : (
          <span aria-disabled="true" style={disabledStyle}>
            ← Previous
          </span>
        )}
        {page < totalPages ? (
          <Link href={buildHref(page + 1)} style={baseLinkStyle}>
            Next →
          </Link>
        ) : (
          <span aria-disabled="true" style={disabledStyle}>
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}
