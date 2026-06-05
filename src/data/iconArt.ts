import {
  artworkAttributions,
  fixedIcons,
  iconPools,
  soundPoolMap as generatedSoundPoolMap,
  type IconPoolEntry,
} from './iconPools.generated';

/** Extra sound → icon pool mappings for world-region sounds (reuse Met/Wikimedia pools). */
const soundPoolMap: Record<string, string> = {
  ...generatedSoundPoolMap,
  'copacabana-surf': 'surf',
  'atlantic-wind': 'wind',
  seabird: 'surf',
  'tropical-insects': 'forest',
  'city-hum': 'forest',
  'street-bird': 'quetzal',
  'park-rustle': 'nyc-park',
  'urban-breeze': 'nyc-breeze',
  'distant-traffic': 'nyc-traffic',
  blackbird: 'quetzal',
  'herring-gull': 'surf',
  'london-rain': 'rain',
  'thames-breeze': 'nyc-breeze',
  'park-ambience': 'nyc-park',
  'distant-city': 'nyc-traffic',
  'alpine-wind': 'wind',
  'mountain-stream': 'stream',
  'forest-valley': 'forest',
  'alpine-bird': 'quetzal',
  'jungle-insects': 'forest',
  'hill-bird': 'quetzal',
  'monsoon-rain': 'rain',
  'tropical-bird': 'toucan',
};

const SESSION_KEY = 'spatial-audio-icon-seed';
const regionArtCache = new Map<string, Map<string, IconPoolEntry>>();

function readSessionSeed(): string {
  if (typeof sessionStorage === 'undefined') {
    return 'ssr';
  }
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const seed = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, seed);
  return seed;
}

const sessionSeed = readSessionSeed();

function hashToIndex(key: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % size;
}

function pickFromPool(pool: IconPoolEntry[], variantKey: string): IconPoolEntry {
  return pool[hashToIndex(variantKey, pool.length)];
}

function fixedIconEntry(soundId: string): IconPoolEntry | null {
  const src = fixedIcons[soundId];
  if (!src) return null;

  const match = artworkAttributions.find((item) => item.file === src);
  if (match) {
    return {
      src: match.file,
      title: match.title,
      author: match.author,
      license: match.license,
      sourceUrl: match.sourceUrl,
    };
  }

  return {
    src,
    title: soundId,
    author: 'Unknown',
    license: 'Public domain',
    sourceUrl: src,
  };
}

function rankPoolEntries(
  pool: IconPoolEntry[],
  regionId: string,
  soundId: string,
): IconPoolEntry[] {
  return [...pool].sort((left, right) => {
    const leftRank = hashToIndex(`${regionId}:${soundId}:${left.src}`, pool.length);
    const rightRank = hashToIndex(`${regionId}:${soundId}:${right.src}`, pool.length);
    return leftRank - rightRank;
  });
}

function assignUniqueRegionArtwork(
  regionId: string,
  soundIds: string[],
): Map<string, IconPoolEntry> {
  const usedSrc = new Set<string>();
  const assignments = new Map<string, IconPoolEntry>();

  for (const soundId of soundIds) {
    const fixed = fixedIconEntry(soundId);
    if (fixed) {
      if (!usedSrc.has(fixed.src)) {
        usedSrc.add(fixed.src);
        assignments.set(soundId, fixed);
      }
      continue;
    }

    const poolName = soundPoolMap[soundId];
    const pool = poolName ? iconPools[poolName] : undefined;
    if (!pool?.length) continue;

    const ranked = rankPoolEntries(pool, regionId, soundId);
    const pick = ranked.find((entry) => !usedSrc.has(entry.src)) ?? ranked[0];
    usedSrc.add(pick.src);
    assignments.set(soundId, pick);
  }

  return assignments;
}

export function getRegionArtworkMap(
  regionId: string,
  regionSoundIds: string[],
): Map<string, IconPoolEntry> {
  const key = `${regionId}:${regionSoundIds.join(',')}`;
  const cached = regionArtCache.get(key);
  if (cached) return cached;

  const map = assignUniqueRegionArtwork(regionId, regionSoundIds);
  regionArtCache.set(key, map);
  return map;
}

export function getSoundIconEntry(soundId: string, variantKey?: string): IconPoolEntry | null {
  const poolName = soundPoolMap[soundId];
  const pool = poolName ? iconPools[poolName] : undefined;
  if (!pool?.length) return null;

  const key = variantKey ?? `${sessionSeed}:${soundId}`;
  return pickFromPool(pool, key);
}

export function getSoundArtwork(soundId: string, variantKey?: string): IconPoolEntry {
  const pooled = getSoundIconEntry(soundId, variantKey);
  if (pooled) return pooled;

  const fixed = fixedIconEntry(soundId);
  if (fixed) return fixed;

  const fallbackPool = iconPools.forest ?? iconPools.surf;
  if (fallbackPool?.length) {
    return pickFromPool(fallbackPool, `${sessionSeed}:${soundId}`);
  }

  return {
    src: '/icons/tui.jpg',
    title: 'Tui adult and young',
    author: 'John Gerrard Keulemans',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tui_adult_and_young.jpg',
  };
}

export function getSoundArtworkForRegion(
  regionId: string,
  regionSoundIds: string[],
  soundId: string,
  variantKey?: string,
): IconPoolEntry {
  const regional = getRegionArtworkMap(regionId, regionSoundIds).get(soundId);
  if (regional) return regional;
  return getSoundArtwork(soundId, variantKey);
}

export type RegionArtContext = {
  id: string;
  soundIds: string[];
};

export function getSoundIconSrc(
  soundId: string,
  variantKey?: string,
  region?: RegionArtContext,
): string {
  if (region) {
    return getSoundArtworkForRegion(region.id, region.soundIds, soundId, variantKey).src;
  }
  return getSoundArtwork(soundId, variantKey).src;
}

export { artworkAttributions };
