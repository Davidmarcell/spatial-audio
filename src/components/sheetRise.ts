/**
 * Shared geometry + rAF driver for the app's stacked-sheet page transitions.
 *
 * The model: the OUTGOING page stays mounted and is gently lifted, while the
 * INCOMING page (or a page-matched cover panel) RISES up from the bottom on top
 * of it with a curved leading TOP edge that flattens as it settles. This module
 * animates that rise on a given element so the globe page (which rises as its
 * real self) and the cover panel (used where the incoming page cannot be
 * z-stacked above the outgoing one) share one curve, clock and easing.
 */

/** Rise length — one second so the sheet can breathe without feeling sluggish. */
export const SHEET_RISE_DURATION_MS = 1000;
/**
 * Short cross-fade once the cover panel has fully risen, so the reveal of the
 * destination beneath it is soft even when its surface differs from the panel's
 * page background (e.g. a playing soundscape canvas).
 */
export const SHEET_REVEAL_FADE_MS = 180;
/**
 * When a scene arrives behind a rising cover panel, the canvas holds its tile
 * radiate-in until roughly the moment the panel finishes rising and reveals it,
 * so the tiles push out just as/after the sheet arrives rather than under it.
 */
export const SHEET_SCENE_REVEAL_MS = SHEET_RISE_DURATION_MS;
/**
 * Canvas tile radiate-in duration (must stay in sync with SpatialCanvas).
 * Used to defer soundscape autoplay until tiles have finished entering.
 */
export const SCENE_TILE_ENTRANCE_MS = 640;
/** Max per-tile stagger for the radiate-in (SpatialCanvas). */
export const SCENE_TILE_STAGGER_MAX_MS = 320;
/**
 * Delay from scene-entry cover start until autoplay is safe.
 *
 * This is the moment the cover finishes rising and the scene is actually on
 * screen. It used to also wait out the tile stagger + radiate-in (another ~960ms
 * after the reveal), which — on top of loading the clips — is why audio arrived
 * seconds late. Audio still never leads the visuals; it just arrives with them.
 */
export const SCENE_AUTOPLAY_AFTER_MS = SHEET_SCENE_REVEAL_MS;
/**
 * Peak depth of the curved leading edge at the start of the rise, as a fraction
 * of viewport height. The edge starts this deeply bowed and eases to flat by the
 * end, which is the "stretched fabric" feel we are matching.
 */
const DEPTH_RATIO = 0.16;

/**
 * Solver for a CSS-style cubic-bezier(x1, y1, x2, y2) timing function, so the
 * rAF-driven rise matches the app's `--ease-in-out-strong`
 * (cubic-bezier(0.77, 0, 0.175, 1)) exactly rather than approximating it.
 */
function makeCubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveT = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = sampleDerivX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 20; i += 1) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) break;
      if (err > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveT(x));
  };
}

export const easeInOutStrong = makeCubicBezier(0.77, 0, 0.175, 1);

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type RiseOptions = {
  duration?: number;
  /** Fired once the element has fully risen into a flat, full-viewport cover. */
  onDone?: () => void;
  /**
   * Fired with the live vertical offset (px) every frame, BEFORE the frame is
   * painted. Lets chrome that cannot be a child of the rising sheet (the search
   * pill is portalled to `document.body`) travel on this exact clock instead of
   * running a parallel animation that drifts a frame or two out of step.
   */
  onFrame?: (translateY: number, progress: number) => void;
};

/**
 * Animate `el` rising up from below the viewport into a full-screen cover, with
 * an upward-bending curved TOP edge that leads the rise and eases flat as it
 * settles. Writes `transform` (translate) and `clip-path` (the curve) straight
 * to the element style every frame from one rAF clock, so the travel stays on
 * the compositor and only the small curved edge repaints.
 *
 * The curve is a quadratic Bézier: the top corners dip to y = depth while the
 * centre control lifts the midpoint to y = 0, so the edge bows upward through
 * the centre (the sheet reaches full height at the centre first). `depth` runs
 * from its peak to 0 across the rise, flattening the edge as the sheet arrives.
 *
 * Returns a cancel function that stops the rAF loop.
 */
export function animateRise(
  el: HTMLElement,
  { duration = SHEET_RISE_DURATION_MS, onDone, onFrame }: RiseOptions = {},
) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const depth0 = height * DEPTH_RATIO;
  // Carry the filled region well past the element's box bottom so the cover is
  // gap-free even if the CSS box height and window.innerHeight disagree slightly.
  const bottom = (height * 1.4).toFixed(2);

  const write = (progress: number) => {
    const depth = depth0 * (1 - progress);
    const translateY = (1 - progress) * height;
    el.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0)`;
    el.style.clipPath =
      `path('M 0 ${depth.toFixed(2)} `
      + `Q ${(width / 2).toFixed(2)} ${(-depth).toFixed(2)} ${width} ${depth.toFixed(2)} `
      + `L ${width} ${bottom} L 0 ${bottom} Z')`;
    onFrame?.(translateY, progress);
  };

  el.style.willChange = 'transform, clip-path';
  // Paint the fully-below starting frame before the browser paints, so the sheet
  // never flashes already-covering.
  write(0);

  let raf = 0;
  let start = 0;
  let done = false;
  const tick = (now: number) => {
    if (!start) start = now;
    const raw = Math.min(1, (now - start) / duration);
    write(easeInOutStrong(raw));
    if (raw < 1) {
      raf = requestAnimationFrame(tick);
    } else if (!done) {
      done = true;
      onDone?.();
    }
  };
  raf = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(raf);
}
