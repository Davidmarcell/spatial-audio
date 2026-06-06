import { distanceFromListener } from '../audio/spatialMath';
import type { SpatialPoint } from '../data/types';

export type HapticPattern =
  | 'tap'
  | 'selection'
  | 'lift'
  | 'invalid'
  | 'remove'
  | 'sheet'
  | 'play'
  | 'pause'
  | 'loading'
  | 'success'
  | 'error';

type ProximityBand = 'near' | 'mid' | 'far';

const MIN_INTERVAL_MS = 80;

const PATTERNS: Record<HapticPattern, VibratePattern> = {
  tap: 6,
  selection: 8,
  lift: [8, 24, 10],
  invalid: [8, 35, 8],
  remove: [16, 35, 24],
  sheet: 9,
  play: [10, 24, 10],
  pause: 18,
  loading: 8,
  success: [8, 26, 14],
  error: [18, 40, 18],
};

const DROP_PATTERNS: Record<ProximityBand, VibratePattern> = {
  near: [14, 18, 18],
  mid: 12,
  far: 7,
};

const PROXIMITY_TICKS: Record<ProximityBand, VibratePattern> = {
  near: 12,
  mid: 8,
  far: 5,
};

function hasCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

export function canVibrate() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    hasCoarsePointer()
  );
}

export function vibrate(pattern: VibratePattern) {
  if (!canVibrate()) return false;
  return navigator.vibrate(pattern);
}

export function playHaptic(pattern: HapticPattern) {
  return vibrate(PATTERNS[pattern]);
}

function proximityBand(position: SpatialPoint): ProximityBand {
  const distance = distanceFromListener(position);
  if (distance < 0.35) return 'near';
  if (distance < 0.72) return 'mid';
  return 'far';
}

export function playSpatialDropHaptic(position: SpatialPoint) {
  return vibrate(DROP_PATTERNS[proximityBand(position)]);
}

export function playVolumeHaptic(volume: number) {
  if (volume >= 0.75) return vibrate(10);
  if (volume >= 0.4) return vibrate(7);
  return vibrate(5);
}

export function createSpatialDragHaptics() {
  const lastBandByInstance = new Map<string, ProximityBand>();
  const lastPanSideByInstance = new Map<string, -1 | 0 | 1>();
  const lastPulseByInstance = new Map<string, number>();

  const canPulse = (instanceId: string) => {
    const now = performance.now();
    const last = lastPulseByInstance.get(instanceId) ?? 0;
    if (now - last < MIN_INTERVAL_MS) return false;
    lastPulseByInstance.set(instanceId, now);
    return true;
  };

  return {
    start(instanceId: string, position: SpatialPoint) {
      lastBandByInstance.set(instanceId, proximityBand(position));
      lastPanSideByInstance.set(instanceId, Math.sign(position.x) as -1 | 0 | 1);
      lastPulseByInstance.set(instanceId, performance.now());
      playHaptic('selection');
    },
    move(instanceId: string, position: SpatialPoint) {
      const nextBand = proximityBand(position);
      const previousBand = lastBandByInstance.get(instanceId);
      if (previousBand && nextBand !== previousBand && canPulse(instanceId)) {
        lastBandByInstance.set(instanceId, nextBand);
        vibrate(PROXIMITY_TICKS[nextBand]);
        return;
      }
      lastBandByInstance.set(instanceId, nextBand);

      const nextPanSide = Math.sign(position.x) as -1 | 0 | 1;
      const previousPanSide = lastPanSideByInstance.get(instanceId);
      if (previousPanSide !== undefined && nextPanSide !== previousPanSide && canPulse(instanceId)) {
        vibrate(6);
      }
      lastPanSideByInstance.set(instanceId, nextPanSide);
    },
    end(instanceId: string) {
      lastBandByInstance.delete(instanceId);
      lastPanSideByInstance.delete(instanceId);
      lastPulseByInstance.delete(instanceId);
    },
  };
}
