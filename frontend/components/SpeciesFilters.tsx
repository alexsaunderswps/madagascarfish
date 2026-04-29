"use client";

/**
 * SpeciesFilters — S19 filter rail.
 *
 * Layout matches the pre-S19 rail: Search, IUCN chips, Family select,
 * Taxonomic status select, CARES-any + SHOAL toggles, Captive population,
 * Introduced species, Clear button, and a collapsible IUCN legend at the
 * bottom. The only structural change from the pre-S19 rail is that chip
 * clicks push URL state immediately — no Apply button.
 *
 * Search still requires Enter/submit so the user can type freely without
 * thrashing the route on every keystroke.
 *
 * Routing uses the locale-aware router from @/i18n/routing so filter
 * navigation preserves the active locale (a user filtering on
 * /fr/species/ stays on /fr/species/?...).
 */

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useRouter } from "@/i18n/routing";
import {
  IUCN_STATUSES,
  KNOWN_FAMILIES,
  type IucnStatus,
  type SpeciesFilterState,
} from "@/lib/species";

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function SpeciesFilters({ initial }: { initial: SpeciesFilterState }) {
  const t = useTranslations("species.directory.filters");
  const tCommon = useTranslations("common.iucn");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initial.search ?? "");

  function push(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/species/?${qs}` : "/species/");
  }

  const onSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    push((p) => {
      p.delete("search");
      if (search.trim()) p.set("search", search.trim());
    });
  };

  const toggleIucn = (s: IucnStatus) =>
    push((p) => {
      const next = toggle(initial.iucn_status ?? [], s);
      p.delete("iucn_status");
      if (next.length > 0) p.set("iucn_status", next.join(","));
    });

  const setFamily = (f: string) =>
    push((p) => {
      p.delete("family");
      if (f) p.set("family", f);
    });

  const setTaxStatus = (v: string) =>
    push((p) => {
      p.delete("taxonomic_status");
      if (v) p.set("taxonomic_status", v);
    });

  const toggleCares = () =>
    push((p) => {
      if (initial.has_cares === "true") p.delete("has_cares");
      else p.set("has_cares", "true");
    });

  const toggleShoal = () =>
    push((p) => {
      if (initial.shoal_priority === "true") p.delete("shoal_priority");
      else p.set("shoal_priority", "true");
    });

  const setCaptive = (v: "" | "true" | "false") =>
    push((p) => {
      p.delete("has_captive_population");
      if (v) p.set("has_captive_population", v);
    });

  const toggleIncludeIntroduced = () =>
    push((p) => {
      if (initial.include_introduced === "true") p.delete("include_introduced");
      else p.set("include_introduced", "true");
    });

  const onClear = () => {
    setSearch("");
    router.push("/species/");
  };

  const iucnSet = new Set(initial.iucn_status ?? []);

  // Captive-population options. Translated labels resolved at render
  // time; the wire values stay as-is for URL stability.
  const captiveOptions: ReadonlyArray<{ v: "" | "true" | "false"; label: string }> = [
    { v: "", label: t("captiveAny") },
    { v: "true", label: t("captiveHas") },
    { v: "false", label: t("captiveNone") },
  ];

  return (
    <form
      onSubmit={onSearchSubmit}
      aria-label={t("ariaLabel")}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">{t("search")}</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <span className="mt-1 block text-xs text-slate-500">{t("searchHint")}</span>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">{t("iucnStatus")}</legend>
        <div className="flex flex-wrap gap-2 text-xs">
          {IUCN_STATUSES.map((s) => {
            const active = iucnSet.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleIucn(s)}
                aria-pressed={active}
                title={tCommon(s)}
                className={`rounded border px-2 py-0.5 font-semibold ${
                  active
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        {iucnSet.has("NE") ? (
          <p className="pt-1 text-xs text-slate-500">{t("iucnNeNote")}</p>
        ) : null}
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">{t("family")}</span>
        <select
          value={initial.family ?? ""}
          onChange={(e) => setFamily(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">{t("anyFamily")}</option>
          {KNOWN_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">{t("taxonomicStatus")}</span>
        <select
          value={initial.taxonomic_status ?? ""}
          onChange={(e) => setTaxStatus(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">{t("anyTaxonomicStatus")}</option>
          <option value="described">{t("described")}</option>
          <option value="undescribed_morphospecies">{t("undescribedMorphospecies")}</option>
        </select>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">{t("priorityListings")}</legend>
        <p className="pb-1 text-xs text-slate-500">{t("priorityListingsHint")}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={toggleCares}
            aria-pressed={initial.has_cares === "true"}
            title={t("caresTooltip")}
            className={`rounded border px-2 py-0.5 font-semibold ${
              initial.has_cares === "true"
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {t("caresLabel")}
          </button>
          <button
            type="button"
            onClick={toggleShoal}
            aria-pressed={initial.shoal_priority === "true"}
            title={t("shoalTooltip")}
            className={`rounded border px-2 py-0.5 font-semibold ${
              initial.shoal_priority === "true"
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {t("shoalLabel")}
          </button>
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">
          {t("captivePopulationLegend")}
        </legend>
        <div className="flex gap-2 text-xs">
          {captiveOptions.map((opt) => (
            <button
              key={opt.v || "any"}
              type="button"
              onClick={() => setCaptive(opt.v)}
              aria-pressed={(initial.has_captive_population ?? "") === opt.v}
              className={`rounded border px-2 py-0.5 ${
                (initial.has_captive_population ?? "") === opt.v
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">{t("introducedLegend")}</legend>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={initial.include_introduced === "true"}
            onChange={toggleIncludeIntroduced}
            className="mt-0.5"
          />
          <span>
            {t("introducedDescriptionPrefix")}{" "}
            <em>Oreochromis</em> {t("introducedDescriptionSuffix")}
          </span>
        </label>
      </fieldset>

      <div>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400"
        >
          {t("clearFilters")}
        </button>
      </div>

      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer font-medium">{t("iucnLegendSummary")}</summary>
        <ul className="mt-2 space-y-1">
          {IUCN_STATUSES.map((s) => (
            <li key={s}>
              <span className="font-semibold">{s}</span> — {tCommon(s)}
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
