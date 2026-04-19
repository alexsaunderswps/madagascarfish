/**
 * Empty-state silhouette shown when a species has no photograph.
 *
 * Two modes:
 *  - Custom: if `customSvg` is a non-empty string, it is rendered verbatim.
 *    Trust boundary: this string is authored by Tier-5 admins in the Species
 *    admin form and stored in `Species.silhouette_svg`. It is NOT user input
 *    from untrusted sources, so `dangerouslySetInnerHTML` is appropriate here.
 *  - Fallback: a stylised generic cichlid outline. Works for Paretroplus,
 *    Ptychochromis, Katria, less accurate for bedotiids and killifish — the
 *    per-species custom SVG is the intended long-term fix.
 *
 * Returns `null` when there is nothing meaningful to draw (no custom SVG and
 * no `maxLengthCm`), so the caller can elide the whole figure cleanly.
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
  const hasLength = maxLengthCm != null && maxLengthCm > 0;
  if (!hasCustom && !hasLength) return null;

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
        {hasCustom ? (
          <CustomSilhouette svg={customSvg as string} widthPx={fishWidth} />
        ) : (
          <FishSilhouette widthPx={fishWidth} />
        )}
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

function FishSilhouette({ widthPx }: { widthPx: number }) {
  return (
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 100 40"
      width={widthPx}
      height={widthPx * 0.4}
      className="text-slate-400"
      preserveAspectRatio="xMidYMid meet"
    >
      <path d="M 78 20 L 97 6 L 94 20 L 97 34 Z" fill="currentColor" />
      <path
        d="M 8 20 C 8 10, 22 5, 40 5 C 58 5, 72 10, 78 20 C 72 30, 58 35, 40 35 C 22 35, 8 30, 8 20 Z"
        fill="currentColor"
      />
      <path
        d="M 28 8 C 38 3, 54 3, 64 8 L 58 11 C 50 9, 40 9, 32 11 Z"
        fill="currentColor"
      />
      <path
        d="M 38 32 C 46 34, 56 34, 62 32 L 58 29 C 52 30, 46 30, 42 29 Z"
        fill="currentColor"
      />
      <path d="M 22 22 C 26 26, 30 27, 32 25 L 28 22 Z" fill="currentColor" />
      <circle cx="16" cy="17" r="1.6" fill="#f8fafc" />
    </svg>
  );
}
