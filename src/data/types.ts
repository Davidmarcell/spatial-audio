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
  | 'jazz'
  | 'bossa-nova'
  | 'kookaburra'
  | 'tram'
  | 'fado'
  | 'adhan'
  | 'ney'
  | 'lion'
  | 'elephant'
  | 'musette';

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
  /**
   * When true, this clip is only ever used when a sound explicitly pins it via
   * `fixedClipId`; it is excluded from the location-seeded dispersion/weighted
   * pools. Used for signature species (e.g. a Redwoods raven) so a distinctive
   * recording stays unique to its intended pin instead of dispersing onto
   * unrelated same-continent pins.
   */
  pinnedOnly?: boolean;
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
  /**
   * Pin this sound to a specific clip from its `type` pool. Used for marquee
   * native species (e.g. the Tui) where a scene has more same-type tiles than
   * distinct native recordings, so the iconic voice is guaranteed rather than
   * losing its clip to dispersion. Ignored if the clip isn't in the pool.
   */
  fixedClipId?: string;
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
