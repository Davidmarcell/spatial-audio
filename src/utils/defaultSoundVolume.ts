import type { SoundDef, SoundType } from '../data/types';
import { inferSoundType } from './soundTypeInference';

const SEABIRD_SOUND_IDS = new Set([
  'gull',
  'forest-gull',
  'herring-gull',
  'dolomites-gull',
  'chiang-mai-gull',
  'seabird',
  'coastal-bird',
  'global-gull',
]);

/**
 * Sound *types* that should sit as a subtle, constant backdrop — a faint
 * "haunting" layer rather than a foreground voice. These spawn quiet (~20%) so
 * city traffic and insect choruses settle behind the scene by default. Users can
 * still raise any layer with the per-sound volume slider. `city-hum` is included
 * because curated "city traffic" beds infer to that pool (see soundTypeInference).
 */
const QUIET_BACKGROUND_TYPES = new Set<SoundType>(['insects', 'traffic', 'city-hum']);

/** Windy beds (alpine gusts, street breeze) sit behind the scene at ~30%. */
const WIND_SPAWN_VOLUME = 0.3;

export function defaultSpawnVolumeForSound(sound: SoundDef): number {
  // TODO: Replace shared gull clip when a cleaner seabird-specific asset is available.
  if (SEABIRD_SOUND_IDS.has(sound.id)) {
    return 0.42;
  }

  const type = inferSoundType(sound);
  if (type === 'wind') {
    return WIND_SPAWN_VOLUME;
  }
  if (type && QUIET_BACKGROUND_TYPES.has(type)) {
    return 0.2;
  }

  return 1;
}
