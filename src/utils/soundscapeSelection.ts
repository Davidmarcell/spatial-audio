import { poolForType } from '../data/soundPools';
import type { SoundClip, SoundDef, VariantTag } from '../data/types';
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

function scoreClip(clip: SoundClip, defTags: Set<VariantTag>, sceneTags: Set<VariantTag>): number {
  let score = BASE_WEIGHT * (clip.weight ?? 1);
  for (const tag of clip.tags) {
    if (defTags.has(tag)) score += TAG_MATCH_BONUS;
    else if (sceneTags.has(tag)) score += SCENE_TAG_BONUS;
  }
  return score;
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
  const selection: SceneVariantSelection = new Map();
  const usedClipIds = new Set<string>();

  // Stable ordering so the no-duplicate constraint resolves deterministically
  // regardless of the order sounds arrive in.
  const ordered = [...sounds].sort((a, b) => a.id.localeCompare(b.id));

  for (const sound of ordered) {
    if (!sound.type) continue;
    const pool = poolForType(sound.type);
    if (pool.length === 0) continue;

    const defTags = new Set(sound.variantTags ?? []);
    const rng = createRng(`${seed}#${salt}#${sound.id}`);

    const available = pool.filter((clip) => !usedClipIds.has(clip.id));
    const candidates = available.length > 0 ? available : pool;

    const primary = weightedPick(candidates, (clip) => scoreClip(clip, defTags, sceneTagSet), rng);
    if (!primary) continue;
    usedClipIds.add(primary.id);

    let secondarySrc: string | undefined;
    if (primary.sustained) {
      const secondPool = pool.filter(
        (clip) => clip.sustained && clip.id !== primary.id && !usedClipIds.has(clip.id),
      );
      const secondary = weightedPick(
        secondPool,
        (clip) => scoreClip(clip, defTags, sceneTagSet),
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
      loopOffset: rngRange(rng, 0, 0.5),
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
