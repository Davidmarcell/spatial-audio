import { poolForType } from '../data/soundPools';
import type { SoundClip, SoundDef, SoundType, VariantTag } from '../data/types';
import { createRng, rngRange, weightedPick, type Rng } from './seededRandom';

/**
 * A resolved playback recipe for one sound in a scene: the chosen variant clip,
 * an optional secondary clip for sustained-bed crossfade, and per-instance
 * micro-variation parameters. The engine consumes this to vary every layer.
 */
export type ResolvedVariant = {
  soundId: string;
  clipId: string;
  src: string;
  /** Second sustained variant for dual-layer crossfade (distinct from `src`). */
  secondarySrc?: string;
  sustained: boolean;
  /** Slight pitch offset in cents (e.g. -18..+18) so reused layers differ. */
  detuneCents: number;
  /** Fraction (0..1) of the buffer to skip before the loop begins. */
  loopOffset: number;
  attribution: { title: string; author: string; license: string; sourceUrl: string };
};

export type SceneVariantSelection = Map<string, ResolvedVariant>;

export type SelectionOptions = {
  /** Stable per-location key (e.g. "nz-forest:auckland" or a custom place id). */
  seed: string;
  /** Bump to regenerate a fresh take of the same place ("Shuffle"). */
  salt?: number;
  /** Scene-wide flavour tags (biome/region) that bias every pick. */
  sceneTags?: VariantTag[];
};

const BASE_WEIGHT = 1;
const TAG_MATCH_BONUS = 3;
const SCENE_TAG_BONUS = 1.5;
const REGION_MATCH_BONUS = 6;
/** Effectively excludes a region-conflicting clip while an in-region one exists. */
const REGION_CONFLICT_PENALTY = -1000;
/**
 * Mild cross-location dispersion for the *ambient* pools (wind, rain, forest…),
 * which still use the proportional `weightedPick`. Kept below the tag bonuses so
 * context-appropriate clips remain preferred; it only breaks ties between
 * otherwise-equivalent ambiences so neighbouring pins don't all share one clip.
 * Distinctive species pools use `pickDispersed` instead (see below), which
 * spreads far more aggressively.
 */
const DISPERSE_SPREAD = 1.5;

/** Stable hash of a string → float in [0, 1). */
function hash01(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Continent/region flavour tags. A clip that carries one of these belongs to a
 * biogeographic region; a scene in a different region must not play it (mirrors
 * the image `flavourScore` cross-conflict). Sub-regions are compatible with
 * their parent continent so e.g. a Mediterranean scene can still use European
 * clips.
 */
const REGION_TAGS = new Set([
  'european',
  'americas',
  'asian',
  'african',
  'pacific',
  'nz',
  'mediterranean',
  'caribbean',
  'neotropical',
  'nearctic',
  // Middle East & North Africa. A distinct biogeographic/cultural region so a
  // searched Gulf/Levant city does not grab a Sub-Saharan African or East-Asian
  // street/market clip; with no MENA-tagged street/market yet it falls back to a
  // region-neutral bed rather than a wrong-continent one.
  'mena',
]);

const REGION_COMPAT: Record<string, string[]> = {
  nz: ['pacific'],
  pacific: ['nz'],
  caribbean: ['americas', 'neotropical'],
  neotropical: ['americas', 'caribbean'],
  nearctic: ['americas'],
  americas: ['caribbean', 'neotropical', 'nearctic'],
  mediterranean: ['european'],
  european: ['mediterranean'],
};

function regionTagsOf(tags: Iterable<VariantTag>): Set<VariantTag> {
  const out = new Set<VariantTag>();
  for (const tag of tags) if (REGION_TAGS.has(tag)) out.add(tag);
  return out;
}

function regionsCompatible(clipRegions: Set<VariantTag>, sceneRegions: Set<VariantTag>): boolean {
  if (sceneRegions.size === 0) return true;
  for (const cr of clipRegions) {
    if (sceneRegions.has(cr)) return true;
    for (const compat of REGION_COMPAT[cr] ?? []) {
      if (sceneRegions.has(compat)) return true;
    }
  }
  return false;
}

function scoreClip(
  clip: SoundClip,
  defTags: Set<VariantTag>,
  sceneTags: Set<VariantTag>,
  sceneRegions: Set<VariantTag>,
  disperseSeed: string,
): number {
  let score = BASE_WEIGHT * (clip.weight ?? 1);
  for (const tag of clip.tags) {
    if (defTags.has(tag)) score += TAG_MATCH_BONUS;
    else if (sceneTags.has(tag)) score += SCENE_TAG_BONUS;
  }

  // Region gating: an in-region clip is strongly preferred; a clip that belongs
  // to a conflicting continent is pushed below zero so weightedPick avoids it as
  // long as an in-region or region-neutral clip is available.
  const clipRegions = regionTagsOf(clip.tags);
  if (clipRegions.size > 0 && sceneRegions.size > 0) {
    if (regionsCompatible(clipRegions, sceneRegions)) score += REGION_MATCH_BONUS;
    else score += REGION_CONFLICT_PENALTY;
  }

  // Cross-location dispersion: nudge the score by a per-(location, clip) amount
  // so different pins favour different clips from the same pool.
  score += DISPERSE_SPREAD * hash01(`${disperseSeed}|${clip.id}`);
  return score;
}

/**
 * Distinctive species calls (owl, corvid, gibbon…) are instantly recognisable,
 * so the *same* clip landing on many unrelated pins reads as a bug. For these
 * pools we pick deterministically by a per-(location, clip) hash instead of the
 * proportional weightedPick, which otherwise lets the single highest-weighted
 * recording win in nearly every scene. Region-appropriate clips are still
 * strictly preferred; the hash only spreads the pick *within* the eligible tier,
 * distributing the pool as evenly across locations as its size allows.
 */
const DISTINCTIVE_TYPES = new Set<SoundType>([
  'owl', 'corvid', 'tropical-bird', 'primates', 'songbird', 'seabird',
]);

function pickDispersed(
  candidates: SoundClip[],
  sceneRegions: Set<VariantTag>,
  disperseSeed: string,
): SoundClip | undefined {
  if (candidates.length === 0) return undefined;
  const ranked = candidates
    .map((clip) => {
      const clipRegions = regionTagsOf(clip.tags);
      let tier = 1; // region-neutral: usable anywhere
      if (clipRegions.size > 0 && sceneRegions.size > 0) {
        tier = regionsCompatible(clipRegions, sceneRegions) ? 2 : 0; // matched > neutral > conflicting
      }
      return { clip, tier, hash: hash01(`${disperseSeed}|${clip.id}`) };
    })
    .filter((r) => r.tier > 0);
  const pool = ranked.length > 0
    ? ranked
    : candidates.map((clip) => ({ clip, tier: 0, hash: hash01(`${disperseSeed}|${clip.id}`) }));
  pool.sort((a, b) => (b.tier - a.tier) || (b.hash - a.hash));
  return pool[0].clip;
}

/**
 * Deterministically assign each typed sound a variant clip from its pool.
 * Guarantees:
 *  - same `seed` (+ `salt`) → identical assignment (stable across reloads),
 *  - different seeds → different combinations,
 *  - no duplicate clip within one scene (when the pool allows),
 *  - tag-weighted bias toward context-appropriate variants.
 * Sounds without a `type` (or an empty pool) are skipped → engine uses `src`.
 */
export function selectSceneVariants(
  sounds: readonly SoundDef[],
  options: SelectionOptions,
): SceneVariantSelection {
  const { seed, salt = 0, sceneTags = [] } = options;
  const sceneTagSet = new Set(sceneTags);
  const sceneRegions = regionTagsOf(sceneTagSet);
  const selection: SceneVariantSelection = new Map();
  const usedClipIds = new Set<string>();

  // Stable ordering so the no-duplicate constraint resolves deterministically
  // regardless of the order sounds arrive in. Pinned (fixedClipId) sounds are
  // resolved first so they always claim their intended clip before dispersion
  // hands it to another same-type tile.
  const ordered = [...sounds].sort((a, b) => {
    const pa = a.fixedClipId ? 0 : 1;
    const pb = b.fixedClipId ? 0 : 1;
    return pa - pb || a.id.localeCompare(b.id);
  });

  for (const sound of ordered) {
    if (!sound.type) continue;
    const pool = poolForType(sound.type);
    if (pool.length === 0) continue;

    const defTags = new Set(sound.variantTags ?? []);
    const rng = createRng(`${seed}#${salt}#${sound.id}`);

    // Honour an explicit clip pin when the clip exists and is still free.
    if (sound.fixedClipId) {
      const pinned = pool.find((clip) => clip.id === sound.fixedClipId && !usedClipIds.has(clip.id));
      if (pinned) {
        usedClipIds.add(pinned.id);
        selection.set(sound.id, {
          soundId: sound.id,
          clipId: pinned.id,
          src: pinned.src,
          secondarySrc: undefined,
          sustained: pinned.sustained,
          detuneCents: Math.round(rngRange(rng, -18, 18)),
          loopOffset: rngRange(rng, 0, 0.12),
          attribution: {
            title: pinned.title,
            author: pinned.author,
            license: pinned.license,
            sourceUrl: pinned.sourceUrl,
          },
        });
        continue;
      }
    }

    // `pinnedOnly` clips (signature species) are reachable only via the
    // fixedClipId path above; never let the dispersion/weighted pools draw them.
    const usable = pool.filter((clip) => !clip.pinnedOnly);
    const poolForDispersion = usable.length > 0 ? usable : pool;
    const available = poolForDispersion.filter((clip) => !usedClipIds.has(clip.id));
    const candidates = available.length > 0 ? available : poolForDispersion;
    const distinctive = DISTINCTIVE_TYPES.has(sound.type);

    const primary = distinctive
      ? pickDispersed(candidates, sceneRegions, `${seed}#${salt}#${sound.id}`)
      : weightedPick(
          candidates,
          (clip) => scoreClip(clip, defTags, sceneTagSet, sceneRegions, `${seed}#${salt}`),
          rng,
        );
    if (!primary) continue;
    usedClipIds.add(primary.id);

    let secondarySrc: string | undefined;
    if (primary.sustained) {
      const secondPool = poolForDispersion.filter(
        (clip) => clip.sustained && clip.id !== primary.id && !usedClipIds.has(clip.id),
      );
      const secondary = distinctive
        ? pickDispersed(secondPool, sceneRegions, `${seed}#${salt}#${sound.id}#2`)
        : weightedPick(
        secondPool,
        (clip) => scoreClip(clip, defTags, sceneTagSet, sceneRegions, `${seed}#${salt}#2`),
        rng,
      );
      if (secondary) {
        secondarySrc = secondary.src;
        usedClipIds.add(secondary.id);
      }
    }

    selection.set(sound.id, {
      soundId: sound.id,
      clipId: primary.id,
      src: primary.src,
      secondarySrc,
      sustained: primary.sustained,
      detuneCents: Math.round(rngRange(rng, -18, 18)),
      // Keep offsets subtle so loops use most of each clip (was 0–0.5, felt too short).
      loopOffset: rngRange(rng, 0, 0.12),
      attribution: {
        title: primary.title,
        author: primary.author,
        license: primary.license,
        sourceUrl: primary.sourceUrl,
      },
    });
  }

  return selection;
}

/** Convenience: derive a stable seed string for a curated region. */
export function regionSeed(environmentId: string, regionId: string): string {
  return `${environmentId}:${regionId}`;
}

/** Test/sanity helper: list the chosen clip ids for a scene + seed. */
export function describeSelection(selection: SceneVariantSelection): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [soundId, variant] of selection) out[soundId] = variant.clipId;
  return out;
}

export type { Rng };
