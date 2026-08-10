/**
 * Scene composer (prototype — not yet wired into the app).
 *
 * The shipped generator in `proceduralSoundscape.ts` builds a scene with a fixed
 * if/else chain, which is why forty world cities collapse into twenty shapes
 * (see `scripts/measure-generation-distinctiveness.ts`). This is the replacement
 * described in `docs/SOUNDSCAPE_GENERATION_PLAN.md`: every candidate layer
 * declares how it earns its place, the composer scores them all against the
 * evidence, and a composition contract shapes the result.
 *
 * Two structural differences from the current builder:
 *
 *  - **Signature layers.** Every scene must include at least one layer that is
 *    distinctive for that place. Without this a scene can be individually
 *    plausible and still be indistinguishable from the next city.
 *  - **Exclusions.** A layer can be vetoed outright by the evidence, so a scene
 *    is defined by what it refuses to play as well as what it plays (Venice has
 *    no road traffic; the high Arctic has no cicadas).
 *
 * It is deliberately pure and synchronous: no network, no clock reads beyond the
 * date handed in. Richer signals (OSM features, weather, species occurrence)
 * slot into `PlaceSignals` later without changing the shape of any rule.
 */
import type { CultureProfile } from '../data/cultureProfiles';
import type { VariantTag } from '../data/types';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * Six bands rather than the three the current generator uses. Reykjavík and
 * Madrid are both "temperate" today, which is a large part of why they compose
 * the same scene.
 */
export type LatitudeBand =
  | 'equatorial'
  | 'tropical'
  | 'subtropical'
  | 'temperate'
  | 'boreal'
  | 'polar';

/**
 * Everything the composer reasons over. Only `lat`/`lng`/`name` are required —
 * every other field is evidence that sharpens the result when present, so the
 * composer degrades gracefully while later phases add signal sources.
 */
export type PlaceSignals = {
  name: string;
  lat: number;
  lng: number;
  countryCode?: string;
  regionTag: VariantTag;
  culture: CultureProfile;

  band: LatitudeBand;
  season: Season;
  timeOfDay: TimeOfDay;

  urban: boolean;
  /** Rough settlement scale: a bundled-major-city hit implies a big city. */
  majorCity: boolean;
  coastal: boolean;
  riverine: boolean;
  mountain: boolean;
  forest: boolean;
  arid: boolean;

  /** Populated in a later phase from an OSM Overpass query. */
  features?: {
    subwayStations?: number;
    tramStops?: number;
    ferryTerminals?: number;
    canals?: number;
    motorways?: number;
    marketplaces?: number;
    parks?: number;
    beaches?: number;
  };
};

export type LayerFamily =
  | 'base'
  | 'water'
  | 'wildlife'
  | 'human'
  | 'weather'
  | 'transit'
  | 'music';

export type LayerRule = {
  /** Preset key in `proceduralSoundscape`'s `P` table. */
  preset: string;
  family: LayerFamily;
  /** Eligible for the guaranteed "only here" slot. */
  signature?: boolean;
  /** Hard veto — the place actively should not have this sound. */
  exclude?: (s: PlaceSignals) => boolean;
  /** Positive evidence, in arbitrary points. 0 means "not applicable here". */
  score: (s: PlaceSignals) => number;
};

export function seasonFor(lat: number, date: Date): Season {
  const month = date.getUTCMonth(); // 0-11
  const northern: Season[] = [
    'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
    'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
  ];
  const season = northern[month];
  if (lat >= 0) return season;
  // Southern hemisphere runs six months out of phase.
  const flip: Record<Season, Season> = {
    winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring',
  };
  return flip[season];
}

export function latitudeBandFor(lat: number): LatitudeBand {
  const abs = Math.abs(lat);
  if (abs < 10) return 'equatorial';
  if (abs < 23.5) return 'tropical';
  if (abs < 35) return 'subtropical';
  if (abs < 55) return 'temperate';
  if (abs < 66.5) return 'boreal';
  return 'polar';
}

const WARM_BANDS = new Set<LatitudeBand>(['equatorial', 'tropical', 'subtropical']);
const COLD_BANDS = new Set<LatitudeBand>(['boreal', 'polar']);

/** Insects need warmth AND a season — a Berlin winter is silent. */
function insectSeasonStrength(s: PlaceSignals): number {
  if (COLD_BANDS.has(s.band)) return 0;
  if (WARM_BANDS.has(s.band)) return s.season === 'winter' ? 0.6 : 1;
  if (s.season === 'summer') return 1;
  if (s.season === 'spring' || s.season === 'autumn') return 0.4;
  return 0; // temperate winter
}

/**
 * The rule catalogue. Each entry is self-contained and independently testable,
 * which is the main maintainability argument over the current if/else chain:
 * adding a sound type means adding a rule, not editing a branch someone else
 * owns.
 */
export const LAYER_RULES: LayerRule[] = [
  // ── base beds ────────────────────────────────────────────────────────────
  {
    preset: 'streetTraffic',
    family: 'base',
    // A canal city with no motorways should not have road traffic at all.
    exclude: (s) => (s.features?.canals ?? 0) > 3 && (s.features?.motorways ?? 0) === 0,
    score: (s) => (s.urban && s.culture.street === 'busy' ? 60 : 0),
  },
  {
    preset: 'cityHum',
    family: 'base',
    score: (s) => (s.urban && s.culture.street !== 'busy' ? 55 : 0),
  },
  {
    preset: 'forest',
    family: 'base',
    score: (s) => {
      if (s.urban) return 0;
      if (s.forest) return 60;
      return COLD_BANDS.has(s.band) || s.arid ? 20 : 45;
    },
  },
  {
    preset: 'wind',
    family: 'base',
    signature: true,
    score: (s) => {
      let score = 0;
      if (s.arid) score += 55;
      if (s.mountain) score += 35;
      // Exposed high-latitude coasts are defined by wind more than anything.
      if (COLD_BANDS.has(s.band) && s.coastal) score += 50;
      if (s.band === 'polar') score += 20;
      return score;
    },
  },

  // ── water ────────────────────────────────────────────────────────────────
  {
    preset: 'surf',
    family: 'water',
    score: (s) => (s.coastal ? 55 + (WARM_BANDS.has(s.band) ? 10 : 0) : 0),
  },
  {
    preset: 'stream',
    family: 'water',
    score: (s) => {
      if (s.coastal) return 0;
      if (s.mountain) return 55;
      if (s.riverine) return 45;
      return 0;
    },
  },

  // ── transit signatures ───────────────────────────────────────────────────
  {
    preset: 'subway',
    family: 'transit',
    signature: true,
    score: (s) => {
      const stations = s.features?.subwayStations;
      // No guess without evidence. An early version scored this from
      // `majorCity && urban`, which fired in 33 of 40 sampled cities and turned
      // the signature slot into a uniform — the exact homogenisation this
      // composer exists to prevent. A signature must be earned by discriminating
      // evidence or not claimed at all.
      if (stations == null) return 0;
      return stations === 0 ? 0 : 40 + Math.min(30, stations * 3);
    },
  },
  {
    preset: 'tram',
    family: 'transit',
    signature: true,
    score: (s) => {
      const stops = s.features?.tramStops;
      if (stops != null) return stops === 0 ? 0 : 30 + Math.min(25, stops * 2);
      return 0;
    },
  },

  // ── wildlife ─────────────────────────────────────────────────────────────
  {
    preset: 'seabird',
    family: 'wildlife',
    score: (s) => (s.coastal ? 50 : 0),
  },
  {
    preset: 'tropicalBird',
    family: 'wildlife',
    score: (s) => (WARM_BANDS.has(s.band) && s.band !== 'subtropical' ? 55 : 0),
  },
  {
    preset: 'songbird',
    family: 'wildlife',
    score: (s) => {
      if (WARM_BANDS.has(s.band) && s.band !== 'subtropical') return 20;
      // Spring dawn chorus is the loudest wildlife event of the temperate year.
      const dawnChorus = s.season === 'spring' && (s.timeOfDay === 'dawn' || s.timeOfDay === 'day');
      return 45 + (dawnChorus ? 25 : 0);
    },
  },
  {
    preset: 'corvid',
    family: 'wildlife',
    score: (s) => (s.urban && !WARM_BANDS.has(s.band) ? 35 : 0),
  },
  {
    preset: 'insects',
    family: 'wildlife',
    exclude: (s) => insectSeasonStrength(s) === 0,
    score: (s) => Math.round(45 * insectSeasonStrength(s)),
  },
  {
    preset: 'frogs',
    family: 'wildlife',
    score: (s) => (WARM_BANDS.has(s.band) && (s.riverine || s.forest) ? 35 : 0),
  },
  {
    preset: 'owl',
    family: 'wildlife',
    score: (s) => {
      const night = s.timeOfDay === 'night' || s.timeOfDay === 'dusk';
      if (!night) return 0;
      return s.urban ? 15 : 40;
    },
  },

  // ── human / cultural ─────────────────────────────────────────────────────
  {
    preset: 'adhan',
    family: 'human',
    signature: true,
    score: (s) => (s.urban && s.culture.worship === 'adhan' ? 65 : 0),
  },
  {
    preset: 'bells',
    family: 'human',
    score: (s) => {
      if (!s.urban) return 0;
      if (s.culture.worship === 'temple') return 55;
      if (s.culture.worship === 'church') return 40;
      return 0;
    },
  },
  {
    preset: 'market',
    family: 'human',
    score: (s) => {
      const stalls = s.features?.marketplaces;
      if (stalls != null && stalls === 0) return 0;
      if (!s.urban) return 0;
      return s.culture.street === 'busy' ? 50 : 30;
    },
  },

  // ── weather ──────────────────────────────────────────────────────────────
  {
    preset: 'rain',
    family: 'weather',
    exclude: (s) => s.arid,
    score: (s) => (WARM_BANDS.has(s.band) && s.season === 'summer' ? 25 : 15),
  },
];

/** How many layers of each family a finished scene may contain. */
const FAMILY_CAPS: Record<LayerFamily, number> = {
  base: 1,
  water: 1,
  wildlife: 2,
  human: 2,
  weather: 1,
  transit: 1,
  music: 1,
};

const MAX_BEDS = 6;

export type ComposedLayer = {
  preset: string;
  family: LayerFamily;
  score: number;
  bed: boolean;
  signature: boolean;
};

/**
 * Score every rule, drop vetoed and zero-scoring ones, then fill the scene under
 * the family caps — but seat the best signature layer first, so every place is
 * guaranteed one distinctive voice before the generic beds compete for room.
 * Everything else that scored above zero becomes a dock option.
 */
export function composeScene(signals: PlaceSignals): ComposedLayer[] {
  const scored = LAYER_RULES
    .filter((rule) => !rule.exclude?.(signals))
    .map((rule) => ({
      preset: rule.preset,
      family: rule.family,
      signature: rule.signature === true,
      score: rule.score(signals),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const used: Partial<Record<LayerFamily, number>> = {};
  const beds: ComposedLayer[] = [];
  const options: ComposedLayer[] = [];

  const seat = (entry: (typeof scored)[number]): boolean => {
    const count = used[entry.family] ?? 0;
    if (count >= FAMILY_CAPS[entry.family]) return false;
    if (beds.length >= MAX_BEDS) return false;
    used[entry.family] = count + 1;
    beds.push({ ...entry, bed: true });
    return true;
  };

  // 1. Guarantee a signature voice.
  const topSignature = scored.find((entry) => entry.signature);
  if (topSignature) seat(topSignature);

  // 2. Fill the rest by score under the family caps.
  for (const entry of scored) {
    if (beds.some((bed) => bed.preset === entry.preset)) continue;
    if (!seat(entry)) options.push({ ...entry, bed: false });
  }

  return [...beds, ...options];
}
