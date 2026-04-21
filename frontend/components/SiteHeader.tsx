import Link from "next/link";
import NavLinks from "./NavLinks";

export default function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200"
      style={{
        backgroundColor: "color-mix(in oklab, var(--bg-raised) 90%, transparent)",
        backdropFilter: "saturate(140%) blur(8px)",
        WebkitBackdropFilter: "saturate(140%) blur(8px)",
      }}
    >
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <div
        className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-5 px-7"
      >
        <Link
          href="/"
          className="font-serif text-[15px] font-medium tracking-tight text-slate-900"
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
