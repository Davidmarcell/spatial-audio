import { soundClips } from './soundClips.generated';
import type { Attribution, SoundClip, SoundType } from './types';

/**
 * Variant pools for the dynamic soundscape system. Every sound *type* maps to a
 * pool of interchangeable, openly-licensed clips (see soundClips.generated.ts,
 * produced by scripts/download-audio-variants.mjs). The location-seeded picker
 * in utils/soundscapeSelection.ts chooses one clip per sound per scene.
 */
export const soundPools: Record<SoundType, SoundClip[]> = (() => {
  const pools = {} as Record<SoundType, SoundClip[]>;
  for (const clip of soundClips) {
    (pools[clip.type] ??= []).push(clip);
  }
  return pools;
})();

/**
 * Types that are close enough to substitute for one another when a primary pool
 * is thin. Keeps thin categories (traffic, corvid) from collapsing to silence.
 */
const FALLBACK_TYPES: Partial<Record<SoundType, SoundType[]>> = {
  traffic: ['city-hum'],
  'city-hum': ['traffic'],
  corvid: ['songbird'],
  'tropical-bird': ['songbird'],
  market: ['city-hum'],
  thunder: ['rain'],
};

export function poolForType(type: SoundType): SoundClip[] {
  const direct = soundPools[type] ?? [];
  if (direct.length > 0) return direct;
  for (const fallback of FALLBACK_TYPES[type] ?? []) {
    const pool = soundPools[fallback];
    if (pool?.length) return pool;
  }
  return [];
}

const clipById = new Map(soundClips.map((clip) => [clip.id, clip]));

export function getClip(clipId: string): SoundClip | undefined {
  return clipById.get(clipId);
}

export function getClipBySrc(src: string): SoundClip | undefined {
  return soundClips.find((clip) => clip.src === src);
}

/** Audio attributions for the credits page, derived from the clip manifest. */
export function audioAttributionsFromPools(): Attribution[] {
  const seen = new Set<string>();
  const items: Attribution[] = [];
  for (const clip of [...soundClips].sort((a, b) => a.src.localeCompare(b.src))) {
    if (seen.has(clip.src)) continue;
    seen.add(clip.src);
    items.push({
      file: clip.src,
      title: clip.title,
      author: clip.author,
      license: clip.license,
      sourceUrl: clip.sourceUrl,
    });
  }
  return items;
}
