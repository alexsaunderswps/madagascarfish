import Link from "next/link";
import NavLinks from "./NavLinks";

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-slate-900"
        >
          Madagascar Freshwater Fish
        </Link>
        <nav aria-label="Primary">
          <NavLinks />
        </nav>
      </div>
    </header>
  );
}
