import Link from "next/link";

import IucnChart from "@/components/IucnChart";
import UpdatedAgo from "@/components/UpdatedAgo";
import { fetchDashboard } from "@/lib/dashboard";

export const revalidate = 3600;

export const metadata = {
  title: "Conservation Dashboard — Madagascar Freshwater Fish",
  description:
    "Counts of endemic freshwater fish species, IUCN Red List breakdown, ex-situ coverage, and field programs in Madagascar. Refreshed hourly.",
};

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

const COVERAGE_GAP_HREF =
  "/species/?iucn_status=CR,EN,VU&has_captive_population=false";

const CHART_CAPTION =
  "Counts mirror the most recent accepted IUCN Red List assessment for each endemic species in the registry. Species with no assessment appear as Not yet assessed.";

function StalenessBanner({ reason }: { reason: "failure" | "stale" }) {
  const message =
    reason === "failure"
      ? "Current statistics are temporarily unavailable. The last successfully retrieved values are shown below."
      : "The counts shown are older than the usual refresh window. A refresh is in progress.";
  return (
    <div
      role="status"
      className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      {message}
    </div>
  );
}

function StatTile({
  label,
  value,
  sublabel,
  href,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  href?: string;
}) {
  const inner = (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-3xl font-semibold tabular-nums text-slate-900">{value}</span>
      {sublabel ? <span className="text-xs text-slate-500">{sublabel}</span> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:ring-2 hover:ring-sky-300">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function DashboardPage() {
  const data = await fetchDashboard();

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Conservation Dashboard</h1>
        <div className="mt-6">
          <StalenessBanner reason="failure" />
        </div>
        <p className="mt-6 text-slate-600">
          Try again in a moment, or browse the{" "}
          <Link href="/species/" className="text-sky-700 underline">
            species directory
          </Link>
          .
        </p>
      </main>
    );
  }

  const { species_counts, ex_situ_coverage, field_programs, last_updated } = data;
  const lastUpdatedMs = Date.parse(last_updated);
  const isStale =
    Number.isFinite(lastUpdatedMs) && Date.now() - lastUpdatedMs > STALE_THRESHOLD_MS;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
          Conservation Dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Madagascar freshwater fish at a glance
        </h1>
        <UpdatedAgo iso={last_updated} />
      </header>

      {isStale ? <StalenessBanner reason="stale" /> : null}

      <Link
        href={COVERAGE_GAP_HREF}
        className="group block rounded-lg border border-amber-200 bg-amber-50 p-6 transition hover:border-amber-300 hover:bg-amber-100"
        data-testid="coverage-gap-stat"
      >
        <p className="text-lg font-medium text-amber-900 sm:text-xl">
          <span className="text-2xl font-semibold sm:text-3xl">
            {ex_situ_coverage.threatened_species_without_captive_population}
          </span>{" "}
          of{" "}
          <span className="text-2xl font-semibold sm:text-3xl">
            {ex_situ_coverage.threatened_species_total}
          </span>{" "}
          threatened species have no known captive population.
          <span className="mt-2 block text-sm font-normal text-amber-800 underline-offset-2 group-hover:underline">
            See which species &rarr;
          </span>
        </p>
      </Link>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <IucnChart counts={species_counts.by_iucn_status} caption={CHART_CAPTION} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Species totals">
        <StatTile
          label="Total species"
          value={species_counts.total}
          sublabel={`${species_counts.described} described, ${species_counts.undescribed} undescribed`}
          href="/species/"
        />
        <StatTile
          label="Institutions holding captive populations"
          value={ex_situ_coverage.institutions_active}
        />
        <StatTile
          label="Ex-situ populations tracked"
          value={ex_situ_coverage.total_populations_tracked}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Field programs">
        <StatTile label="Active field programs" value={field_programs.active} />
        <StatTile label="Planned" value={field_programs.planned} />
        <StatTile label="Completed" value={field_programs.completed} />
      </section>
    </main>
  );
}
