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

/** Map normalized canvas coords to Web Audio panner space (Y becomes depth/Z). */
export function toPannerPosition(point: SpatialPoint): { x: number; z: number } {
  return {
    x: point.x,
    z: -Math.max(0.05, point.y),
  };
}

export function canvasToNormalized(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): SpatialPoint {
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = 1 - (clientY - rect.top) / rect.height;
  return {
    x: Math.max(-1, Math.min(1, x)),
    y: Math.max(0.05, Math.min(1, y)),
  };
}

export function normalizedToPercent(point: SpatialPoint): { left: string; top: string } {
  return {
    left: `${((point.x + 1) / 2) * 100}%`,
    top: `${(1 - point.y) * 100}%`,
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
