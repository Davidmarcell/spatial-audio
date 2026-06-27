export type SoundCategory = 'bird' | 'ambient' | 'water' | 'insect';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

/**
 * Sound *type* (pool key). Each type is backed by a pool of interchangeable
 * variant clips in `soundPools`. A `SoundDef` references a type so the engine
 * can play a context-matched, location-seeded variant instead of one fixed file.
 */
export type SoundType =
  | 'wind'
  | 'waves'
  | 'rain'
  | 'thunder'
  | 'stream'
  | 'forest'
  | 'insects'
  | 'songbird'
  | 'seabird'
  | 'owl'
  | 'tropical-bird'
  | 'corvid'
  | 'primates'
  | 'city-hum'
  | 'traffic'
  | 'market'
  | 'bells'
  | 'fire'
  | 'frogs'
  | 'jazz';

/**
 * Flavour tags used to bias variant selection toward a location's context
 * (biome / region / habitat). Free-form by design — matching is by string
 * intersection, so new tags can be added without ceremony. Common values:
 * 'tropical' | 'temperate' | 'alpine' | 'cold' | 'coastal' | 'beach' | 'urban'
 * | 'forest' | 'woodland' | 'mountain' | 'wetland' | 'rural' | 'garden' |
 * 'mediterranean' | 'european' | 'asian' | 'americas' | 'pacific' | 'nz' |
 * 'native' | 'night' | 'dawn' | 'dusk' | 'summer' | 'storm' | 'calm' | 'open'.
 */
export type VariantTag = string;

/** One openly-licensed audio clip in a variant pool, with required attribution. */
export type SoundClip = {
  id: string;
  type: SoundType;
  tags: VariantTag[];
  /** Sustained beds can crossfade between two variants; one-shots cannot. */
  sustained: boolean;
  src: string;
  /** Relative weight in weighted selection (default 1). */
  weight?: number;
  title: string;
  author: string;
  license: string;
  sourceUrl: string;
};

export type SoundDef = {
  id: string;
  name: string;
  category: SoundCategory;
  /**
   * Fallback file. When `type` is set, the engine prefers a location-seeded
   * variant from the matching pool and only uses `src` if no variant resolves.
   */
  src: string;
  loop: boolean;
  /** Pool key — links this sound to a pool of interchangeable variant clips. */
  type?: SoundType;
  /** Flavour tags that bias which variant is picked for this sound. */
  variantTags?: VariantTag[];
  description?: string;
  /** Extra search terms (synonyms, scene-building keywords). */
  keywords?: string[];
  /** When set, sound only appears in catalog/palette for these seasons (migratory wildlife). */
  seasons?: Season[];
};

export type AddSoundTab = 'ambient' | 'wildlife';

export type BedSound = {
  soundId: string;
  volume: number;
  position?: SpatialPoint;
};

export type Region = {
  id: string;
  name: string;
  sounds: SoundDef[];
  bedSounds?: BedSound[];
  /** Region has season-dependent bird palette (e.g. Bed-Stuy migration). */
  migratoryBirds?: boolean;
  defaultSeason?: Season;
  /** Stable seed for location-consistent variant selection (defaults to id). */
  seed?: string;
  /** Scene-wide flavour tags (biome/region) biasing variant selection. */
  tags?: VariantTag[];
  /** True for runtime-assembled scenes from arbitrary searched locations. */
  procedural?: boolean;
};

export type Environment = {
  id: string;
  name: string;
  regions: Region[];
};

export type SpatialPoint = {
  x: number;
  y: number;
};

export type ActiveSound = {
  instanceId: string;
  soundId: string;
  position: SpatialPoint;
  volume: number;
};

export type Attribution = {
  file: string;
  title: string;
  author: string;
  license: string;
  sourceUrl: string;
};

export type ArtworkAttribution = Attribution;
