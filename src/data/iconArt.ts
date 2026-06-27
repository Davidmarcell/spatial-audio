import {
  artworkAttributions,
  fixedIcons,
  iconPools,
  soundPoolMap as generatedSoundPoolMap,
  type IconPoolEntry,
} from './iconPools.generated';
import {
  FALLBACK_ICON_SRC,
  isLocallyBundledIconSrc,
  resolveTileIconSrc,
} from './iconDetailSrc';
import type { VariantTag } from './types';

/**
 * Sound → art rationale (curated pass):
 * - forest-stream → fixed Monsted forest-stream plate (was falling back to random forest/surf)
 * - stream/creek/brook/river sounds → stream pool (water flowing, forest banks — no figures/shore balls)
 * - surf/coastal/seabird → surf pool (beach/seascape only)
 * - wind/breeze/gust → wind pool (trees, storms — no portraits)
 * - rain/monsoon/shower → rain pool (storm/rain scenes — no city panoramas)
 * - forest/bush/canopy/park-rustle → forest or nyc-park pools
 * - traffic/harbor-traffic → traffic pool (street scenes, circus filtered out)
 * - NZ birds → species plates via nzOnlySpeciesIconAliases; global birds → gray-catbird/toucan/etc.
 */

/** NZ-only regions where native species plates apply. */
const NZ_REGION_IDS = new Set(['auckland', 'nz-forest-general']);

/**
 * Aliases that only apply in NZ regions (native species plates). The morepork
 * (ruru) plate is a NZ-specific species illustration, so it must only be used
 * for owl sounds inside NZ regions; everywhere else owls use the generic owl
 * pool (see `soundPoolMap` / `SEMANTIC_POOL_RULES`).
 */
const nzOnlySpeciesIconAliases: Record<string, string> = {
  'tui-forest': 'tui',
  'morepork-forest': 'morepork',
};

/** Dedicated fixed plates for specific ambient sounds. */
const fixedIconAliases: Record<string, string> = {
  'forest-stream': 'forest-stream',
};

/** Regional sound ids that should reuse a named species plate. */
const speciesIconAliases: Record<string, string> = {
  'herring-gull': 'gull',
  'forest-gull': 'gull',
  'dolomites-gull': 'gull',
  'chiang-mai-gull': 'gull',
  'global-gull': 'gull',
  'coastal-bird': 'gull',
  'toucan-rio': 'toucan',
  'tropical-bird': 'toucan',
  'global-tropical-bird': 'toucan',
  quetzal: 'quetzal',
  'quetzal-rio': 'quetzal',
  'jungle-primates': 'howler',
  'chiang-mai-primates': 'howler',
  'global-jungle-primates': 'howler',
  'summer-cicadas': 'insects',
  'evening-crickets': 'insects',
  'evening-insects': 'insects',
  'dolomites-insects': 'insects',
  'dusk-insects': 'insects',
  'jungle-insects': 'insects',
  'tropical-insects': 'insects',
  'global-insects': 'insects',
  'global-frogs': 'insects',
  blackbird: 'gray-catbird',
  nightingale: 'gray-catbird',
  'street-bird': 'gray-catbird',
  'alpine-bird': 'gray-catbird',
  'hill-bird': 'gray-catbird',
  'global-songbird': 'gray-catbird',
};

/** Fixed plates not yet in generated fixedIcons. */
const extendedFixedIcons: Record<string, string> = {
  toucan: '/icons/toucan.jpg',
};

/** Exclude Met plates whose titles are semantically wrong for a pool. */
const POOL_TITLE_BLOCKLIST: Partial<Record<string, RegExp>> = {
  stream: /figure on shore|boys in a dory|figure in a canoe|portrait|marie antoinette/i,
  surf: /figure on shore/i,
  wind: /marie antoinette|portrait/i,
  rain: /new york from the heights/i,
  forest: /figure in a canoe/i,
};

/** Keyword rules for sounds missing an explicit pool mapping (checked in order). */
const SEMANTIC_POOL_RULES: Array<{ test: (soundId: string) => boolean; pool: string }> = [
  // Generic owls (non-NZ) use the owl pool. NZ morepork/ruru sounds are handled
  // earlier via the NZ-only species alias and never reach here.
  { test: (id) => /(?:^|-)owl(?:$|-)|night-owl/.test(id), pool: 'owl' },
  { test: (id) => /(?:^|-)(?:stream|creek|brook|river|waterfall)(?:$|-)/.test(id), pool: 'stream' },
  { test: (id) => /surf|coastal-surf|seabird|ocean|waves/.test(id), pool: 'surf' },
  { test: (id) => /(?:^|-)(?:wind|breeze|gust)(?:$|-)/.test(id), pool: 'wind' },
  { test: (id) => /rain|monsoon|shower|drizzle|storm/.test(id), pool: 'rain' },
  { test: (id) => /traffic|city-hum|motorway|highway/.test(id), pool: 'traffic' },
  { test: (id) => /park-rustle|domain-park|park-ambience/.test(id), pool: 'nyc-park' },
  {
    test: (id) => /forest|bush|canopy|understory|woodland|ambience/.test(id),
    pool: 'forest',
  },
];

/** Street/traffic pool without theatre or circus imagery; lead with bundled urban plates. */
function buildTrafficPool(): IconPoolEntry[] {
  const filtered = (iconPools['nyc-traffic'] ?? []).filter(
    (entry) => !entry.src.includes('388212'),
  );
  const rooftops = (iconPools['nyc-breeze'] ?? []).find((entry) =>
    entry.src.includes('853645'),
  );
  const bundled = filtered.filter((entry) => isLocallyBundledIconSrc(entry.src));
  const lead = [rooftops, ...bundled].filter((entry): entry is IconPoolEntry => Boolean(entry));
  const leadSrcs = new Set(lead.map((entry) => entry.src));
  return [...lead, ...filtered.filter((entry) => !leadSrcs.has(entry.src))];
}

const extraIconPools: Record<string, IconPoolEntry[]> = {
  traffic: buildTrafficPool(),
};

const mergedIconPools: Record<string, IconPoolEntry[]> = {
  ...iconPools,
  ...extraIconPools,
};

/** Extra sound → icon pool mappings for world-region sounds (reuse Met/Wikimedia pools). */
const soundPoolMap: Record<string, string> = {
  ...generatedSoundPoolMap,
  'copacabana-surf': 'surf',
  'atlantic-wind': 'wind',
  seabird: 'surf',
  'city-hum': 'traffic',
  'park-rustle': 'nyc-park',
  'urban-breeze': 'nyc-breeze',
  'distant-traffic': 'traffic',
  'london-rain': 'rain',
  'thames-breeze': 'nyc-breeze',
  'park-ambience': 'nyc-park',
  'distant-city': 'traffic',
  'alpine-wind': 'wind',
  'mountain-stream': 'stream',
  'forest-valley': 'forest',
  'monsoon-rain': 'rain',
  // Auckland / NZ expansions
  'domain-park': 'nyc-park',
  'auckland-rain': 'rain',
  'urban-creek': 'stream',
  'harbor-traffic': 'traffic',
  'forest-rain': 'rain',
  'bush-stream': 'stream',
  'coastal-surf': 'surf',
  // Rio expansions
  'rio-rain': 'rain',
  'rio-stream': 'stream',
  'rio-traffic': 'traffic',
  // Bed-Stuy expansions
  'brooklyn-rain': 'rain',
  'park-stream': 'stream',
  // London expansions
  'thames-stream': 'stream',
  'london-traffic': 'traffic',
  'street-jazz-busker': 'market',
  'global-jazz': 'market',
  // Dolomites expansions
  'alpine-rain': 'rain',
  'dolomites-surf': 'surf',
  // Chiang Mai expansions
  'temple-wind': 'wind',
  'chiang-mai-forest': 'forest',
  // Pacific Slope expansions
  'canopy-wind': 'wind',
  'forest-floor': 'forest',
  'pacific-surf': 'surf',
  'understory-bird': 'toucan',
  // Global library
  'global-wind': 'wind',
  'global-rain': 'rain',
  'global-stream': 'stream',
  'global-forest': 'forest',
  'global-surf': 'surf',
  'global-traffic': 'traffic',
};

const SESSION_KEY = 'saudade-icon-seed';
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

/**
 * Location/climate-aware flavour scoring. Each icon pool entry can carry region
 * /climate `tags` (tropical, temperate, cold, alpine, coastal, urban, asian,
 * european, americas, pacific, nz, forest, woodland, mountain, …). The resolver
 * prefers entries whose tags intersect the scene's tags so a Caribbean place
 * gets tropical art instead of a Japanese woodblock or a Russian forest, while
 * untagged/non-matching entries remain valid generic fallbacks.
 *
 * Scoring is pure + deterministic (no randomness), so selection stays seeded and
 * never flickers between renders.
 */
const FLAVOUR_CLIMATE_TAGS = new Set(['tropical', 'temperate', 'cold']);
const FLAVOUR_HOT_TAGS = new Set(['tropical']);
const FLAVOUR_COLD_TAGS = new Set(['cold', 'arctic']);

function flavourScore(
  entryTags: VariantTag[] | undefined,
  sceneTags: VariantTag[] | undefined,
): number {
  if (!entryTags?.length || !sceneTags?.length) return 0;
  const scene = new Set(sceneTags);
  let score = 0;
  for (const tag of entryTags) {
    if (scene.has(tag)) score += FLAVOUR_CLIMATE_TAGS.has(tag) ? 2 : 1;
  }
  // Hard climate conflict: tropical art in a cold scene (or vice-versa) reads as
  // wrong (e.g. a Snowy Owl over a tropical city). Temperate is compatible with
  // both and never conflicts.
  const sceneHot = sceneTags.some((tag) => FLAVOUR_HOT_TAGS.has(tag));
  const sceneCold = sceneTags.some((tag) => FLAVOUR_COLD_TAGS.has(tag));
  const entryHot = entryTags.some((tag) => FLAVOUR_HOT_TAGS.has(tag));
  const entryCold = entryTags.some((tag) => FLAVOUR_COLD_TAGS.has(tag));
  if ((sceneHot && entryCold) || (sceneCold && entryHot)) score -= 4;
  return score;
}

/**
 * Narrow a pool to the best flavour matches for a scene. When nothing matches
 * (best score ≤ 0) the full pool is returned so generic art still applies.
 */
function preferFlavourMatches(
  pool: IconPoolEntry[],
  sceneTags: VariantTag[] | undefined,
): IconPoolEntry[] {
  if (!sceneTags?.length || pool.length <= 1) return pool;
  let best = -Infinity;
  for (const entry of pool) {
    best = Math.max(best, flavourScore(entry.tags, sceneTags));
  }
  if (best <= 0) return pool;
  const top = pool.filter((entry) => flavourScore(entry.tags, sceneTags) === best);
  return top.length > 0 ? top : pool;
}

function pickFromPool(
  pool: IconPoolEntry[],
  variantKey: string,
  sceneTags?: VariantTag[],
): IconPoolEntry {
  const resolvable = pool.filter((entry) => iconEntryResolvableRank(entry) < 3);
  const base = resolvable.length > 0 ? resolvable : pool;
  const candidates = preferFlavourMatches(base, sceneTags);
  return candidates[hashToIndex(variantKey, candidates.length)];
}

function iconEntryResolvableRank(entry: IconPoolEntry): number {
  if (isLocallyBundledIconSrc(entry.src)) return 0;
  if (entry.detailSrc) return 1;
  if (entry.sourceUrl?.includes('commons.wikimedia.org')) return 2;
  return 3;
}

function withDisplaySrc(entry: IconPoolEntry): IconPoolEntry {
  return { ...entry, src: resolveTileIconSrc(entry) };
}

function resolveSemanticPool(soundId: string): string | undefined {
  for (const rule of SEMANTIC_POOL_RULES) {
    if (rule.test(soundId)) return rule.pool;
  }
  return undefined;
}

function resolvePoolName(soundId: string): string | undefined {
  return soundPoolMap[soundId] ?? resolveSemanticPool(soundId);
}

function filterPoolEntries(poolName: string, pool: IconPoolEntry[]): IconPoolEntry[] {
  const blocklist = POOL_TITLE_BLOCKLIST[poolName];
  if (!blocklist) return pool;
  const filtered = pool.filter((entry) => !blocklist.test(entry.title));
  return filtered.length > 0 ? filtered : pool;
}

function getPoolForSound(soundId: string): IconPoolEntry[] | undefined {
  const poolName = resolvePoolName(soundId);
  if (!poolName) return undefined;
  const pool = mergedIconPools[poolName];
  if (!pool?.length) return undefined;
  return filterPoolEntries(poolName, pool);
}

function resolveFixedIconId(soundId: string, regionId?: string): string {
  if (regionId && NZ_REGION_IDS.has(regionId)) {
    const nzAlias = nzOnlySpeciesIconAliases[soundId];
    if (nzAlias) return nzAlias;
  }
  return fixedIconAliases[soundId] ?? speciesIconAliases[soundId] ?? soundId;
}

function fixedIconEntry(soundId: string, regionId?: string): IconPoolEntry | null {
  const resolvedId = resolveFixedIconId(soundId, regionId);
  const src = fixedIcons[resolvedId] ?? extendedFixedIcons[resolvedId];
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
    title: resolvedId,
    author: 'Unknown',
    license: 'Public domain',
    sourceUrl: src,
  };
}

function rankPoolEntries(
  pool: IconPoolEntry[],
  regionId: string,
  soundId: string,
  sceneTags?: VariantTag[],
): IconPoolEntry[] {
  return [...pool].sort((left, right) => {
    // Flavour match dominates: prefer art that suits the scene's region/climate.
    const flavourDelta = flavourScore(right.tags, sceneTags) - flavourScore(left.tags, sceneTags);
    if (flavourDelta !== 0) return flavourDelta;
    const resolvableDelta = iconEntryResolvableRank(left) - iconEntryResolvableRank(right);
    if (resolvableDelta !== 0) return resolvableDelta;
    const leftRank = hashToIndex(`${regionId}:${soundId}:${left.src}`, pool.length);
    const rightRank = hashToIndex(`${regionId}:${soundId}:${right.src}`, pool.length);
    return leftRank - rightRank;
  });
}

function assignUniqueRegionArtwork(
  regionId: string,
  soundIds: string[],
  sceneTags?: VariantTag[],
): Map<string, IconPoolEntry> {
  const usedSrc = new Set<string>();
  const assignments = new Map<string, IconPoolEntry>();

  for (const soundId of soundIds) {
    const fixed = fixedIconEntry(soundId, regionId);
    if (fixed) {
      const resolved = withDisplaySrc(fixed);
      assignments.set(soundId, resolved);
      usedSrc.add(resolved.src);
      continue;
    }

    const pool = getPoolForSound(soundId);
    if (!pool?.length) continue;

    const ranked = rankPoolEntries(pool, regionId, soundId, sceneTags);
    const pick = ranked.find((entry) => !usedSrc.has(resolveTileIconSrc(entry))) ?? ranked[0];
    const resolved = withDisplaySrc(pick);
    usedSrc.add(resolved.src);
    assignments.set(soundId, resolved);
  }

  return assignments;
}

export function getRegionArtworkMap(
  regionId: string,
  regionSoundIds: string[],
  sceneTags?: VariantTag[],
): Map<string, IconPoolEntry> {
  const key = `${regionId}:${regionSoundIds.join(',')}:${sceneTags?.join(',') ?? ''}`;
  const cached = regionArtCache.get(key);
  if (cached) return cached;

  const map = assignUniqueRegionArtwork(regionId, regionSoundIds, sceneTags);
  regionArtCache.set(key, map);
  return map;
}

export function getSoundIconEntry(
  soundId: string,
  variantKey?: string,
  sceneTags?: VariantTag[],
): IconPoolEntry | null {
  const fixed = fixedIconEntry(soundId);
  if (fixed) return withDisplaySrc(fixed);

  const pool = getPoolForSound(soundId);
  if (!pool?.length) return null;

  const key = variantKey ?? `${sessionSeed}:${soundId}`;
  return withDisplaySrc(pickFromPool(pool, key, sceneTags));
}

export function getSoundArtwork(
  soundId: string,
  variantKey?: string,
  sceneTags?: VariantTag[],
): IconPoolEntry {
  const fixed = fixedIconEntry(soundId);
  if (fixed) return withDisplaySrc(fixed);

  const pooled = getSoundIconEntry(soundId, variantKey, sceneTags);
  if (pooled) return pooled;

  const semanticPool = resolveSemanticPool(soundId);
  const fallbackPoolName = semanticPool ?? resolvePoolName(soundId) ?? 'forest';
  const fallbackPool = getPoolForSound(fallbackPoolName) ?? mergedIconPools.forest;
  if (fallbackPool?.length) {
    return withDisplaySrc(pickFromPool(fallbackPool, `${sessionSeed}:${soundId}`, sceneTags));
  }

  return withDisplaySrc({
    src: FALLBACK_ICON_SRC,
    title: 'Cat-Bird, 1. Male 2. Female (Plant Black-berry, Rubus villosus.), No. 28, Pl. 140',
    author: 'John James Audubon; lith. W. Endicott & Co.',
    license: 'Public domain (NYPL: no known U.S. copyright restrictions). Credit: From The New York Public Library.',
    sourceUrl: 'https://digitalcollections.nypl.org/items/2a28c850-c5f9-012f-9b77-58d385a7bc34',
  });
}

export function getSoundArtworkForRegion(
  regionId: string,
  regionSoundIds: string[],
  soundId: string,
  variantKey?: string,
  sceneTags?: VariantTag[],
): IconPoolEntry {
  const regional = getRegionArtworkMap(regionId, regionSoundIds, sceneTags).get(soundId);
  if (regional) return regional;
  return getSoundArtwork(soundId, variantKey, sceneTags);
}

export type RegionArtContext = {
  id: string;
  soundIds: string[];
  /** Scene-wide region/climate flavour tags biasing tile art selection. */
  tags?: VariantTag[];
};

export function getSoundIconSrc(
  soundId: string,
  variantKey?: string,
  region?: RegionArtContext,
): string {
  if (region) {
    return getSoundArtworkForRegion(
      region.id,
      region.soundIds,
      soundId,
      variantKey,
      region.tags,
    ).src;
  }
  return getSoundArtwork(soundId, variantKey).src;
}

export { artworkAttributions };
