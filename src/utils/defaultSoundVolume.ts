import type { SoundDef, SoundType } from '../data/types';
import { inferSoundType } from './soundTypeInference';

const SEABIRD_SOUND_IDS = new Set([
  'gull',
  'forest-gull',
  'herring-gull',
  'seabird',
  'coastal-bird',
  'global-gull',
]);

/**
 * Sensible per-type default spawn volumes. These are the levels a layer joins
 * the scene at before the user touches its slider, tuned so no single type
 * dominates: beds and choruses sit low, distinctive calls sit mid, and the
 * "haunting" background layers (city hum, insects, traffic) stay well behind.
 *
 * Prior decisions kept intact: wind 0.3, traffic/insects 0.2. New in this pass:
 * primates much quieter (they were far too loud), soft surf, and gentle music
 * hums so bossa nova / jazz colour a scene without drowning it.
 */
const TYPE_SPAWN_VOLUME: Partial<Record<SoundType, number>> = {
  // Ambient beds — present but never foreground.
  wind: 0.3,
  traffic: 0.2,
  insects: 0.2,
  'city-hum': 0.22,
  market: 0.26,
  forest: 0.42,
  rain: 0.4,
  thunder: 0.4,
  fire: 0.36,
  // Water.
  waves: 0.4, // soft surf by default (Rio and friends read gentle)
  stream: 0.44,
  // Music — colour, not centrepiece.
  jazz: 0.4,
  'bossa-nova': 0.4,
  fado: 0.4,
  ney: 0.4,
  musette: 0.36,
  // City signatures — sit behind the wildlife/music.
  tram: 0.32,
  adhan: 0.28,
  subway: 0.28,
  cafe: 0.26,
  // Distant savanna calls — low, occasional, far across the plains.
  lion: 0.22,
  elephant: 0.2,
  // Wildlife voices.
  primates: 0.28, // was far too loud
  frogs: 0.3,
  owl: 0.34,
  bells: 0.34,
  seabird: 0.42,
  songbird: 0.5,
  corvid: 0.46,
  'tropical-bird': 0.5,
  kookaburra: 0.5,
};

export function defaultSpawnVolumeForSound(sound: SoundDef): number {
  // TODO: Replace shared gull clip when a cleaner seabird-specific asset is available.
  if (SEABIRD_SOUND_IDS.has(sound.id)) {
    return 0.42;
  }

  const type = inferSoundType(sound);
  if (type && TYPE_SPAWN_VOLUME[type] != null) {
    return TYPE_SPAWN_VOLUME[type]!;
  }

  return 0.5;
}
