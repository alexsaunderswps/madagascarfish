/**
 * Sticky in-page table of contents for the husbandry page.
 *
 * Renders only at lg+ widths — mobile/tablet readers use the page's natural
 * scroll order. The husbandry page has up to twelve h2 sections, and
 * coordinator users repeatedly need to jump straight to "Breeding" or
 * "Water Parameters" without paging through the others (UX review
 * 2026-04-19, post-workshop backlog).
 *
 * Items are filtered server-side by the parent so blank sections (which
 * the page elides) never appear in the TOC.
 */
export interface HusbandryTocItem {
  /** Heading id without the leading `#`. Must match the rendered h2's id. */
  id: string;
  label: string;
}

export default function HusbandryToc({
  items,
  className,
}: {
  items: HusbandryTocItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="On this page"
      className={[
        // SiteHeader is 72px tall; top-20 (80px) leaves an 8px breathing gap.
        "sticky top-20 self-start text-sm",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        On this page
      </p>
      <ul className="mt-3 space-y-1.5 border-l border-slate-200 pl-3">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="block break-words text-slate-600 hover:text-sky-700"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
