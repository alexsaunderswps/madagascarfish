"use client";

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
  const [iucn, setIucn] = useState<IucnStatus[]>(initial.iucn_status ?? []);
  const [family, setFamily] = useState(initial.family ?? "");
  const [taxStatus, setTaxStatus] = useState<NonNullable<SpeciesFilterState["taxonomic_status"]>>(
    initial.taxonomic_status ?? "",
  );
  const [captive, setCaptive] = useState<
    NonNullable<SpeciesFilterState["has_captive_population"]>
  >(initial.has_captive_population ?? "");
  const [includeIntroduced, setIncludeIntroduced] = useState<boolean>(
    initial.include_introduced === "true",
  );

  function pushParams(next: URLSearchParams) {
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/species/?${qs}` : "/species/");
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    if (search.trim()) params.set("search", search.trim());
    params.delete("iucn_status");
    if (iucn.length > 0) params.set("iucn_status", iucn.join(","));
    params.delete("family");
    if (family) params.set("family", family);
    params.delete("taxonomic_status");
    if (taxStatus) params.set("taxonomic_status", taxStatus);
    params.delete("has_captive_population");
    if (captive) params.set("has_captive_population", captive);
    params.delete("include_introduced");
    if (includeIntroduced) params.set("include_introduced", "true");
    pushParams(params);
  }

  function onClear() {
    setSearch("");
    setIucn([]);
    setFamily("");
    setTaxStatus("");
    setCaptive("");
    setIncludeIntroduced(false);
    router.push("/species/");
  }

  return (
    <form
      onSubmit={onSubmit}
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
      </label>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">IUCN status</legend>
        <div className="flex flex-wrap gap-2 text-xs">
          {IUCN_STATUSES.map((s) => {
            const active = iucn.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setIucn(toggle(iucn, s))}
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
        {iucn.includes("NE") ? (
          <p className="pt-1 text-xs text-slate-500">
            NE (&ldquo;Not yet assessed&rdquo;) includes undescribed
            morphospecies that have not been assessed by the IUCN Red List.
          </p>
        ) : null}
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Family</span>
        <select
          value={family}
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
          value={taxStatus}
          onChange={(e) =>
            setTaxStatus(
              (e.target.value as NonNullable<SpeciesFilterState["taxonomic_status"]>) ?? "",
            )
          }
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          <option value="described">Described</option>
          <option value="undescribed_morphospecies">Undescribed morphospecies</option>
        </select>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">Captive population</legend>
        <div className="flex gap-2 text-xs">
          {[
            { v: "", label: "Any" },
            { v: "true", label: "Has captive pop." },
            { v: "false", label: "None tracked" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() =>
                setCaptive(
                  (opt.v as NonNullable<SpeciesFilterState["has_captive_population"]>) ?? "",
                )
              }
              aria-pressed={captive === opt.v}
              className={`rounded border px-2 py-0.5 ${
                captive === opt.v
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
            checked={includeIntroduced}
            onChange={(e) => setIncludeIntroduced(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Show introduced (exotic) species — e.g. <em>Oreochromis</em> spp.
            Hidden by default so the directory reads as Madagascar&rsquo;s native fauna.
          </span>
        </label>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Apply
        </button>
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
