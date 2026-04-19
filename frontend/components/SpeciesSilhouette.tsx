/**
 * Size-comparison silhouette rendered when a species has no photograph.
 * Draws a generic fish outline scaled to the species' max_length_cm next to
 * a 10 cm reference scale bar. Communicates "we have measurements, photo
 * pending" without looking like a broken image.
 *
 * Agreed imagery strategy (`docs/planning/ux/imagery-strategy.md` §5): one
 * SVG template, CSS-scaled per species, used as the empty-state fallback
 * only. When a real photograph exists (post-MVP), callers should render
 * that instead — this component is not a supplement to a photo.
 *
 * Returns `null` when `maxLengthCm` is missing or non-positive so the
 * caller can elide the whole figure cleanly.
 */

const PX_PER_CM = 4;
const SCALE_BAR_CM = 10;
const MIN_FISH_WIDTH_PX = 48;
const MAX_FISH_WIDTH_PX = 360;
const FIGURE_HEIGHT_PX = 140;

export type SpeciesSilhouetteProps = {
  maxLengthCm: number | null | undefined;
  scientificName: string;
  className?: string;
};

export default function SpeciesSilhouette({
  maxLengthCm,
  scientificName,
  className,
}: SpeciesSilhouetteProps) {
  if (maxLengthCm == null || maxLengthCm <= 0) return null;

  const rawWidth = maxLengthCm * PX_PER_CM;
  const fishWidth = Math.min(Math.max(rawWidth, MIN_FISH_WIDTH_PX), MAX_FISH_WIDTH_PX);
  const clamped = fishWidth !== rawWidth;
  const scaleBarWidth = SCALE_BAR_CM * PX_PER_CM;

  const altText = `Illustrative silhouette of ${scientificName}, approximately ${maxLengthCm} cm in length.`;

  return (
    <figure
      className={`mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 ${className ?? ""}`}
      aria-label={altText}
    >
      <div
        className="flex items-end justify-center gap-6"
        style={{ minHeight: FIGURE_HEIGHT_PX }}
      >
        <FishSilhouette widthPx={fishWidth} />
        <ScaleBar widthPx={scaleBarWidth} />
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-500">
        Illustrative silhouette scaled to {maxLengthCm}&nbsp;cm maximum
        recorded length{clamped ? " (not to absolute pixel scale at this size)" : ""}.
        {" "}
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

function FishSilhouette({ widthPx }: { widthPx: number }) {
  // viewBox 0 0 100 40: body occupies x=5–75, caudal fin x=75–98.
  // Stylised cichlid outline — works for Paretroplus, Ptychochromis, Katria,
  // less accurate for elongate bedotiids and killifish but acceptable as a
  // single-template MVP fallback.
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
      <path
        d="
          M 78 20
          L 97 6
          L 94 20
          L 97 34
          Z
        "
        fill="currentColor"
      />
      <path
        d="
          M 8 20
          C 8 10, 22 5, 40 5
          C 58 5, 72 10, 78 20
          C 72 30, 58 35, 40 35
          C 22 35, 8 30, 8 20
          Z
        "
        fill="currentColor"
      />
      <path
        d="
          M 28 8
          C 38 3, 54 3, 64 8
          L 58 11
          C 50 9, 40 9, 32 11
          Z
        "
        fill="currentColor"
      />
      <path
        d="
          M 38 32
          C 46 34, 56 34, 62 32
          L 58 29
          C 52 30, 46 30, 42 29
          Z
        "
        fill="currentColor"
      />
      <path
        d="
          M 22 22
          C 26 26, 30 27, 32 25
          L 28 22
          Z
        "
        fill="currentColor"
      />
      <circle cx="16" cy="17" r="1.6" fill="#f8fafc" />
    </svg>
  );
}

function ScaleBar({ widthPx }: { widthPx: number }) {
  const heightPx = 14;
  return (
    <div
      className="flex flex-col items-center text-slate-500"
      style={{ width: widthPx }}
    >
      <svg
        role="img"
        aria-hidden="true"
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        width={widthPx}
        height={heightPx}
      >
        <line
          x1={0.5}
          y1={heightPx - 2}
          x2={widthPx - 0.5}
          y2={heightPx - 2}
          stroke="currentColor"
          strokeWidth={1}
        />
        <line x1={0.5} y1={2} x2={0.5} y2={heightPx - 2} stroke="currentColor" strokeWidth={1} />
        <line
          x1={widthPx - 0.5}
          y1={2}
          x2={widthPx - 0.5}
          y2={heightPx - 2}
          stroke="currentColor"
          strokeWidth={1}
        />
        <line
          x1={widthPx / 2}
          y1={5}
          x2={widthPx / 2}
          y2={heightPx - 2}
          stroke="currentColor"
          strokeWidth={1}
        />
      </svg>
      <span className="mt-1 text-xs font-medium tracking-wide uppercase">
        {SCALE_BAR_CM}&nbsp;cm
      </span>
    </div>
  );
}
