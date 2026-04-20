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
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  IUCN_LABELS,
  IUCN_STATUSES,
  KNOWN_FAMILIES,
  type IucnStatus,
  type SpeciesFilterState,
} from "@/lib/species";

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function SpeciesFilters({ initial }: { initial: SpeciesFilterState }) {
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

  return (
    <form
      onSubmit={onSearchSubmit}
      aria-label="Species filters"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Search</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="scientific or common name…"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <span className="mt-1 block text-xs text-slate-500">Press Enter to search.</span>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">IUCN status</legend>
        <div className="flex flex-wrap gap-2 text-xs">
          {IUCN_STATUSES.map((s) => {
            const active = iucnSet.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleIucn(s)}
                aria-pressed={active}
                title={IUCN_LABELS[s]}
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
          <p className="pt-1 text-xs text-slate-500">
            NE (&ldquo;Not yet assessed&rdquo;) includes undescribed
            morphospecies that have not been assessed by the IUCN Red List.
          </p>
        ) : null}
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Family</span>
        <select
          value={initial.family ?? ""}
          onChange={(e) => setFamily(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Any family</option>
          {KNOWN_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Taxonomic status</span>
        <select
          value={initial.taxonomic_status ?? ""}
          onChange={(e) => setTaxStatus(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          <option value="described">Described</option>
          <option value="undescribed_morphospecies">Undescribed morphospecies</option>
        </select>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">Priority listings</legend>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={toggleCares}
            aria-pressed={initial.has_cares === "true"}
            className={`rounded border px-2 py-0.5 font-semibold ${
              initial.has_cares === "true"
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            CARES
          </button>
          <button
            type="button"
            onClick={toggleShoal}
            aria-pressed={initial.shoal_priority === "true"}
            className={`rounded border px-2 py-0.5 font-semibold ${
              initial.shoal_priority === "true"
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            SHOAL 1,000
          </button>
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">Captive population</legend>
        <div className="flex gap-2 text-xs">
          {(
            [
              { v: "", label: "Any" },
              { v: "true", label: "Has captive pop." },
              { v: "false", label: "None tracked" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.label}
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
        <legend className="text-sm font-medium text-slate-700">Introduced species</legend>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={initial.include_introduced === "true"}
            onChange={toggleIncludeIntroduced}
            className="mt-0.5"
          />
          <span>
            Show introduced (exotic) species — e.g. <em>Oreochromis</em> spp.
            Hidden by default so the directory reads as Madagascar&rsquo;s native fauna.
          </span>
        </label>
      </fieldset>

      <div>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400"
        >
          Clear filters
        </button>
      </div>

      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer font-medium">IUCN legend</summary>
        <ul className="mt-2 space-y-1">
          {IUCN_STATUSES.map((s) => (
            <li key={s}>
              <span className="font-semibold">{s}</span> — {IUCN_LABELS[s]}
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
