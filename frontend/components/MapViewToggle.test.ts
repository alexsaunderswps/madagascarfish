import { describe, expect, it } from "vitest";

import { _buildHrefForTesting as buildHref } from "./MapViewToggle";

describe("MapViewToggle buildHref", () => {
  it("drops ?view for map mode", () => {
    expect(buildHref("/map/", { view: "list" }, "map")).toBe("/map/");
  });

  it("sets ?view=list for list mode", () => {
    expect(buildHref("/map/", {}, "list")).toBe("/map/?view=list");
  });

  it("preserves unrelated params when toggling view", () => {
    expect(buildHref("/map/", { species_id: "42" }, "list")).toBe(
      "/map/?species_id=42&view=list",
    );
    expect(buildHref("/map/", { species_id: "42", view: "list" }, "map")).toBe(
      "/map/?species_id=42",
    );
  });

  it("preserves array params", () => {
    const href = buildHref("/map/", { tag: ["a", "b"] }, "list");
    expect(href).toContain("tag=a");
    expect(href).toContain("tag=b");
    expect(href).toContain("view=list");
  });

  it("ignores undefined values", () => {
    expect(buildHref("/map/", { species_id: undefined }, "list")).toBe(
      "/map/?view=list",
    );
  });
});
