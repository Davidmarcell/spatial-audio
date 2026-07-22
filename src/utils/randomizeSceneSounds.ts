import type { BedSound, SoundDef, SoundType, SpatialPoint } from '../data/types';
import { defaultSpawnVolumeForSound } from './defaultSoundVolume';
import { inferSoundType } from './soundTypeInference';
import { displaySoundName } from './soundCatalog';

const DOCK_SOUND_MAX = 6;

/**
 * Generic, single-voice types where a second tile in one scene reads as a bug
 * (the "two Surf tiles" complaint): only one wind, one surf, one rain, one
 * bossa-nova, etc. should ever auto-play. Distinctive wildlife types (songbird,
 * seabird, corvid, tropical-bird, primates, owl, kookaburra) are deliberately
 * NOT listed here so genuinely different native species — Tui + Fantail +
 * Kererū, all "songbird" — can share a scene; those de-dup by display name
 * instead, which still collapses two identical "Songbird"/"Night Owl" tiles.
 */
const GENERIC_UNIQUE_TYPES = new Set<SoundType>([
  'wind', 'waves', 'rain', 'thunder', 'stream', 'forest', 'fire',
  'insects', 'frogs', 'city-hum', 'traffic', 'market', 'bells',
  'jazz', 'bossa-nova',
]);

/**
 * De-dup key for scene composition. Generic ambiences collapse by type (one
 * Surf, one Wind…); everything else collapses by its displayed name so distinct
 * named species coexist but two identical generic tiles never do.
 */
function dedupKey(sound: SoundDef): string {
  const type = inferSoundType(sound);
  if (type && GENERIC_UNIQUE_TYPES.has(type)) return `type:${type}`;
  return `name:${displaySoundName(sound)}`;
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
 * Compose a location's DEFAULT scene deterministically from its curated bed
 * palette, then fill the dock with the remaining distinct region sounds.
 *
 * This replaces the old per-visit random pick (which was the root cause of the
 * "generic / repetitive / owl-everywhere" feel): the auto-playing palette is
 * now exactly the region's hand-curated `bedSounds`, in order, with duplicate
 * TYPES removed so no scene shows two Surf / two owls. Generic ambiences the
 * curator left out of the bed (wind, rain, surf…) stay in the region library /
 * dock so users can still add them by hand — they just aren't force-defaulted.
 */
export function randomizeSceneSounds(
  regionSounds: SoundDef[],
  bedSoundTemplates: BedSound[] = [],
): RandomizedSceneSounds {
  const soundById = new Map(regionSounds.map((sound) => [sound.id, sound]));

  if (regionSounds.length === 0) {
    return { canvasBedSounds: [], dockSoundIds: [] };
  }

  // ---- canvas: the curated bed palette, de-duplicated by type/name ----
  const usedKeys = new Set<string>();
  const canvasEntries: Array<{ bed: BedSound; sound: SoundDef }> = [];
  for (const bed of bedSoundTemplates) {
    const sound = soundById.get(bed.soundId);
    if (!sound) continue;
    const key = dedupKey(sound);
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    canvasEntries.push({ bed, sound });
  }

  const canvasBedSounds: BedSound[] = canvasEntries.map(({ bed, sound }, index) => ({
    soundId: bed.soundId,
    volume: bed.volume ?? defaultSpawnVolumeForSound(sound),
    position: bed.position ?? ringPosition(index, canvasEntries.length),
  }));

  // ---- dock: remaining region sounds, one per distinct type/name ----
  const dockSoundIds: string[] = [];
  for (const sound of regionSounds) {
    if (dockSoundIds.length >= DOCK_SOUND_MAX) break;
    const key = dedupKey(sound);
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    dockSoundIds.push(sound.id);
  }

  return { canvasBedSounds, dockSoundIds };
}
