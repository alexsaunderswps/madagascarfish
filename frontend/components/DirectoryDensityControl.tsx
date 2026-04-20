"use client";

/**
 * DirectoryDensityControl — S19 comfortable / compact density toggle.
 *
 * URL-backed: writes ?d=comfortable|compact and lets the server component
 * re-render. Unrecognized values fall back to comfortable (parseDensity).
 */

import { useRouter, useSearchParams } from "next/navigation";

import SegmentedControl from "./SegmentedControl";
import type { DirectoryDensity } from "@/lib/species";

export default function DirectoryDensityControl({
  density,
}: {
  density: DirectoryDensity;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = (next: DirectoryDensity) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "comfortable") params.delete("d");
    else params.set("d", next);
    const qs = params.toString();
    router.push(qs ? `/species/?${qs}` : "/species/");
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        Density
      </span>
      <SegmentedControl<DirectoryDensity>
        ariaLabel="Directory density"
        value={density}
        onChange={onChange}
        options={[
          { value: "comfortable", label: "Comfortable" },
          { value: "compact", label: "Compact" },
        ]}
      />
    </div>
  );
}
