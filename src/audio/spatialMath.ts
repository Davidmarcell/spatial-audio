import type { SpatialPoint } from '../data/types';

/** Listener sits at the center of the canvas. */
export const LISTENER: SpatialPoint = { x: 0, y: 0.5 };

const DISTANCE_FALLOFF = 2.4;
const MIN_GAIN = 0.02;
const MAX_GAIN = 0.85;

const PROXIMITY_SCALE_MAX = 1.48;
const PROXIMITY_SCALE_MIN = 0.62;
const PROXIMITY_SCALE_RANGE = 1.12;

export function distanceFromListener(point: SpatialPoint): number {
  const dx = point.x - LISTENER.x;
  const dy = point.y - LISTENER.y;
  return Math.hypot(dx, dy);
}

/** Closer to the listener = larger icon (inverse of perceived distance). */
export function scaleFromDistance(distance: number): number {
  const t = Math.min(1, distance / PROXIMITY_SCALE_RANGE);
  const eased = 1 - (1 - t) ** 2.2;
  return PROXIMITY_SCALE_MAX - eased * (PROXIMITY_SCALE_MAX - PROXIMITY_SCALE_MIN);
}

/** Canvas tile depth band — must stay below UI chrome (z-index >= 20). */
const CANVAS_TILE_Z_MIN = 2;
const CANVAS_TILE_Z_MAX = 11;

/** Higher when closer so near sounds sit visually on top of other tiles. */
export function depthZIndex(distance: number): number {
  const t = 1 - Math.min(1, distance / PROXIMITY_SCALE_RANGE);
  return Math.round(CANVAS_TILE_Z_MIN + t * (CANVAS_TILE_Z_MAX - CANVAS_TILE_Z_MIN));
}

export function gainFromDistance(distance: number, baseGain = MAX_GAIN): number {
  const gain = baseGain / (1 + DISTANCE_FALLOFF * distance);
  return Math.max(MIN_GAIN, Math.min(baseGain, gain));
}

/**
 * Lateral widening applied on the way into the panner. Sources all sit in FRONT
 * of the listener (z is negative), so with raw coordinates the widest placement
 * only reaches ~45° off-axis and the stereo image stays narrow. Scaling x
 * relative to z opens that angle up, which is what makes a sound placed out at
 * the edge actually read as being out there. Uniformly scaling both axes would
 * change nothing — direction is `atan2(x, |z|)`, so only the ratio matters.
 */
const PANNER_LATERAL_GAIN = 1.85;

/** Map normalized canvas coords to Web Audio panner space (Y becomes depth/Z). */
export function toPannerPosition(point: SpatialPoint): { x: number; z: number } {
  return {
    x: point.x * PANNER_LATERAL_GAIN,
    z: -Math.max(0.05, point.y),
  };
}

/**
 * Visual spread of the placement space. Positions stay in ONE coordinate space
 * (so the audio mix is identical everywhere), but on a phone the canvas is small
 * enough that the authored layouts bunch up around the listener. Spreading the
 * on-screen mapping pushes the tiles out towards the edges without touching
 * their spatial coordinates, gain or panning.
 *
 * `canvasToNormalized` applies the inverse, so dragging round-trips exactly and
 * the reachable coordinate range simply narrows to ±1/spread.
 */
export const CANVAS_SPREAD_DEFAULT = 1;
export const CANVAS_SPREAD_COMPACT = 1.52;

/** Keep spread tiles clear of the canvas edge (percent of the canvas). */
const SPREAD_EDGE_INSET_PCT = 5;
/** Phones push tiles farther out — use a deeper inset so half-tiles + shadows
 *  don't hang past the viewport edge. */
const SPREAD_EDGE_INSET_COMPACT_PCT = 12;

function edgeInsetPct(spread: number): number {
  return spread >= CANVAS_SPREAD_COMPACT - 0.01
    ? SPREAD_EDGE_INSET_COMPACT_PCT
    : SPREAD_EDGE_INSET_PCT;
}

function clampPercent(value: number, spread = CANVAS_SPREAD_DEFAULT): number {
  const inset = edgeInsetPct(spread);
  return Math.max(inset, Math.min(100 - inset, value));
}

export function canvasToNormalized(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  spread = CANVAS_SPREAD_DEFAULT,
): SpatialPoint {
  const x = (((clientX - rect.left) / rect.width) * 2 - 1) / spread;
  const y = LISTENER.y + (1 - (clientY - rect.top) / rect.height - LISTENER.y) / spread;
  return {
    x: Math.max(-1, Math.min(1, x)),
    y: Math.max(0.05, Math.min(1, y)),
  };
}

/** On-screen placement of a spatial point, as canvas percentages. */
export function normalizedToPercent(
  point: SpatialPoint,
  spread = CANVAS_SPREAD_DEFAULT,
): { left: string; top: string } {
  const { leftPercent, topPercent } = normalizedToPercentValues(point, spread);
  return { left: `${leftPercent}%`, top: `${topPercent}%` };
}

export function normalizedToPercentValues(
  point: SpatialPoint,
  spread = CANVAS_SPREAD_DEFAULT,
): { leftPercent: number; topPercent: number } {
  const spreadX = point.x * spread;
  const spreadY = LISTENER.y + (point.y - LISTENER.y) * spread;
  return {
    leftPercent: clampPercent(((spreadX + 1) / 2) * 100, spread),
    topPercent: clampPercent((1 - spreadY) * 100, spread),
  };
}

/** Default ring positions when adding sounds from the palette. */
export function defaultSpawnPosition(index: number, total = 6): SpatialPoint {
  const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
  const radius = 0.38;
  return {
    x: Math.cos(angle) * radius,
    y: LISTENER.y + Math.sin(angle) * radius,
  };
}
