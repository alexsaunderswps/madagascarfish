const REPO_URL = "https://github.com/alexsaunderswps/madagascarfish";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>Madagascar Freshwater Fish Conservation Platform</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          <li>
            <a
              href={REPO_URL}
              className="hover:text-sky-700"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </li>
          <li>Apache-2.0</li>
          <li>Data: IUCN Red List, FishBase, GBIF, ZIMS, SHOAL, CARES</li>
        </ul>
      </div>
    </footer>
  );
}
