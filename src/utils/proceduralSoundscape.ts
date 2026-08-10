import {
  PROCEDURAL_ENVIRONMENT_ID,
  registerProceduralRegion,
} from '../data/environments';
import { getCultureProfile, type CultureProfile } from '../data/cultureProfiles';
import { matchMajorCity, type MajorCity } from '../data/majorCities';
import type { BedSound, Region, SoundDef, SoundType, VariantTag } from '../data/types';
import type { Rng } from './seededRandom';

/**
 * Procedural recipe assembly for arbitrary searched locations.
 *
 * Instead of snapping a searched place onto one of a handful of curated
 * templates, this infers climate / biome / urban-vs-nature / coastal traits
 * from the place metadata and composes a layered soundscape from the
 * categorised pools. The layers reference the canonical global sound ids (so
 * existing icon art + palette behaviour keep working) but carry a `type` and
 * place-derived `variantTags`, so the location-seeded picker gives each place a
 * bespoke combination of actual clips.
 */

export type GeocodeContextLite = {
  type?: string;
  class?: string;
  addresstype?: string;
  displayName?: string;
  countryCode?: string;
};

export type ProceduralLocationInfo = {
  name: string;
  lat: number;
  lng: number;
  placeId?: string;
  geocode?: GeocodeContextLite;
};

type Climate = 'tropical' | 'temperate' | 'cold';

const EUROPE = new Set([
  'ad', 'al', 'at', 'ba', 'be', 'bg', 'by', 'ch', 'cy', 'cz', 'de', 'dk', 'ee', 'es', 'fi', 'fr',
  'gb', 'gr', 'hr', 'hu', 'ie', 'is', 'it', 'li', 'lt', 'lu', 'lv', 'mc', 'md', 'me', 'mk', 'mt',
  'nl', 'no', 'pl', 'pt', 'ro', 'rs', 'se', 'si', 'sk', 'sm', 'ua', 'uk', 'va', 'xk',
]);
const AMERICAS = new Set([
  'ar', 'bo', 'br', 'ca', 'cl', 'co', 'cr', 'cu', 'do', 'ec', 'gt', 'gy', 'hn', 'ht', 'jm', 'mx',
  'ni', 'pa', 'pe', 'pr', 'py', 'sr', 'sv', 'us', 'uy', 've',
]);
const PACIFIC = new Set(['au', 'fj', 'nc', 'nz', 'pg', 'sb', 'to', 'vu', 'ws']);
const ASIA = new Set([
  'bd', 'bn', 'bt', 'cn', 'id', 'in', 'jp', 'kh', 'kr', 'la', 'lk', 'mm', 'mn', 'my', 'np', 'ph',
  'sg', 'th', 'tw', 'vn',
]);
const AFRICA = new Set([
  'ao', 'bf', 'bi', 'bj', 'bw', 'cd', 'cf', 'cg', 'ci', 'cm', 'cv', 'dj', 'eh', 'er',
  'et', 'ga', 'gh', 'gm', 'gn', 'gq', 'gw', 'ke', 'km', 'lr', 'ls', 'mg', 'ml', 'mr',
  'mu', 'mw', 'mz', 'na', 'ne', 'ng', 're', 'rw', 'sc', 'sd', 'sl', 'sn', 'so', 'ss', 'st', 'sz',
  'td', 'tg', 'tz', 'ug', 'za', 'zm', 'zw',
]);
// Middle East & North Africa: a distinct cultural region. Kept out of ASIA /
// AFRICA / EUROPE so a searched Gulf/Levant/Maghreb city is tagged `mena` and
// therefore avoids Sub-Saharan African or East-Asian street/market clips (see
// REGION_TAGS in soundscapeSelection).
const MENA = new Set([
  'ae', 'bh', 'dz', 'eg', 'il', 'iq', 'ir', 'jo', 'kw', 'lb', 'ly', 'ma', 'om',
  'ps', 'qa', 'sa', 'sy', 'tn', 'tr', 'ye',
]);

function climateForLat(lat: number): Climate {
  const abs = Math.abs(lat);
  if (abs < 23.5) return 'tropical';
  if (abs < 50) return 'temperate';
  return 'cold';
}

function regionTagForCountry(cc: string | undefined, lng: number, lat: number): VariantTag {
  const code = cc?.toLowerCase();
  if (code) {
    if (MENA.has(code)) return 'mena';
    if (EUROPE.has(code)) return 'european';
    if (AMERICAS.has(code)) return 'americas';
    if (PACIFIC.has(code)) return code === 'nz' ? 'nz' : 'pacific';
    if (ASIA.has(code)) return 'asian';
    if (AFRICA.has(code)) return 'african';
  }
  // Longitude fallback when country code is absent.
  if (lng >= -20 && lng <= 55 && lat < 37) return 'african';
  if (lng >= -30 && lng <= 60) return 'european';
  if (lng < -30) return 'americas';
  return 'asian';
}

type Traits = {
  climate: Climate;
  regionTag: VariantTag;
  urban: boolean;
  coastal: boolean;
  riverine: boolean;
  mountain: boolean;
  forest: boolean;
  arid: boolean;
};

function inferTraits(info: ProceduralLocationInfo): Traits {
  const g = info.geocode ?? {};
  const haystack = [info.name, g.displayName, g.type, g.class, g.addresstype]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Only treat genuinely city-scale places as urban. Small settlements
  // (town/village/hamlet) read as nature-leaning so mountain/forest towns like
  // Banff don't get a city-traffic bed.
  const urbanClass = /\bcity\b|metropolis|downtown|suburb|borough/.test(
    `${g.class ?? ''} ${g.type ?? ''} ${g.addresstype ?? ''}`,
  );

  return {
    climate: climateForLat(info.lat),
    regionTag: regionTagForCountry(g.countryCode, info.lng, info.lat),
    urban: urbanClass || /city|downtown|metro|urban/.test(haystack),
    coastal: /coast|beach|bay|harbour|harbor|port|island|\bsea\b|ocean|cape|gulf|shore|seaside|marina/.test(haystack),
    riverine: /river|lake|delta|loch|reservoir|fjord|canal|creek|stream|pond|wetland|marsh/.test(haystack),
    mountain: /mountain|peak|\balp|ridge|summit|valley|highland|\bmont|\bmount\b|massif/.test(haystack),
    forest: /forest|wood|jungle|rainforest|\bpark\b|reserve|nature|bush|grove/.test(haystack),
    arid: /desert|dune|sahara|outback|arid|steppe/.test(haystack),
  };
}

type LayerSpec = {
  id: string;
  name: string;
  category: SoundDef['category'];
  type: SoundType;
  keywords: string[];
  volume: number;
  bed: boolean;
  fixedClipId?: string;
};

/**
 * Reusable layer presets. Each references a canonical id (so icon art + the
 * typed variant picker resolve a region-appropriate clip) with a sensible
 * default volume. `bed(v?)` marks the layer as part of the auto-playing default
 * palette; `option(v?)` keeps it available in the region library/dock only.
 *
 * Guiding principle (per the curation brief): the default palette is built from
 * NATIVE / characteristic voices for the place. Generic ambiences (wind, rain,
 * surf, owl, generic songbird) are NOT force-defaulted — they remain available
 * to add by hand via the global ambient library.
 */
type Preset = Omit<LayerSpec, 'volume' | 'bed'> & { vol: number };

const P = {
  cityHum: { id: 'global-traffic', name: 'City Hum', category: 'ambient', type: 'city-hum', keywords: ['city', 'urban', 'hum', 'traffic'], vol: 0.22 },
  streetTraffic: { id: 'global-street-traffic', name: 'Street Traffic', category: 'ambient', type: 'traffic', keywords: ['traffic', 'street', 'motorbike', 'scooter', 'horns', 'jeepney'], vol: 0.24 },
  wind: { id: 'global-wind', name: 'Wind', category: 'ambient', type: 'wind', keywords: ['wind', 'breeze'], vol: 0.3 },
  forest: { id: 'global-forest', name: 'Woodland', category: 'ambient', type: 'forest', keywords: ['forest', 'rustle', 'trees'], vol: 0.42 },
  stream: { id: 'global-stream', name: 'Stream', category: 'water', type: 'stream', keywords: ['stream', 'water', 'brook'], vol: 0.44 },
  surf: { id: 'global-surf', name: 'Surf', category: 'water', type: 'waves', keywords: ['surf', 'waves', 'ocean', 'coast'], vol: 0.4 },
  rain: { id: 'global-rain', name: 'Rain', category: 'ambient', type: 'rain', keywords: ['rain', 'shower', 'weather'], vol: 0.4 },
  // Named for what it actually is — a cricket chorus — to match the pinned
  // cricket plate. Scenes that want a different insect override the name (and
  // usually the clip too): 'Cicadas', 'Higurashi Cicadas', 'Jungle Insects'…
  insects: { id: 'global-insects', name: 'Crickets', category: 'insect', type: 'insects', keywords: ['insects', 'crickets', 'cicadas'], vol: 0.2 },
  songbird: { id: 'global-songbird', name: 'Songbirds', category: 'bird', type: 'songbird', keywords: ['bird', 'songbird'], vol: 0.5 },
  seabird: { id: 'global-gull', name: 'Seabirds', category: 'bird', type: 'seabird', keywords: ['gull', 'seabird', 'coast'], vol: 0.42 },
  tropicalBird: { id: 'global-tropical-bird', name: 'Tropical Birds', category: 'bird', type: 'tropical-bird', keywords: ['bird', 'tropical'], vol: 0.5 },
  primates: { id: 'global-jungle-primates', name: 'Canopy Calls', category: 'bird', type: 'primates', keywords: ['monkey', 'primate', 'canopy'], vol: 0.28 },
  corvid: { id: 'global-corvid', name: 'Crows & Magpies', category: 'bird', type: 'corvid', keywords: ['crow', 'magpie', 'corvid'], vol: 0.46 },
  frogs: { id: 'global-frogs', name: 'Frogs', category: 'insect', type: 'frogs', keywords: ['frogs', 'wetland', 'night'], vol: 0.3 },
  bells: { id: 'global-bells', name: 'Temple Bells', category: 'ambient', type: 'bells', keywords: ['bells', 'temple', 'gong'], vol: 0.34 },
  market: { id: 'global-market', name: 'Market', category: 'ambient', type: 'market', keywords: ['market', 'crowd', 'street'], vol: 0.26 },
  jazz: { id: 'global-jazz', name: 'Live Jazz', category: 'ambient', type: 'jazz', keywords: ['jazz', 'music'], vol: 0.4 },
  kookaburra: { id: 'global-kookaburra', name: 'Kookaburra', category: 'bird', type: 'kookaburra', keywords: ['kookaburra', 'laugh', 'australian'], vol: 0.5 },
  owl: { id: 'global-night-owl', name: 'Night Owl', category: 'bird', type: 'owl', keywords: ['owl', 'night', 'nocturnal'], vol: 0.34 },
  // City / instrumental signatures (src resolved from pool, like bossa-nova/bells).
  tram: { id: 'global-tram', name: 'Tram', category: 'ambient', type: 'tram', keywords: ['tram', 'rattle', 'bell', 'streetcar', 'eletrico'], vol: 0.32 },
  fado: { id: 'global-fado', name: 'Fado Guitar', category: 'ambient', type: 'fado', keywords: ['fado', 'guitarra', 'portuguesa', 'guitar', 'music'], vol: 0.4 },
  adhan: { id: 'global-adhan', name: 'Adhan', category: 'ambient', type: 'adhan', keywords: ['adhan', 'call to prayer', 'ezan', 'muezzin', 'mosque'], vol: 0.28 },
  ney: { id: 'global-ney', name: 'Turkish Taksim', category: 'ambient', type: 'ney', keywords: ['ney', 'taksim', 'reed', 'flute', 'ottoman', 'music'], vol: 0.4 },
  lion: { id: 'global-lion', name: 'Distant Lion Roar', category: 'ambient', type: 'lion', keywords: ['lion', 'roar', 'savanna', 'predator'], vol: 0.22 },
  elephant: { id: 'global-elephant', name: 'Distant Elephant', category: 'ambient', type: 'elephant', keywords: ['elephant', 'trumpet', 'savanna', 'herd'], vol: 0.2 },
  musette: { id: 'global-musette', name: 'Musette Accordion', category: 'ambient', type: 'musette', keywords: ['musette', 'accordion', 'accordeon', 'french', 'cafe', 'paris', 'music', 'valse'], vol: 0.36 },
  subway: { id: 'global-subway', name: 'Subway', category: 'ambient', type: 'subway', keywords: ['subway', 'metro', 'underground', 'train', 'platform', 'transit'], vol: 0.28 },
} satisfies Record<string, Preset>;

type PresetKey = keyof typeof P;

function bed(key: PresetKey, opts?: { id?: string; name?: string; vol?: number; keywords?: string[]; clip?: string }): LayerSpec {
  const p = P[key];
  return { ...p, id: opts?.id ?? p.id, name: opts?.name ?? p.name, keywords: opts?.keywords ?? p.keywords, volume: opts?.vol ?? p.vol, bed: true, fixedClipId: opts?.clip };
}
function option(key: PresetKey, opts?: { id?: string; name?: string; vol?: number; clip?: string }): LayerSpec {
  const p = P[key];
  return { ...p, id: opts?.id ?? p.id, name: opts?.name ?? p.name, volume: opts?.vol ?? p.vol, bed: false, fixedClipId: opts?.clip };
}

type Recipe = { extraTags?: VariantTag[]; layers: LayerSpec[] };

function slugifyPlace(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Curated recipes are keyed on the bare place name (`kyoto`), but search hands
 * the generator a full label — "Kyoto, Kyoto Prefecture, Japan" — which
 * slugifies to `kyotokyotoprefecturejapan` and matches nothing. Every
 * hand-authored recipe was therefore unreachable from the search box: typing
 * "Paris" and pressing Enter returned City Hum + Church Bells + Market while the
 * hand-built Paris sat unused.
 *
 * Try the whole label first (so an exact curated key still wins), then the
 * leading comma-segment, which is the place's own name in every label the
 * search builds.
 */
function curatedRecipeFor(name: string): Recipe | undefined {
  const direct = CURATED_PLACES[slugifyPlace(name)];
  if (direct) return direct;
  const head = name.split(',')[0];
  if (!head || head === name) return undefined;
  return CURATED_PLACES[slugifyPlace(head)];
}

/**
 * Bespoke, native-appropriate default palettes for the curated globe pins.
 * Each palette is 4–6 DISTINCT voices someone would actually hear in that
 * place. No owl/rain filler; wind only where it is genuinely characteristic
 * (mountains, open coast, arid plains). Generic ambiences remain addable via
 * the global library.
 */
const CURATED_PLACES: Record<string, Recipe> = {
  // ---- Americas ----
  havana: { extraTags: ['caribbean', 'neotropical'], layers: [
    bed('jazz', { name: 'Son & Trova' }), bed('surf', { name: 'Malecón Surf', vol: 0.34 }),
    bed('songbird', { name: 'Street Birds' }),
    // Bespoke id so Habana Vieja gets its own tall Obispo Street plate instead
    // of the generic Brooklyn rooftops traffic draw.
    bed('cityHum', { id: 'havana-cityhum', name: 'Habana Vieja', clip: 'city-latam-aguascalientes' }),
    bed('insects', { name: 'Warm-Night Insects' }),
  ] },
  monteverde: { extraTags: ['neotropical', 'rainforest', 'cloud-forest'], layers: [
    bed('tropicalBird', { name: 'Resplendent Quetzal', clip: 'legacy-quetzal' }), bed('primates', { name: 'Howlers', vol: 0.26 }),
    bed('insects', { name: 'Jungle Insects' }), bed('frogs', { name: 'Tree Frogs' }),
    bed('stream', { name: 'Forest Stream' }), option('forest', { name: 'Canopy' }),
  ] },
  redwoods: { extraTags: ['nearctic', 'coastal', 'forest', 'temperate'], layers: [
    // Two corvids now play by default: a Common Raven croak and a Steller's Jay
    // call, each pinned to its own sourced nearctic clip + bespoke plate, over
    // the redwood canopy, Pacific wren song, dripping canopy and distant surf.
    // Canopy + drip layers use bespoke ids so they keep Bierstadt / Mønsted
    // plates instead of the generic Met forest/stream pool draws.
    bed('forest', { id: 'redwoods-canopy', name: 'Redwood Canopy' }),
    bed('songbird', { name: 'Pacific Wren & Varied Thrush' }),
    bed('corvid', { id: 'redwoods-raven', name: 'Common Raven', vol: 0.4, clip: 'corvid-common-raven' }),
    bed('corvid', { id: 'redwoods-jay', name: "Steller's Jay", vol: 0.42, clip: 'corvid-stellers-jay' }),
    bed('stream', { id: 'redwoods-drip', name: 'Dripping Canopy', vol: 0.42 }),
    bed('surf', { name: 'Distant Pacific', vol: 0.3 }),
    option('owl', { name: 'Spotted Owl' }),
  ] },
  oaxaca: { extraTags: ['neotropical', 'arid', 'forest'], layers: [
    bed('songbird', { name: 'Dry-Forest Birds' }), bed('tropicalBird', { name: 'Emerald Toucanet', clip: 'legacy-toucan' }),
    bed('insects', { name: 'Cicadas' }), bed('market', { name: 'Zócalo Market', vol: 0.3 }),
    bed('bells', { name: 'Santo Domingo Bells' }), option('frogs', { name: 'Valley Frogs' }),
  ] },
  // ---- Europe ----
  // A romantic Paris: a French café musette drifting over a terrace murmur, the
  // Seine lapping its quays, the bells of Notre-Dame, sparrows in the Tuileries
  // and a soft boulevard hum. Every layer carries a BESPOKE id so it gets its
  // own pinned illustration plate (see extendedFixedIcons) — no shared art —
  // and a pinned clip so the mix is deterministic. The generic global-market /
  // global-bells / global-jazz ids are gone (they collided on one market plate).
  paris: { extraTags: ['european', 'mediterranean', 'urban', 'garden'], layers: [
    // Accordion / bells are signature but piercing — keep them soft in the bed.
    bed('musette', { id: 'paris-musette', name: 'Musette Accordion', vol: 0.08, clip: 'musette-duet' }),
    bed('market', { id: 'paris-cafe', name: 'Café Terrace', vol: 0.24, clip: 'market-crowd' }),
    bed('bells', { id: 'paris-bells', name: 'Notre-Dame Bells', vol: 0.15, clip: 'bells-4-church' }),
    bed('songbird', { id: 'paris-sparrows', name: 'Tuileries Sparrows', vol: 0.42, clip: 'songbird-house-sparrow' }),
    bed('cityHum', { id: 'paris-cityhum', name: 'Boulevard Hum', vol: 0.2, clip: 'city-pedestrian' }),
    // Seine stays in the dock so it is one drag away, not auto-playing under the mix.
    option('stream', { id: 'paris-seine', name: 'Seine Quay', vol: 0.3, clip: 'stream-flow' }),
  ] },
  swissalps: { extraTags: ['alpine', 'mountain'], layers: [
    bed('stream', { name: 'Snowmelt Stream', vol: 0.46 }), bed('wind', { name: 'Alpine Wind' }),
    bed('bells', { name: 'Cowbells', vol: 0.32 }), bed('songbird', { name: 'Meadow Birds' }),
    bed('forest', { name: 'Pine Slopes' }),
  ] },
  lisbon: { extraTags: ['european', 'mediterranean', 'coastal', 'urban', 'garden'], layers: [
    // Tram 28 rattle+bell, a fado guitar bed, summer swifts pinned to the Apus
    // apus recording, and the Sé cathedral bells drifting over the Alfama.
    bed('tram', { name: 'Tram 28' }),
    bed('fado', { name: 'Fado' }),
    bed('songbird', { name: 'Summer Swifts', vol: 0.42, clip: 'songbird-common-swift' }),
    bed('bells', { name: 'Sé Cathedral Bells', vol: 0.3 }),
  ] },
  istanbul: { extraTags: ['european', 'mediterranean', 'coastal', 'urban', 'asian'], layers: [
    // ~6 layers: a quiet, respectful adhan; Bosphorus gulls (pinned to a distinct
    // European gull); the Grand Bazaar; ubiquitous courtyard laughing doves; a
    // drifting Turkish taksim; Bosphorus water.
    bed('adhan', { name: 'Adhan' }),
    bed('seabird', { name: 'Bosphorus Gulls', vol: 0.4, clip: 'herring-gull-2' }),
    // Pin the covered-market bed so the SE-Asian Cebu night market (now eligible
    // because this recipe carries an `asian` tag) can't disperse onto the Bazaar.
    bed('market', { name: 'Grand Bazaar', vol: 0.3, clip: 'market-covered-1' }),
    bed('songbird', { name: 'Courtyard Doves', vol: 0.4, clip: 'laughing-dove-1' }),
    bed('ney', { name: 'Turkish Taksim' }),
    bed('surf', { name: 'Bosphorus Waterside', vol: 0.32 }),
  ] },
  // ---- Africa ----
  serengeti: { extraTags: ['savanna', 'arid', 'african'], layers: [
    // Open-plains mix: a distant elephant trumpet (calmer signature than the
    // old lion roar), Hadada Ibis + Ring-necked Dove pinned to savanna species,
    // grassland insects, tall-grass wind, and vervets. Lion stays in the dock.
    bed('elephant', { name: 'Distant Elephant', vol: 0.2, clip: 'elephant-trumpet-1' }),
    bed('tropicalBird', { name: 'Hadada Ibis', vol: 0.4, clip: 'tropical-bird-hadada-ibis' }),
    bed('songbird', { name: 'Ring-necked Dove', vol: 0.42, clip: 'songbird-cape-turtle-dove' }),
    bed('insects', { name: 'Grassland Insects', clip: 'insects-field-cricket' }),
    bed('wind', { name: 'Savanna Wind', clip: 'wind-tall-grass' }),
    bed('primates', { name: 'Vervets', vol: 0.28 }),
    option('lion', { name: 'Distant Lion Roar', vol: 0.22 }),
    option('owl', { name: 'Pearl-spotted Owlet', clip: 'owl-pearl-spotted-owlet' }),
  ] },
  capetown: { extraTags: ['coastal', 'savanna'], layers: [
    bed('seabird', { name: 'Cape Gulls' }), bed('songbird', { name: 'Robin-Chats' }),
    bed('surf', { name: 'Atlantic Surf', vol: 0.38 }), bed('wind', { name: 'Cape Wind' }),
    bed('insects', { name: 'Fynbos Insects' }),
  ] },
  // ---- Asia / Pacific ----
  // Kyoto: every layer is pinned to a Japanese-native clip + a bespoke plate
  // (see extendedFixedIcons) so the mix stops resolving to Tibetan bowls,
  // generic nocturnal insects, SE-Asian bulbuls, and Haeckel frog plates.
  kyoto: { extraTags: ['forest', 'garden'], layers: [
    bed('bells', { id: 'kyoto-bells', name: 'Temple Bells', vol: 0.34, clip: 'bells-gong-temple' }),
    bed('songbird', { id: 'kyoto-uguisu', name: 'Bush Warbler', vol: 0.5, clip: 'songbird-japanese-bush-warbler-2' }),
    bed('insects', { id: 'kyoto-higurashi', name: 'Higurashi Cicadas', vol: 0.22, clip: 'insects-higurashi-cicada' }),
    bed('stream', { id: 'kyoto-stream', name: 'Garden Stream', vol: 0.44, clip: 'stream-flow' }),
    bed('corvid', { id: 'kyoto-crows', name: 'Jungle Crows', vol: 0.46, clip: 'corvid-large-billed-crow' }),
    option('frogs', { id: 'kyoto-frogs', name: 'Kajika Frogs', vol: 0.3, clip: 'frogs-kajika' }),
  ] },
  queenstown: { extraTags: ['nz', 'pacific', 'alpine', 'mountain', 'cold'], layers: [
    // Pin the NZ Bellbird so the new Pacific-tagged Australian Magpie (added to
    // the shared songbird pool for Sydney) can't disperse onto this NZ pin.
    bed('wind', { name: 'Southern Alps Wind' }), bed('songbird', { name: 'Rifleman & Rock Wren', clip: 'legacy-bellbird' }),
    bed('stream', { name: 'Lakeshore Lapping', vol: 0.44 }), bed('forest', { name: 'Beech Forest' }),
    // Pin the genuine ruru/morepork call (Ninox) so it can't resolve to an
    // unrelated pygmy-owl clip.
    option('owl', { name: 'Morepork', clip: 'owl-morepork-ruru' }),
  ] },
  bariloche: { extraTags: ['neotropical', 'mountain'], layers: [
    bed('stream', { name: 'Mountain Stream', vol: 0.46 }), bed('wind', { name: 'Patagonian Wind' }),
    bed('songbird', { name: 'Andean Birds', clip: 'songbird-rufous-collared-sparrow' }), bed('forest', { name: 'Andean Forest' }),
    option('corvid', { name: 'Corvids' }),
  ] },
  himalayas: { extraTags: ['mountain', 'cold'], layers: [
    bed('wind', { name: 'High Wind' }), bed('stream', { name: 'Snowmelt Stream', vol: 0.46 }),
    bed('bells', { name: 'Prayer Bells' }), bed('corvid', { name: 'Himalayan Crows' }),
    bed('songbird', { name: 'Mountain Birds' }),
  ] },
  sydney: { extraTags: ['australia', 'coastal', 'garden'], layers: [
    bed('kookaburra', { name: 'Kookaburra', vol: 0.5 }),
    // Australian Magpie carol, pinned to the sourced Pacific/Australia clip
    // (routed through the deep songbird pool). Replaces the generic "Bush Birds".
    bed('songbird', { name: 'Australian Magpie', vol: 0.42, clip: 'songbird-australian-magpie' }),
    // Bespoke id so Sydney cicadas can keep a cicada plate (not the cricket default).
    bed('insects', { id: 'sydney-cicadas', name: 'Cicadas', vol: 0.22, clip: 'insects-cicadas' }),
    // Pin a cleaner beach/surf bed instead of the Adriatic `legacy-surf`.
    bed('surf', { name: 'Harbour Surf', vol: 0.38, clip: 'waves-beach-sea' }),
    // Pin the harbour-tagged gull clip.
    bed('seabird', { name: 'Silver Gulls', vol: 0.4, clip: 'seabird-gulls-harbour' }),
    // Side-dock options to add by hand (rain, breeze, bush, city, night owl).
    option('rain', { name: 'Harbour Rain', vol: 0.38 }),
    option('wind', { name: 'Harbour Breeze', vol: 0.3 }),
    option('forest', { name: 'Bush Reserve', vol: 0.4 }),
    option('cityHum', { name: 'City Hum', vol: 0.2 }),
    option('owl', { name: 'Night Owl', vol: 0.32 }),
  ] },
  bali: { extraTags: ['tropical', 'coastal', 'rainforest'], layers: [
    bed('tropicalBird', { name: 'Rice-Field Birds' }), bed('frogs', { name: 'Paddy Frogs' }),
    bed('insects', { name: 'Jungle Insects' }), bed('surf', { name: 'Reef Surf', vol: 0.36 }),
    bed('primates', { name: 'Macaques', vol: 0.28 }),
  ] },
  lapland: { extraTags: ['boreal', 'cold'], layers: [
    bed('wind', { name: 'Arctic Wind' }), bed('forest', { name: 'Taiga Forest' }),
    bed('stream', { name: 'Snowmelt Brook', vol: 0.44 }), bed('corvid', { name: 'Ravens' }),
    bed('songbird', { name: 'Boreal Birds' }),
  ] },
};

type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * Rough local time-of-day from longitude (no timezone database needed). Used
 * only to BIAS variant selection (e.g. nocturnal insects, owls at night) and to
 * offer weather/owl layers, never to change which beds structurally exist, so a
 * place stays deterministic in its layer set regardless of when it is searched.
 */
function timeOfDayFor(lng: number, date: Date): TimeOfDay {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const local = ((utcHours + lng / 15) % 24 + 24) % 24;
  if (local >= 5 && local < 8) return 'dawn';
  if (local >= 8 && local < 17) return 'day';
  if (local >= 17 && local < 20) return 'dusk';
  return 'night';
}

/**
 * Resolved place signals the layered recipe reasons over. `urban`, `nearWater`
 * and `coastal` fold in the major-city table hints so a big city that OSM tags
 * vaguely (e.g. "Hanoi") still gets its street bed and lakeside water.
 */
type RecipeContext = {
  traits: Traits;
  culture: CultureProfile;
  city?: MajorCity;
  tod: TimeOfDay;
  urban: boolean;
  tropical: boolean;
  warm: boolean;
  nearWater: boolean;
  coastal: boolean;
};

/** Beds we demote to options first when a scene overshoots the audible cap. */
const BED_DEMOTION_ORDER = [
  'global-market',
  'global-insects',
  'global-street-birds',
  'global-frogs',
];
const MAX_BEDS = 7;

/**
 * Layered recipe for an arbitrary searched place (not a curated pin). Builds
 * 5-7 audible beds from the place's biome + culture profile:
 *   1. base ambient bed (busy street / city hum / forest / dry wind),
 *   2. geo / water layer (surf / mountain stream / riverside),
 *   3. one or two region-appropriate birds,
 *   4. insects / frogs where the climate warrants,
 *   5. one or two human / cultural beds (worship + market for cities),
 *   6. optional weather + owl (offered, never defaulted).
 *
 * Region correctness is enforced downstream by the seeded picker's region
 * gating: a scene tagged e.g. `asian` only ever resolves an in-region or
 * region-neutral clip, so a tropical/Asian city can no longer pull a temperate
 * European songbird or a wrong-continent street. Here we additionally ROUTE the
 * bird layer by culture: warm South/Southeast-Asian cities pin the koel + myna
 * pair when those clips exist, and only non-tropical places default the generic
 * temperate songbird.
 */
function buildLayeredRecipe(ctx: RecipeContext): LayerSpec[] {
  const { traits, culture, tod, urban, tropical, warm, nearWater, coastal } = ctx;
  const layers: LayerSpec[] = [];

  // 1. BASE BED.
  if (urban) {
    if (culture.street === 'busy') {
      // Route through the region-tagged traffic pool (Manila jeepney swarm /
      // Lagos bus park), the right texture for dense developing-world streets.
      layers.push(bed('streetTraffic', { vol: 0.24 }));
    } else {
      layers.push(bed('cityHum', { vol: 0.22 }));
    }
  } else if (traits.arid) {
    layers.push(bed('wind', { name: 'Dry Wind' }));
  } else if (tropical && traits.forest) {
    layers.push(bed('forest', { name: 'Rainforest Canopy', vol: 0.44 }));
  } else {
    layers.push(bed('forest'));
  }

  // 2. GEO / WATER.
  if (coastal) {
    layers.push(bed('surf'));
    if (!urban) layers.push(option('seabird'));
    else layers.push(bed('seabird', { vol: 0.38 }));
  } else if (traits.mountain || (traits.climate === 'cold' && !traits.arid)) {
    layers.push(bed('stream', { name: 'Mountain Stream', vol: 0.46 }));
  } else if (nearWater) {
    layers.push(bed('stream', { name: urban ? 'Riverside Water' : 'Stream', vol: urban ? 0.34 : 0.44 }));
  }

  // 3. BIRDS, culture-routed so tropical/Asian cities never get a temperate
  // songbird. The koel + myna pins degrade gracefully to any in-region
  // tropical-bird / songbird when those specific clips have not been sourced.
  if (culture.birds === 'tropical-asian') {
    layers.push(bed('tropicalBird', { name: 'Asian Koel', vol: 0.48, clip: 'tropical-bird-asian-koel' }));
    layers.push(bed('songbird', { id: 'global-street-birds', name: 'Myna & Sparrows', vol: 0.42, clip: 'songbird-common-myna' }));
  } else if (tropical) {
    layers.push(bed('tropicalBird', { vol: 0.48 }));
    if (traits.forest) layers.push(option('primates'));
    if (urban) layers.push(bed('songbird', { id: 'global-street-birds', name: 'Street Birds', vol: 0.42 }));
  } else {
    layers.push(bed('songbird', { vol: 0.5 }));
    if (urban) layers.push(option('corvid'));
  }

  // 4. INSECTS / AMPHIBIANS.
  if (warm && !traits.arid) {
    if (tropical) layers.push(bed('insects', { name: 'Warm-Night Insects', vol: 0.2 }));
    else if (!urban) layers.push(bed('insects', { vol: 0.18 }));
    else layers.push(option('insects'));
  }
  if (tropical && (traits.riverine || traits.forest || nearWater)) {
    layers.push(option('frogs'));
  }

  // 5. HUMAN / CULTURAL (cities only). Worship bed + a market bed.
  if (urban) {
    if (culture.worship === 'adhan') {
      layers.push(bed('adhan', { vol: 0.28 }));
    } else if (culture.worship === 'temple') {
      layers.push(bed('bells', { name: 'Temple Bell', vol: 0.32 }));
    } else if (culture.worship === 'church') {
      layers.push(bed('bells', { name: 'Church Bells', vol: 0.3 }));
    }
    layers.push(bed('market', { vol: 0.26 }));
    // Available in every big-city library (not auto-played — a subway rumble
    // under the default mix reads as noisy) so places like Manhattan, London
    // or Tokyo can drag in a metro platform as their own choice.
    layers.push(option('subway'));
  }

  // 6. WEATHER + OWL, offered in the library, off by default.
  layers.push(option('rain', { name: tropical ? 'Monsoon Rain' : 'Rain' }));
  if (!traits.arid && (tod === 'night' || tod === 'dusk') && (traits.forest || traits.mountain || !urban)) {
    layers.push(option('owl'));
  }

  return capBeds(layers);
}

/**
 * Keep the audible palette to a sane maximum by demoting the least essential
 * beds to library-only options when a scene would otherwise overshoot. Order is
 * deterministic (fixed priority list, not RNG) so a place stays stable.
 */
function capBeds(layers: LayerSpec[]): LayerSpec[] {
  const bedCount = () => layers.filter((l) => l.bed).length;
  for (const id of BED_DEMOTION_ORDER) {
    if (bedCount() <= MAX_BEDS) break;
    const layer = layers.find((l) => l.bed && l.id === id);
    if (layer) layer.bed = false;
  }
  return layers;
}

export function buildProceduralRegion(info: ProceduralLocationInfo): Region {
  const traits = inferTraits(info);
  const slug = info.placeId
    ? `place-${info.placeId}`
    : `geo-${info.lat.toFixed(3)}_${info.lng.toFixed(3)}`;
  const regionId = `procedural-${slug}`;
  const seed = regionId;

  // Phase 1 signals: the country -> culture profile and the major-city table.
  const cc = info.geocode?.countryCode;
  const culture = getCultureProfile(cc, traits.regionTag);
  const city = matchMajorCity(
    info.name,
    info.lat,
    info.lng,
    cc,
    info.geocode?.type ?? info.geocode?.addresstype,
  );
  const tod = timeOfDayFor(info.lng, new Date());

  const urban = traits.urban || !!city;
  const coastal = traits.coastal || !!city?.coastal;
  const nearWater = coastal || traits.riverine || !!city?.water;
  const tropical = traits.climate === 'tropical';
  const warm = traits.climate !== 'cold';

  const habitatTags: VariantTag[] = [traits.climate, traits.regionTag];
  if (coastal) habitatTags.push('coastal');
  if (traits.mountain) habitatTags.push('mountain', 'alpine');
  if (traits.forest) habitatTags.push('forest', 'woodland');
  if (urban) habitatTags.push('urban');
  if (traits.climate === 'cold') habitatTags.push('cold');
  if (traits.climate === 'temperate') habitatTags.push('temperate');
  if (culture.tags) habitatTags.push(...culture.tags);
  if (city?.tags) habitatTags.push(...city.tags);

  const recipe = curatedRecipeFor(info.name);
  const layers = recipe
    ? recipe.layers
    : buildLayeredRecipe({ traits, culture, city, tod, urban, tropical, warm, nearWater, coastal });
  const tags = [
    ...new Set(recipe?.extraTags ? [...habitatTags, ...recipe.extraTags] : habitatTags),
  ];

  // De-dupe by id (a preset can only appear once per scene).
  const seenIds = new Set<string>();
  const sounds: SoundDef[] = [];
  const bedSounds: BedSound[] = [];
  for (const layer of layers) {
    if (seenIds.has(layer.id)) continue;
    seenIds.add(layer.id);
    sounds.push({
      id: layer.id,
      name: layer.name,
      category: layer.category,
      type: layer.type,
      fixedClipId: layer.fixedClipId,
      variantTags: tags,
      src: '',
      loop: true,
      keywords: layer.keywords,
    });
    if (layer.bed) {
      bedSounds.push({ soundId: layer.id, volume: layer.volume });
    }
  }

  return {
    id: regionId,
    name: info.name,
    sounds,
    bedSounds,
    seed,
    tags,
    procedural: true,
  };
}

/** Build, register, and return ids for a searched location's bespoke scene. */
export function resolveProceduralSoundscape(info: ProceduralLocationInfo): {
  environmentId: string;
  regionId: string;
} {
  const region = buildProceduralRegion(info);
  registerProceduralRegion(region);
  return { environmentId: PROCEDURAL_ENVIRONMENT_ID, regionId: region.id };
}

export type { Rng };
