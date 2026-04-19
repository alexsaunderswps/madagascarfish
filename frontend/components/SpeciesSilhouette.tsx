/**
 * Empty-state silhouette shown when a species has no photograph.
 *
 * Renders only when `customSvg` is a non-empty string authored by a Tier-5
 * admin in the Species admin form (`Species.silhouette_svg`). That input is
 * not user-supplied from untrusted sources, so `dangerouslySetInnerHTML` is
 * the intended render path.
 *
 * Returns `null` otherwise — no generic fallback (2026-04-19: placeholder
 * read worse than absence; Alex is authoring per-species silhouettes).
 *
 * The 10 cm scale bar was removed 2026-04-19 — reintroduce alongside a
 * calibrated per-species SVG story when ready.
 */

const PX_PER_CM = 4;
const MIN_FISH_WIDTH_PX = 96;
const MAX_FISH_WIDTH_PX = 360;
const FIGURE_HEIGHT_PX = 140;

export type SpeciesSilhouetteProps = {
  maxLengthCm: number | null | undefined;
  scientificName: string;
  customSvg?: string | null;
  className?: string;
};

export default function SpeciesSilhouette({
  maxLengthCm,
  scientificName,
  customSvg,
  className,
}: SpeciesSilhouetteProps) {
  const hasCustom = typeof customSvg === "string" && customSvg.trim().length > 0;
  // Generic fallback is intentionally disabled (2026-04-19) — render nothing
  // when no custom SVG is set. Alex is authoring per-species silhouettes; the
  // previous placeholder looked worse than absence.
  if (!hasCustom) return null;

  const hasLength = maxLengthCm != null && maxLengthCm > 0;
  const rawWidth = hasLength ? (maxLengthCm as number) * PX_PER_CM : MAX_FISH_WIDTH_PX;
  const fishWidth = Math.min(Math.max(rawWidth, MIN_FISH_WIDTH_PX), MAX_FISH_WIDTH_PX);

  const altText = hasLength
    ? `Illustrative silhouette of ${scientificName}, approximately ${maxLengthCm} cm in length.`
    : `Illustrative silhouette of ${scientificName}.`;

  return (
    <figure
      className={`mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 ${className ?? ""}`}
      aria-label={altText}
    >
      <div
        className="flex items-center justify-center"
        style={{ minHeight: FIGURE_HEIGHT_PX }}
      >
        <CustomSilhouette svg={customSvg as string} widthPx={fishWidth} />
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-500">
        Illustrative silhouette
        {hasLength ? <> (approx. {maxLengthCm}&nbsp;cm at maximum recorded length)</> : null}
        .{" "}
        <span className="text-slate-400">
          Photographs of this species are welcome —{" "}
          <a
            href="/contribute/husbandry/"
            className="underline underline-offset-2 hover:text-slate-700"
          >
            contribute
          </a>
          .
        </span>
      </figcaption>
    </figure>
  );
}

function CustomSilhouette({ svg, widthPx }: { svg: string; widthPx: number }) {
  // Tier-5-authored SVG from Species.silhouette_svg. See file header for
  // trust-boundary rationale.
  return (
    <div
      className="text-slate-500 [&>svg]:h-auto [&>svg]:w-full"
      style={{ width: widthPx, maxWidth: "100%" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

