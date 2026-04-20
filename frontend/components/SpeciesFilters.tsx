"use client";

/**
 * SpeciesFilters — S19 filter rail (§15.3 / gate-1 Directory redesign).
 *
 * Left-rail composition using FilterChip primitives. Every control toggles
 * URL state immediately; there is no Apply button — URL is the canonical
 * state and preserves back/forward navigation.
 *
 * Controls (top → bottom):
 *   Search (text)
 *   Family       — single-select chips
 *   Endemism     — single-select chips (endemic / native / introduced)
 *   CARES        — single-select four-tier chips (CCR / CEN / CVU / CLC)
 *   SHOAL        — single toggle chip
 *   IUCN         — multi-select chips
 *   Captive pop. — single-select chips (Any / Has / None)
 *   Clear
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import FilterChip from "./FilterChip";
import {
  IUCN_LABELS,
  IUCN_STATUSES,
  KNOWN_FAMILIES,
  type CaresStatus,
  type EndemicStatus,
  type IucnStatus,
  type SpeciesFilterState,
} from "@/lib/species";

const CARES_CODES: Exclude<CaresStatus, "" | "priority" | "monitored">[] = [
  "CCR",
  "CEN",
  "CVU",
  "CLC",
];
const ENDEMIC_OPTIONS: { value: EndemicStatus; label: string }[] = [
  { value: "endemic", label: "Endemic" },
  { value: "native", label: "Native" },
  { value: "introduced", label: "Introduced" },
];

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

  const setFamily = (f: string) =>
    push((p) => {
      if (initial.family === f) p.delete("family");
      else p.set("family", f);
    });

  const setEndemism = (v: EndemicStatus) =>
    push((p) => {
      if (initial.endemic_status === v) p.delete("endemic_status");
      else p.set("endemic_status", v);
    });

  const setCares = (v: CaresStatus) =>
    push((p) => {
      if (initial.cares_status === v) p.delete("cares_status");
      else p.set("cares_status", v);
    });

  const toggleShoal = () =>
    push((p) => {
      if (initial.shoal_priority === "true") p.delete("shoal_priority");
      else p.set("shoal_priority", "true");
    });

  const toggleIucn = (s: IucnStatus) =>
    push((p) => {
      const next = toggle(initial.iucn_status ?? [], s);
      p.delete("iucn_status");
      if (next.length > 0) p.set("iucn_status", next.join(","));
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
    <aside
      aria-label="Species filters"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 16,
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--rule)",
        backgroundColor: "var(--bg-raised)",
      }}
    >
      <form onSubmit={onSearchSubmit}>
        <label style={{ display: "block", fontSize: 12, color: "var(--ink-2)" }}>
          <span
            style={{
              display: "block",
              marginBottom: 6,
              fontWeight: 600,
              color: "var(--ink)",
              fontSize: 13,
            }}
          >
            Search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="scientific or common name…"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--rule-strong)",
              backgroundColor: "var(--bg)",
              color: "var(--ink)",
              fontSize: 13,
            }}
          />
        </label>
      </form>

      <section>
        <h4 style={sectionTitleStyle}>Family</h4>
        <div style={chipRowStyle}>
          {KNOWN_FAMILIES.map((f) => (
            <FilterChip
              key={f}
              selected={initial.family === f}
              onClick={() => setFamily(f)}
            >
              {f}
            </FilterChip>
          ))}
        </div>
      </section>

      <section>
        <h4 style={sectionTitleStyle}>Endemism</h4>
        <div style={chipRowStyle}>
          {ENDEMIC_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              selected={initial.endemic_status === o.value}
              onClick={() => setEndemism(o.value)}
            >
              {o.label}
            </FilterChip>
          ))}
        </div>
      </section>

      <section>
        <h4 style={sectionTitleStyle}>CARES</h4>
        <div style={chipRowStyle}>
          {CARES_CODES.map((c) => (
            <FilterChip
              key={c}
              selected={initial.cares_status === c}
              onClick={() => setCares(c)}
              ariaLabel={`CARES ${c}`}
            >
              {c}
            </FilterChip>
          ))}
        </div>
      </section>

      <section>
        <h4 style={sectionTitleStyle}>SHOAL priority</h4>
        <div style={chipRowStyle}>
          <FilterChip
            selected={initial.shoal_priority === "true"}
            onClick={toggleShoal}
          >
            SHOAL 1,000
          </FilterChip>
        </div>
      </section>

      <section>
        <h4 style={sectionTitleStyle}>IUCN status</h4>
        <div style={chipRowStyle}>
          {IUCN_STATUSES.map((s) => (
            <FilterChip
              key={s}
              selected={iucnSet.has(s)}
              onClick={() => toggleIucn(s)}
              ariaLabel={IUCN_LABELS[s]}
            >
              {s}
            </FilterChip>
          ))}
        </div>
        {iucnSet.has("NE") ? (
          <p style={{ marginTop: 6, fontSize: 11, color: "var(--ink-3)" }}>
            NE includes species not yet assessed by the IUCN Red List.
          </p>
        ) : null}
      </section>

      <section>
        <h4 style={sectionTitleStyle}>Captive population</h4>
        <div style={chipRowStyle}>
          {(
            [
              { v: "", label: "Any" },
              { v: "true", label: "Has captive pop." },
              { v: "false", label: "None tracked" },
            ] as const
          ).map((o) => (
            <FilterChip
              key={o.label}
              selected={(initial.has_captive_population ?? "") === o.v}
              onClick={() => setCaptive(o.v)}
            >
              {o.label}
            </FilterChip>
          ))}
        </div>
      </section>

      <section>
        <h4 style={sectionTitleStyle}>Introduced species</h4>
        <label
          style={{
            display: "flex",
            gap: 8,
            fontSize: 12,
            color: "var(--ink-2)",
            alignItems: "flex-start",
          }}
        >
          <input
            type="checkbox"
            checked={initial.include_introduced === "true"}
            onChange={toggleIncludeIntroduced}
            style={{ marginTop: 2 }}
          />
          <span>
            Show introduced (exotic) species — e.g. <em>Oreochromis</em> spp.
            Hidden by default so the directory reads as Madagascar&rsquo;s native fauna.
          </span>
        </label>
      </section>

      <button
        type="button"
        onClick={onClear}
        style={{
          alignSelf: "flex-start",
          padding: "6px 12px",
          fontSize: 12,
          borderRadius: 999,
          border: "1px solid var(--rule-strong)",
          backgroundColor: "transparent",
          color: "var(--ink-2)",
          cursor: "pointer",
        }}
      >
        Clear filters
      </button>
    </aside>
  );
}

const sectionTitleStyle = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--ink-3)",
};

const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 6,
};
