import Link from "next/link";
import { notFound } from "next/navigation";

import IucnBadge from "@/components/IucnBadge";
import {
  displayScientificName,
  fetchSpeciesDetail,
  fishbaseGenusSpeciesUrl,
  iucnRedListUrl,
  type SpeciesDetail,
} from "@/lib/speciesDetail";

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;

function backLinkHref(from: string | string[] | undefined): string {
  const raw = Array.isArray(from) ? from[0] : from;
  if (!raw) return "/species";
  if (raw.startsWith("/species")) return raw;
  if (raw.startsWith("?")) return `/species${raw}`;
  return "/species";
}

function countPopulatedFields(sp: SpeciesDetail): number {
  const candidates: Array<unknown> = [
    sp.description,
    sp.ecology_notes,
    sp.distribution_narrative,
    sp.morphology,
    sp.habitat_type,
    sp.authority,
    sp.max_length_cm,
    sp.common_names.length > 0 ? "y" : "",
  ];
  return candidates.filter((v) => v != null && v !== "" && v !== 0).length;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const result = await fetchSpeciesDetail(params.id);
  if (result.kind !== "ok") {
    return { title: "Species not found — Madagascar Freshwater Fish" };
  }
  const name = displayScientificName(result.data);
  return {
    title: `${name} — Madagascar Freshwater Fish`,
    description: result.data.description?.slice(0, 160) ?? `Species profile for ${name}.`,
  };
}

export default async function SpeciesProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const result = await fetchSpeciesDetail(params.id);
  if (result.kind === "not_found") notFound();
  if (result.kind === "error") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-2xl text-slate-900">
          Species data temporarily unavailable
        </h1>
        <p className="mt-4 text-slate-600">
          We couldn&apos;t load this profile just now. Please try again shortly.
        </p>
        <Link
          href="/species"
          className="mt-6 inline-block rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
        >
          ← All species
        </Link>
      </main>
    );
  }
  const sp = result.data;
  const displayName = displayScientificName(sp);
  const backHref = backLinkHref(searchParams.from);
  const undescribed = sp.taxonomic_status === "undescribed_morphospecies";
  const sparse = countPopulatedFields(sp) < 3;

  const acceptedIucn = sp.conservation_assessments.find(
    (a) => a.source === "iucn_official" || a.source === "manual_expert",
  );
  const iucnUrl = iucnRedListUrl(sp.iucn_taxon_id);
  const fishbaseUrl = fishbaseGenusSpeciesUrl(sp);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={backHref} className="text-sm text-sky-700 hover:underline">
        ← All species
      </Link>

      <header className="mt-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl italic text-slate-900">{displayName}</h1>
            {undescribed ? (
              <p className="mt-1 text-sm">
                <span className="mr-2 rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-sky-200">
                  Provisional Name
                </span>
                <span className="text-slate-600">Undescribed taxon — formal description pending.</span>
              </p>
            ) : sp.authority || sp.year_described ? (
              <p className="mt-1 text-sm text-slate-600">
                {sp.authority}
                {sp.authority && sp.year_described ? ", " : ""}
                {sp.year_described}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-slate-600">
              {sp.family} · {sp.genus} · <span className="capitalize">{sp.endemic_status}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <IucnBadge
              status={sp.iucn_status}
              showLabel
              criteria={acceptedIucn?.criteria}
            />
            {sp.has_localities ? (
              <Link
                href={`/map?species_id=${sp.id}`}
                className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-400"
              >
                View on Map →
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {sparse ? (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Limited public data available for this species. Check back as our directory grows.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="conservation-heading">
          <h2 id="conservation-heading" className="font-serif text-xl text-slate-900">
            Conservation Status
          </h2>
          {acceptedIucn ? (
            <dl className="mt-2 text-sm text-slate-700">
              <div>
                <dt className="inline font-medium text-slate-500">Category: </dt>
                <dd className="inline">{acceptedIucn.category}</dd>
              </div>
              {acceptedIucn.criteria ? (
                <div>
                  <dt className="inline font-medium text-slate-500">Criteria: </dt>
                  <dd className="inline">{acceptedIucn.criteria}</dd>
                </div>
              ) : null}
              {acceptedIucn.assessor ? (
                <div>
                  <dt className="inline font-medium text-slate-500">Assessor: </dt>
                  <dd className="inline">{acceptedIucn.assessor}</dd>
                </div>
              ) : null}
              {acceptedIucn.assessment_date ? (
                <div>
                  <dt className="inline font-medium text-slate-500">Date: </dt>
                  <dd className="inline">{acceptedIucn.assessment_date}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Not yet assessed.</p>
          )}
          {sp.cares_status ? (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium text-slate-500">CARES: </span>
              {sp.cares_status}
            </p>
          ) : null}
          {sp.shoal_priority ? (
            <p className="mt-1 text-sm text-sky-700">SHOAL 1,000 Fishes priority species</p>
          ) : null}
        </section>

        <section aria-labelledby="common-names-heading">
          <h2 id="common-names-heading" className="font-serif text-xl text-slate-900">
            Common Names
          </h2>
          {sp.common_names.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No common names recorded.</p>
          ) : (
            <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
              {sp.common_names.map((cn) => (
                <li key={`${cn.language}-${cn.name}`}>
                  {cn.name} <span className="text-slate-500">({cn.language})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {sp.description || sp.ecology_notes || sp.morphology ? (
        <section aria-labelledby="ecology-heading" className="mt-8">
          <h2 id="ecology-heading" className="font-serif text-xl text-slate-900">
            Description &amp; Ecology
          </h2>
          {sp.description ? (
            <p className="mt-2 text-sm text-slate-700">{sp.description}</p>
          ) : null}
          {sp.ecology_notes ? (
            <p className="mt-2 text-sm text-slate-700">{sp.ecology_notes}</p>
          ) : null}
          {sp.morphology ? (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium text-slate-500">Morphology: </span>
              {sp.morphology}
            </p>
          ) : null}
          {sp.max_length_cm ? (
            <p className="mt-1 text-sm text-slate-700">
              <span className="font-medium text-slate-500">Max length: </span>
              {sp.max_length_cm} cm
            </p>
          ) : null}
          {sp.habitat_type ? (
            <p className="mt-1 text-sm text-slate-700">
              <span className="font-medium text-slate-500">Habitat: </span>
              {sp.habitat_type}
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="captive-heading" className="mt-8">
        <h2 id="captive-heading" className="font-serif text-xl text-slate-900">
          Captive Population Summary
        </h2>
        {sp.ex_situ_summary.institutions_holding === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No captive population is currently tracked.
          </p>
        ) : (
          <dl className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Institutions holding</dt>
              <dd className="font-semibold text-slate-900">
                {sp.ex_situ_summary.institutions_holding}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Total individuals</dt>
              <dd className="font-semibold text-slate-900">
                {sp.ex_situ_summary.total_individuals}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Active breeding programs</dt>
              <dd className="font-semibold text-slate-900">
                {sp.ex_situ_summary.breeding_programs}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section aria-labelledby="field-heading" className="mt-8">
        <h2 id="field-heading" className="font-serif text-xl text-slate-900">
          Field Programs
        </h2>
        {sp.field_programs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No active field programs are linked to this species.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {sp.field_programs.map((fp) => (
              <li key={fp.id}>
                {fp.name} <span className="text-slate-500">({fp.status})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {iucnUrl || fishbaseUrl ? (
        <section aria-labelledby="links-heading" className="mt-8">
          <h2 id="links-heading" className="font-serif text-xl text-slate-900">
            External Links
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {iucnUrl ? (
              <li>
                <a
                  href={iucnUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-700 hover:underline"
                >
                  IUCN Red List assessment →
                </a>
              </li>
            ) : null}
            {fishbaseUrl ? (
              <li>
                <a
                  href={fishbaseUrl}
                  target="_blank"
                  rel="noopener"
                  className="text-sky-700 hover:underline"
                >
                  FishBase species summary →
                </a>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
