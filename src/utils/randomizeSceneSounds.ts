import type { BedSound, SoundDef, SpatialPoint } from '../data/types';
import { defaultSpawnVolumeForSound } from './defaultSoundVolume';

const CANVAS_SOUND_MIN = 4;
const CANVAS_SOUND_MAX = 5;
const DOCK_SOUND_MAX = 5;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickCount(min: number, max: number, available: number): number {
  if (available <= 0) return 0;
  const upper = Math.min(max, available);
  if (upper <= min) return upper;
  return min + Math.floor(Math.random() * (upper - min + 1));
}

function ringPosition(index: number, total: number): SpatialPoint {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.cos(angle) * 0.34,
    y: 0.56 + Math.sin(angle) * 0.14,
  };
}

export type RandomizedSceneSounds = {
  canvasBedSounds: BedSound[];
  dockSoundIds: string[];
};

/**
 * Picks 4–5 canvas defaults and up to 5 different dock palette sounds per visit.
 * Uses optional bedSounds entries for preferred volume/position when available.
 */
export function randomizeSceneSounds(
  regionSounds: SoundDef[],
  bedSoundTemplates: BedSound[] = [],
): RandomizedSceneSounds {
  const templateById = new Map(bedSoundTemplates.map((item) => [item.soundId, item]));
  const soundById = new Map(regionSounds.map((sound) => [sound.id, sound]));
  const pool = shuffle(regionSounds.map((sound) => sound.id));

  if (pool.length === 0) {
    return { canvasBedSounds: [], dockSoundIds: [] };
  }

  const canvasCount = pickCount(
    CANVAS_SOUND_MIN,
    CANVAS_SOUND_MAX,
    pool.length,
  );
  const canvasIds = pool.slice(0, canvasCount);
  const remaining = pool.slice(canvasCount);

  const dockCount = Math.min(DOCK_SOUND_MAX, remaining.length);
  const dockSoundIds = remaining.slice(0, dockCount);

  const canvasBedSounds: BedSound[] = canvasIds.map((soundId, index) => {
    const template = templateById.get(soundId);
    const sound = soundById.get(soundId);
    return {
      soundId,
      volume:
        template?.volume ??
        (sound ? defaultSpawnVolumeForSound(sound) : 0.52 + Math.random() * 0.18),
      position: template?.position ?? ringPosition(index, canvasIds.length),
    };
  });

  return { canvasBedSounds, dockSoundIds };
}
