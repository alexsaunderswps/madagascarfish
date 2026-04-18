import Link from "next/link";
import { notFound } from "next/navigation";

import HusbandryDifficultyFactors from "@/components/HusbandryDifficultyFactors";
import HusbandryDisclaimer from "@/components/HusbandryDisclaimer";
import HusbandrySourcingEthics from "@/components/HusbandrySourcingEthics";
import {
  fetchSpeciesHusbandry,
  narrativeExcerpt,
  type SpeciesHusbandry,
} from "@/lib/husbandry";
import {
  displayScientificName,
  fetchSpeciesDetail,
  type SpeciesDetail,
} from "@/lib/speciesDetail";

export const revalidate = 3600;

type PageParams = { id: string };

/**
 * Format a min/max numeric range like "22 – 26 °C", eliding either side if
 * null. Returns null when both are null, so callers can elide the row.
 */
function formatRange(
  min: string | number | null,
  max: string | number | null,
  unit: string,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min} – ${max} ${unit}`.trim();
  if (min != null) return `≥ ${min} ${unit}`.trim();
  return `≤ ${max} ${unit}`.trim();
}

/**
 * Compact at-a-glance row — renders a definition-list entry, or nothing when
 * value is blank (spec: elide blank fields).
 */
function Glance({ label, value }: { label: string; value: string | null }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function hasAnyWater(h: SpeciesHusbandry): boolean {
  return Boolean(
    h.water_temp_c_min ||
      h.water_temp_c_max ||
      h.water_ph_min ||
      h.water_ph_max ||
      h.water_hardness_dgh_min ||
      h.water_hardness_dgh_max ||
      h.water_hardness_dkh_min ||
      h.water_hardness_dkh_max ||
      h.water_flow ||
      h.water_notes,
  );
}

function hasAnyTank(h: SpeciesHusbandry): boolean {
  return Boolean(
    h.tank_min_volume_liters ||
      h.tank_min_footprint_cm ||
      h.tank_aquascape ||
      h.tank_substrate ||
      h.tank_cover ||
      h.tank_notes,
  );
}

function hasAnyDiet(h: SpeciesHusbandry): boolean {
  return Boolean(
    (h.diet_accepted_foods && h.diet_accepted_foods.length > 0) ||
      h.diet_live_food_required ||
      h.diet_feeding_frequency ||
      h.diet_notes,
  );
}

function hasAnyBehavior(h: SpeciesHusbandry): boolean {
  return Boolean(
    h.behavior_temperament ||
      h.behavior_recommended_sex_ratio ||
      h.behavior_schooling ||
      h.behavior_community_compatibility ||
      h.behavior_notes,
  );
}

function hasAnyBreeding(h: SpeciesHusbandry): boolean {
  return Boolean(
    h.breeding_spawning_mode ||
      h.breeding_triggers ||
      h.breeding_egg_count_typical ||
      h.breeding_fry_care ||
      h.breeding_survival_bottlenecks ||
      h.breeding_notes,
  );
}

export async function generateMetadata({ params }: { params: PageParams }) {
  const [speciesResult, husbandryResult] = await Promise.all([
    fetchSpeciesDetail(params.id),
    fetchSpeciesHusbandry(params.id),
  ]);

  if (speciesResult.kind !== "ok" || husbandryResult.kind !== "ok") {
    return { title: "Husbandry not found — Madagascar Freshwater Fish" };
  }

  const name = displayScientificName(speciesResult.data);
  const description =
    narrativeExcerpt(husbandryResult.data.narrative) ||
    `Husbandry and breeding guidance for ${name}.`;

  return {
    title: `Keeping ${name} — Madagascar Freshwater Fish`,
    description,
  };
}

export default async function HusbandryPage({ params }: { params: PageParams }) {
  const [speciesResult, husbandryResult] = await Promise.all([
    fetchSpeciesDetail(params.id),
    fetchSpeciesHusbandry(params.id),
  ]);

  // AC-09.9: 404 when no published husbandry record (or species missing).
  if (speciesResult.kind === "not_found" || husbandryResult.kind === "not_found") {
    notFound();
  }

  if (speciesResult.kind === "error" || husbandryResult.kind === "error") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-2xl text-slate-900">
          Husbandry guidance temporarily unavailable
        </h1>
        <p className="mt-4 text-slate-600">
          The husbandry data service is unreachable. Try again in a moment.
        </p>
        <Link
          href={`/species/${params.id}/`}
          className="mt-6 inline-block rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
        >
          ← Back to species
        </Link>
      </main>
    );
  }

  const sp: SpeciesDetail = speciesResult.data;
  const h: SpeciesHusbandry = husbandryResult.data;
  const displayName = displayScientificName(sp);

  const showWater = hasAnyWater(h);
  const showTank = hasAnyTank(h);
  const showDiet = hasAnyDiet(h);
  const showBehavior = hasAnyBehavior(h);
  const showBreeding = hasAnyBreeding(h);

  // At-a-glance values — strings or null.
  const glanceSpawningMode = h.breeding_spawning_mode
    ? h.breeding_spawning_mode.replace(/_/g, " ")
    : null;
  const glanceFlow = h.water_flow || null;
  const glanceMinVolume = h.tank_min_volume_liters
    ? `${h.tank_min_volume_liters} L`
    : null;
  const glanceSexRatio = h.behavior_recommended_sex_ratio || null;
  const glanceLiveFood = h.diet_live_food_required ? "Yes" : null;
  const glanceCaresBreeders = h.sourcing_cares_registered_breeders ? "Yes" : null;

  const hasAnyGlance = Boolean(
    glanceSpawningMode ||
      glanceFlow ||
      glanceMinVolume ||
      glanceSexRatio ||
      glanceLiveFood ||
      glanceCaresBreeders,
  );

  const tempRange = formatRange(h.water_temp_c_min, h.water_temp_c_max, "°C");
  const phRange = formatRange(h.water_ph_min, h.water_ph_max, "pH");
  const dghRange = formatRange(
    h.water_hardness_dgh_min,
    h.water_hardness_dgh_max,
    "°dGH",
  );
  const dkhRange = formatRange(
    h.water_hardness_dkh_min,
    h.water_hardness_dkh_max,
    "°dKH",
  );

  const narrativeParagraphs = h.narrative ? h.narrative : "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* 1. Breadcrumb */}
      <Link
        href={`/species/${sp.id}/`}
        className="text-sm text-sky-700 hover:underline"
      >
        ← <span className="italic">{displayName}</span>
      </Link>

      {/* 2. Page title */}
      <header className="mt-3 border-b border-slate-200 pb-4">
        <h1 className="font-serif text-3xl text-slate-900">
          Keeping <span className="italic">{displayName}</span>
        </h1>
      </header>

      {/* 3. Disclaimer */}
      <HusbandryDisclaimer />

      {/* 4. At-a-glance panel */}
      {hasAnyGlance ? (
        <section aria-labelledby="at-a-glance-heading" className="mt-8">
          <h2
            id="at-a-glance-heading"
            className="font-serif text-xl text-slate-900"
          >
            At a glance
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Glance label="Spawning mode" value={glanceSpawningMode} />
            <Glance label="Flow preference" value={glanceFlow} />
            <Glance label="Min tank volume" value={glanceMinVolume} />
            <Glance label="Sex ratio" value={glanceSexRatio} />
            <Glance label="Live food required" value={glanceLiveFood} />
            <Glance
              label="CARES registered breeders"
              value={glanceCaresBreeders}
            />
          </dl>
        </section>
      ) : null}

      {/* 5. Difficulty factors (component elides itself when all blank) */}
      <HusbandryDifficultyFactors husbandry={h} />

      {/* 6. Water parameters */}
      {showWater ? (
        <section aria-labelledby="water-heading" className="mt-8">
          <h2 id="water-heading" className="font-serif text-xl text-slate-900">
            Water Parameters
          </h2>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            {tempRange ? (
              <div>
                <dt className="inline font-medium text-slate-500">Temperature: </dt>
                <dd className="inline">{tempRange}</dd>
              </div>
            ) : null}
            {phRange ? (
              <div>
                <dt className="inline font-medium text-slate-500">pH: </dt>
                <dd className="inline">{phRange}</dd>
              </div>
            ) : null}
            {dghRange ? (
              <div>
                <dt className="inline font-medium text-slate-500">Hardness (dGH): </dt>
                <dd className="inline">{dghRange}</dd>
              </div>
            ) : null}
            {dkhRange ? (
              <div>
                <dt className="inline font-medium text-slate-500">Hardness (dKH): </dt>
                <dd className="inline">{dkhRange}</dd>
              </div>
            ) : null}
            {h.water_flow ? (
              <div>
                <dt className="inline font-medium text-slate-500">Flow: </dt>
                <dd className="inline capitalize">{h.water_flow}</dd>
              </div>
            ) : null}
          </dl>
          {h.water_notes ? (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
              {h.water_notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 7. Tank & system */}
      {showTank ? (
        <section aria-labelledby="tank-heading" className="mt-8">
          <h2 id="tank-heading" className="font-serif text-xl text-slate-900">
            Tank &amp; System
          </h2>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            {h.tank_min_volume_liters ? (
              <div>
                <dt className="inline font-medium text-slate-500">Minimum volume: </dt>
                <dd className="inline">{h.tank_min_volume_liters} L</dd>
              </div>
            ) : null}
            {h.tank_min_footprint_cm ? (
              <div>
                <dt className="inline font-medium text-slate-500">Minimum footprint: </dt>
                <dd className="inline">{h.tank_min_footprint_cm}</dd>
              </div>
            ) : null}
            {h.tank_aquascape ? (
              <div>
                <dt className="font-medium text-slate-500">Aquascape</dt>
                <dd className="mt-0.5 whitespace-pre-line">{h.tank_aquascape}</dd>
              </div>
            ) : null}
            {h.tank_substrate ? (
              <div>
                <dt className="font-medium text-slate-500">Substrate</dt>
                <dd className="mt-0.5 whitespace-pre-line">{h.tank_substrate}</dd>
              </div>
            ) : null}
            {h.tank_cover ? (
              <div>
                <dt className="font-medium text-slate-500">Cover</dt>
                <dd className="mt-0.5 whitespace-pre-line">{h.tank_cover}</dd>
              </div>
            ) : null}
          </dl>
          {h.tank_notes ? (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
              {h.tank_notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 8. Diet */}
      {showDiet ? (
        <section aria-labelledby="diet-heading" className="mt-8">
          <h2 id="diet-heading" className="font-serif text-xl text-slate-900">
            Diet
          </h2>
          {h.diet_accepted_foods && h.diet_accepted_foods.length > 0 ? (
            <div className="mt-2 text-sm text-slate-700">
              <p className="font-medium text-slate-500">Accepted foods</p>
              <ul className="mt-0.5 list-disc pl-5">
                {h.diet_accepted_foods.map((food) => (
                  <li key={food}>{food}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            {h.diet_live_food_required ? (
              <div>
                <dt className="inline font-medium text-slate-500">Live food required: </dt>
                <dd className="inline">Yes</dd>
              </div>
            ) : null}
            {h.diet_feeding_frequency ? (
              <div>
                <dt className="inline font-medium text-slate-500">Feeding frequency: </dt>
                <dd className="inline">{h.diet_feeding_frequency}</dd>
              </div>
            ) : null}
          </dl>
          {h.diet_notes ? (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
              {h.diet_notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 9. Behavior & social structure */}
      {showBehavior ? (
        <section aria-labelledby="behavior-heading" className="mt-8">
          <h2 id="behavior-heading" className="font-serif text-xl text-slate-900">
            Behavior &amp; Social Structure
          </h2>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            {h.behavior_temperament ? (
              <div>
                <dt className="inline font-medium text-slate-500">Temperament: </dt>
                <dd className="inline">{h.behavior_temperament}</dd>
              </div>
            ) : null}
            {h.behavior_recommended_sex_ratio ? (
              <div>
                <dt className="inline font-medium text-slate-500">Sex ratio: </dt>
                <dd className="inline">{h.behavior_recommended_sex_ratio}</dd>
              </div>
            ) : null}
            {h.behavior_schooling ? (
              <div>
                <dt className="inline font-medium text-slate-500">Schooling: </dt>
                <dd className="inline">{h.behavior_schooling}</dd>
              </div>
            ) : null}
            {h.behavior_community_compatibility ? (
              <div>
                <dt className="inline font-medium text-slate-500">Community compatibility: </dt>
                <dd className="inline">{h.behavior_community_compatibility}</dd>
              </div>
            ) : null}
          </dl>
          {h.behavior_notes ? (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
              {h.behavior_notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 10. Breeding */}
      {showBreeding ? (
        <section aria-labelledby="breeding-heading" className="mt-8">
          <h2 id="breeding-heading" className="font-serif text-xl text-slate-900">
            Breeding
          </h2>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            {h.breeding_spawning_mode ? (
              <div>
                <dt className="inline font-medium text-slate-500">Spawning mode: </dt>
                <dd className="inline capitalize">
                  {h.breeding_spawning_mode.replace(/_/g, " ")}
                </dd>
              </div>
            ) : null}
            {h.breeding_triggers ? (
              <div>
                <dt className="font-medium text-slate-500">Triggers</dt>
                <dd className="mt-0.5 whitespace-pre-line">{h.breeding_triggers}</dd>
              </div>
            ) : null}
            {h.breeding_egg_count_typical ? (
              <div>
                <dt className="inline font-medium text-slate-500">Typical egg count: </dt>
                <dd className="inline">{h.breeding_egg_count_typical}</dd>
              </div>
            ) : null}
            {h.breeding_fry_care ? (
              <div>
                <dt className="font-medium text-slate-500">Fry care</dt>
                <dd className="mt-0.5 whitespace-pre-line">{h.breeding_fry_care}</dd>
              </div>
            ) : null}
            {h.breeding_survival_bottlenecks ? (
              <div>
                <dt className="font-medium text-slate-500">Survival bottlenecks</dt>
                <dd className="mt-0.5 whitespace-pre-line">
                  {h.breeding_survival_bottlenecks}
                </dd>
              </div>
            ) : null}
          </dl>
          {h.breeding_notes ? (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
              {h.breeding_notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 11. Narrative (plain text, whitespace-pre-line — no Markdown at MVP) */}
      {narrativeParagraphs ? (
        <section aria-labelledby="narrative-heading" className="mt-8">
          <h2 id="narrative-heading" className="font-serif text-xl text-slate-900">
            Narrative
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
            {narrativeParagraphs}
          </p>
        </section>
      ) : null}

      {/* 12. Sourcing ethics (reused unchanged) + species-specific notes */}
      <HusbandrySourcingEthics />
      {h.sourcing_notes ? (
        <section aria-labelledby="sourcing-notes-heading" className="mt-4">
          <h2
            id="sourcing-notes-heading"
            className="font-serif text-lg text-slate-900"
          >
            Sourcing notes for this species
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
            {h.sourcing_notes}
          </p>
        </section>
      ) : null}

      {/* 13. References */}
      {h.sources.length > 0 ? (
        <section aria-labelledby="references-heading" className="mt-8">
          <h2
            id="references-heading"
            className="font-serif text-xl text-slate-900"
          >
            References
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {h.sources.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 hover:underline"
                  >
                    {s.label}
                  </a>
                ) : (
                  <span>{s.label}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 14. Governance footer: reviewed-by stamp + stale note */}
      {h.last_reviewed_by || h.last_reviewed_at ? (
        <p className="mt-10 text-xs text-slate-500">
          Reviewed by{" "}
          <span className="font-medium text-slate-700">
            {h.last_reviewed_by?.name ?? "unknown"}
          </span>
          {h.last_reviewed_by?.orcid_id ? (
            <>
              {" "}
              <a
                href={`https://orcid.org/${h.last_reviewed_by.orcid_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 hover:underline"
              >
                (ORCID {h.last_reviewed_by.orcid_id})
              </a>
            </>
          ) : null}
          {h.last_reviewed_at ? <> on {h.last_reviewed_at}.</> : "."}
          {h.review_is_stale ? (
            <>
              {" "}
              <span className="text-slate-400">
                Review pending — content may be out of date.
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      {/* 15. Contributors */}
      {h.contributors ? (
        <p className="mt-2 text-xs text-slate-500">
          Contributors: <span className="text-slate-700">{h.contributors}</span>
        </p>
      ) : null}

      {/* 16. Contribute updates CTA */}
      <p className="mt-6 text-sm">
        <Link
          href={`/contribute/husbandry?species=${sp.id}`}
          className="text-sky-700 hover:underline"
        >
          Contribute updates <span aria-hidden="true">→</span>
        </Link>
      </p>

      {/* 17. Cross-links back into species context */}
      <nav
        aria-label="Related species context"
        className="mt-8 border-t border-slate-200 pt-4 text-sm"
      >
        <ul className="space-y-1">
          {sp.field_programs.length > 0 ? (
            <li>
              <Link
                href={`/species/${sp.id}/#field-heading`}
                className="text-sky-700 hover:underline"
              >
                Field programs for this species{" "}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ) : null}
          {sp.ex_situ_summary.institutions_holding > 0 ? (
            <li className="text-slate-700">
              Held at {sp.ex_situ_summary.institutions_holding}{" "}
              {sp.ex_situ_summary.institutions_holding === 1
                ? "institution"
                : "institutions"}
              .{" "}
              <Link
                href={`/species/${sp.id}/#captive-heading`}
                className="text-sky-700 hover:underline"
              >
                See captive population summary{" "}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </main>
  );
}
