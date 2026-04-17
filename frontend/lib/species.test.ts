import { describe, expect, it } from "vitest";

import { buildSpeciesQuery, parseSpeciesFilterState } from "./species";

describe("buildSpeciesQuery", () => {
  it("omits empty filters and sets page_size", () => {
    const qs = buildSpeciesQuery({});
    const params = new URLSearchParams(qs);
    expect(params.get("page_size")).toBe("50");
    expect(params.has("search")).toBe(false);
    expect(params.has("iucn_status")).toBe(false);
  });

  it("serializes iucn_status as comma-separated", () => {
    const qs = buildSpeciesQuery({ iucn_status: ["CR", "EN"] });
    const params = new URLSearchParams(qs);
    expect(params.get("iucn_status")).toBe("CR,EN");
  });

  it("serializes the coverage-gap query the hero links to", () => {
    const qs = buildSpeciesQuery({
      iucn_status: ["CR", "EN", "VU"],
      has_captive_population: "false",
    });
    const params = new URLSearchParams(qs);
    expect(params.get("iucn_status")).toBe("CR,EN,VU");
    expect(params.get("has_captive_population")).toBe("false");
  });

  it("omits page=1 but sets page>1", () => {
    expect(new URLSearchParams(buildSpeciesQuery({ page: 1 })).has("page")).toBe(false);
    expect(new URLSearchParams(buildSpeciesQuery({ page: 3 })).get("page")).toBe("3");
  });
});

describe("parseSpeciesFilterState", () => {
  it("parses multi-select iucn_status and filters unknown codes", () => {
    const s = parseSpeciesFilterState({ iucn_status: "CR,EN,ZZ" });
    expect(s.iucn_status).toEqual(["CR", "EN"]);
  });

  it("defaults empty state on empty params", () => {
    const s = parseSpeciesFilterState({});
    expect(s.search).toBe("");
    expect(s.iucn_status).toEqual([]);
    expect(s.page).toBe(1);
  });

  it("clamps page to >= 1", () => {
    expect(parseSpeciesFilterState({ page: "0" }).page).toBe(1);
    expect(parseSpeciesFilterState({ page: "abc" }).page).toBe(1);
    expect(parseSpeciesFilterState({ page: "4" }).page).toBe(4);
  });
});
