import type { SpatialPoint } from '../data/types';

/** Listener sits at the bottom-center of the canvas. */
export const LISTENER: SpatialPoint = { x: 0, y: 0 };

const DISTANCE_FALLOFF = 2.4;
const MIN_GAIN = 0.02;
const MAX_GAIN = 0.85;

export function distanceFromListener(point: SpatialPoint): number {
  const dx = point.x - LISTENER.x;
  const dy = point.y - LISTENER.y;
  return Math.hypot(dx, dy);
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

/** Default arc positions when adding sounds from the palette. */
export function defaultSpawnPosition(index: number, total = 6): SpatialPoint {
  const startAngle = Math.PI * 0.15;
  const endAngle = Math.PI * 0.85;
  const angle = startAngle + ((endAngle - startAngle) * index) / Math.max(1, total - 1);
  const radius = 0.55;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}
