import type { VariantTag } from './types';

/**
 * Offline country -> culture profile table (Phase 1).
 *
 * The procedural generator reasons almost entirely from a country code and a
 * latitude band. This table adds the human/cultural signal that makes a searched
 * city feel like itself: which place-of-worship voice drifts over the rooftops
 * (temple bell/gong vs church bell vs the adhan), whether the street bed is a
 * busy developing-world thoroughfare or a calmer hum, the characteristic market
 * style, and (where uncontroversial) a signature instrument.
 *
 * It is deliberately coarse: one profile per country, with a regional default
 * for any country not listed. The generator turns the profile into typed layers
 * (bells / adhan / traffic / city-hum / market) carrying the scene's region tags,
 * and the seeded picker in soundscapeSelection.ts resolves a region-true clip.
 */

/** The dominant place-of-worship bed for a place. */
export type WorshipStyle = 'temple' | 'church' | 'adhan' | 'none';

/**
 * How the base urban bed sounds. `busy` routes the base bed through the
 * `traffic` pool (Manila jeepney / Lagos bus park / horns), the right texture
 * for dense developing-world streets. `calm` routes it through `city-hum` (a
 * softer distant murmur) for modern/quieter cities.
 */
export type StreetStyle = 'busy' | 'calm';

/**
 * Bird routing hint. `tropical-asian` pins the koel + a Common Myna for warm
 * South/Southeast-Asian cities (the iconic city pair). `default` lets the
 * region-tagged picker choose from the continent's songbird / tropical-bird pool.
 */
export type BirdStyle = 'tropical-asian' | 'default';

export type CultureProfile = {
  worship: WorshipStyle;
  street: StreetStyle;
  birds: BirdStyle;
  /** Sub-region / cultural flavour tags appended to the scene tags. */
  tags?: VariantTag[];
};

/**
 * Regional defaults, keyed by the continent bucket the generator already
 * derives (european | americas | asian | african | pacific | nz). Any country
 * without an explicit override below inherits its region's default.
 */
const REGION_DEFAULTS: Record<string, CultureProfile> = {
  european: { worship: 'church', street: 'calm', birds: 'default' },
  americas: { worship: 'church', street: 'calm', birds: 'default', tags: ['latam'] },
  asian: { worship: 'temple', street: 'calm', birds: 'default' },
  african: { worship: 'church', street: 'busy', birds: 'default' },
  pacific: { worship: 'church', street: 'calm', birds: 'default' },
  nz: { worship: 'church', street: 'calm', birds: 'default' },
};

const SEA: VariantTag[] = ['seasian'];
const SOUTH_ASIA: VariantTag[] = ['southasian'];
const EAST_ASIA: VariantTag[] = ['eastasian'];
const MENA: VariantTag[] = ['mena'];
const LATAM: VariantTag[] = ['latam'];

/**
 * Per-country overrides. Religion drives `worship`; regional street character
 * drives `street`; warm South/Southeast-Asian countries route birds to the
 * koel + myna pair. Only the culturally salient countries need an entry; the
 * rest fall back to REGION_DEFAULTS.
 */
const COUNTRY_PROFILES: Record<string, CultureProfile> = {
  // ---- Southeast Asia (busy motorbike/jeepney streets, warm koel + myna) ----
  vn: { worship: 'temple', street: 'busy', birds: 'tropical-asian', tags: SEA },
  th: { worship: 'temple', street: 'busy', birds: 'tropical-asian', tags: SEA },
  kh: { worship: 'temple', street: 'busy', birds: 'tropical-asian', tags: SEA },
  la: { worship: 'temple', street: 'busy', birds: 'tropical-asian', tags: SEA },
  mm: { worship: 'temple', street: 'busy', birds: 'tropical-asian', tags: SEA },
  id: { worship: 'adhan', street: 'busy', birds: 'tropical-asian', tags: SEA },
  my: { worship: 'adhan', street: 'busy', birds: 'tropical-asian', tags: SEA },
  bn: { worship: 'adhan', street: 'busy', birds: 'tropical-asian', tags: SEA },
  ph: { worship: 'church', street: 'busy', birds: 'tropical-asian', tags: SEA },
  sg: { worship: 'temple', street: 'calm', birds: 'tropical-asian', tags: SEA },
  // ---- South Asia (busy streets; Hindu/Buddhist temples or the adhan) ----
  in: { worship: 'temple', street: 'busy', birds: 'tropical-asian', tags: SOUTH_ASIA },
  np: { worship: 'temple', street: 'busy', birds: 'tropical-asian', tags: SOUTH_ASIA },
  lk: { worship: 'temple', street: 'busy', birds: 'tropical-asian', tags: SOUTH_ASIA },
  bt: { worship: 'temple', street: 'calm', birds: 'default', tags: SOUTH_ASIA },
  bd: { worship: 'adhan', street: 'busy', birds: 'tropical-asian', tags: SOUTH_ASIA },
  pk: { worship: 'adhan', street: 'busy', birds: 'default', tags: SOUTH_ASIA },
  // ---- East Asia (calmer modern streets; temple/shrine bells) ----
  jp: { worship: 'temple', street: 'calm', birds: 'default', tags: EAST_ASIA },
  kr: { worship: 'temple', street: 'calm', birds: 'default', tags: EAST_ASIA },
  tw: { worship: 'temple', street: 'calm', birds: 'default', tags: EAST_ASIA },
  cn: { worship: 'temple', street: 'calm', birds: 'default', tags: EAST_ASIA },
  hk: { worship: 'temple', street: 'calm', birds: 'default', tags: EAST_ASIA },
  mo: { worship: 'temple', street: 'calm', birds: 'default', tags: EAST_ASIA },
  mn: { worship: 'temple', street: 'calm', birds: 'default', tags: EAST_ASIA },
  // ---- Middle East & North Africa (the adhan; calmer base to avoid a
  // wrong-subregion African/Asian street clip playing over the Gulf/Levant) ----
  sa: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  ae: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  qa: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  kw: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  bh: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  om: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  jo: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  lb: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  sy: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  iq: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  ir: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  ye: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  il: { worship: 'church', street: 'calm', birds: 'default', tags: MENA },
  tr: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  eg: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  ly: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  tn: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  dz: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  ma: { worship: 'adhan', street: 'calm', birds: 'default', tags: MENA },
  // ---- Sub-Saharan Africa (busy streets → Lagos bus-park / market beds) ----
  ng: { worship: 'church', street: 'busy', birds: 'default' },
  gh: { worship: 'church', street: 'busy', birds: 'default' },
  ke: { worship: 'church', street: 'busy', birds: 'default' },
  ug: { worship: 'church', street: 'busy', birds: 'default' },
  tz: { worship: 'church', street: 'busy', birds: 'default' },
  et: { worship: 'church', street: 'busy', birds: 'default' },
  cd: { worship: 'church', street: 'busy', birds: 'default' },
  cm: { worship: 'church', street: 'busy', birds: 'default' },
  ci: { worship: 'church', street: 'busy', birds: 'default' },
  za: { worship: 'church', street: 'busy', birds: 'default' },
  zw: { worship: 'church', street: 'busy', birds: 'default' },
  ao: { worship: 'church', street: 'busy', birds: 'default' },
  sn: { worship: 'adhan', street: 'busy', birds: 'default' },
  ml: { worship: 'adhan', street: 'busy', birds: 'default' },
  ne: { worship: 'adhan', street: 'busy', birds: 'default' },
  so: { worship: 'adhan', street: 'busy', birds: 'default' },
  gn: { worship: 'adhan', street: 'busy', birds: 'default' },
  // ---- Latin America (calm street + street-vendor hum; Catholic church bells) ----
  mx: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  br: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  ar: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  co: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  pe: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  cl: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  ve: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  ec: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  bo: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  py: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  uy: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  gt: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  cu: { worship: 'church', street: 'calm', birds: 'default', tags: ['caribbean', ...LATAM] },
  do: { worship: 'church', street: 'calm', birds: 'default', tags: ['caribbean', ...LATAM] },
  cr: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
  pa: { worship: 'church', street: 'calm', birds: 'default', tags: LATAM },
};

/**
 * Resolve a place's culture profile from its country code, falling back to the
 * continent default (and finally a neutral calm/church profile) so every place
 * gets a coherent human layer.
 */
export function getCultureProfile(
  countryCode: string | undefined,
  regionTag: VariantTag,
): CultureProfile {
  const cc = countryCode?.toLowerCase();
  if (cc && COUNTRY_PROFILES[cc]) return COUNTRY_PROFILES[cc];
  return REGION_DEFAULTS[regionTag] ?? { worship: 'church', street: 'calm', birds: 'default' };
}
