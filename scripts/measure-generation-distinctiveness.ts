/**
 * Measures how distinct generated soundscapes actually are from one another.
 *
 * The generator's job is to make a searched place sound like itself. The failure
 * mode is silent: every scene is individually plausible, but they are all the
 * same shape, and you only notice by searching two cities in a row. This turns
 * that into a number so changes to the composer can be judged rather than
 * eyeballed.
 *
 * Metrics
 *  - layer distinctiveness: mean pairwise Jaccard distance between scenes' bed
 *    layer sets (1.0 = no two cities share a bed, 0.0 = every city identical)
 *  - clip distinctiveness: same, but over the concrete clips actually cast
 *  - collision groups: sets of cities whose bed skeletons are byte-identical
 *
 * Usage: npx tsx scripts/measure-generation-distinctiveness.ts
 */
import { getCultureProfile } from '../src/data/cultureProfiles';
import { matchMajorCity } from '../src/data/majorCities';
import { buildProceduralRegion } from '../src/utils/proceduralSoundscape';
import {
  composeScene,
  latitudeBandFor,
  seasonFor,
  type PlaceSignals,
} from '../src/utils/sceneComposer';
import { regionSeed, selectSceneVariants } from '../src/utils/soundscapeSelection';
import { enrichSounds } from '../src/utils/soundTypeInference';

type Sample = {
  name: string;
  lat: number;
  lng: number;
  cc: string;
  /** OSM place type, as Photon would return it. */
  type: string;
};

/**
 * A deliberately varied world sample: dense metros, small towns, islands,
 * mountains, deserts, and places whose character is famously specific (Venice's
 * canals, Reykjavík's wind, Varanasi's ghats).
 */
const SAMPLE: Sample[] = [
  { name: 'Manhattan', lat: 40.7831, lng: -73.9712, cc: 'us', type: 'borough' },
  { name: 'New Orleans', lat: 29.9511, lng: -90.0715, cc: 'us', type: 'city' },
  { name: 'Denver', lat: 39.7392, lng: -104.9903, cc: 'us', type: 'city' },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, cc: 'us', type: 'city' },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832, cc: 'ca', type: 'city' },
  { name: 'Mexico City', lat: 19.4326, lng: -99.1332, cc: 'mx', type: 'city' },
  { name: 'Havana', lat: 23.1136, lng: -82.3666, cc: 'cu', type: 'city' },
  { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729, cc: 'br', type: 'city' },
  { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816, cc: 'ar', type: 'city' },
  { name: 'Cusco', lat: -13.5319, lng: -71.9675, cc: 'pe', type: 'city' },
  { name: 'Ushuaia', lat: -54.8019, lng: -68.3029, cc: 'ar', type: 'city' },
  { name: 'Reykjavik', lat: 64.1466, lng: -21.9426, cc: 'is', type: 'city' },
  { name: 'Bergen', lat: 60.3913, lng: 5.3221, cc: 'no', type: 'city' },
  { name: 'Edinburgh', lat: 55.9533, lng: -3.1883, cc: 'gb', type: 'city' },
  { name: 'Dublin', lat: 53.3498, lng: -6.2603, cc: 'ie', type: 'city' },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, cc: 'fr', type: 'city' },
  { name: 'Berlin', lat: 52.52, lng: 13.405, cc: 'de', type: 'city' },
  { name: 'Venice', lat: 45.4408, lng: 12.3155, cc: 'it', type: 'city' },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038, cc: 'es', type: 'city' },
  { name: 'Athens', lat: 37.9838, lng: 23.7275, cc: 'gr', type: 'city' },
  { name: 'Chamonix', lat: 45.9237, lng: 6.8694, cc: 'fr', type: 'village' },
  { name: 'Marrakech', lat: 31.6295, lng: -7.9811, cc: 'ma', type: 'city' },
  { name: 'Cairo', lat: 30.0444, lng: 31.2357, cc: 'eg', type: 'city' },
  { name: 'Istanbul', lat: 41.0082, lng: 28.9784, cc: 'tr', type: 'city' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, cc: 'ae', type: 'city' },
  { name: 'Lagos', lat: 6.5244, lng: 3.3792, cc: 'ng', type: 'city' },
  { name: 'Nairobi', lat: -1.2921, lng: 36.8219, cc: 'ke', type: 'city' },
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241, cc: 'za', type: 'city' },
  { name: 'Zanzibar City', lat: -6.1659, lng: 39.2026, cc: 'tz', type: 'city' },
  { name: 'Varanasi', lat: 25.3176, lng: 82.9739, cc: 'in', type: 'city' },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777, cc: 'in', type: 'city' },
  { name: 'Kathmandu', lat: 27.7172, lng: 85.324, cc: 'np', type: 'city' },
  { name: 'Bangkok', lat: 13.7563, lng: 100.5018, cc: 'th', type: 'city' },
  { name: 'Hanoi', lat: 21.0278, lng: 105.8342, cc: 'vn', type: 'city' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, cc: 'sg', type: 'city' },
  { name: 'Kyoto', lat: 35.0116, lng: 135.7681, cc: 'jp', type: 'city' },
  { name: 'Seoul', lat: 37.5665, lng: 126.978, cc: 'kr', type: 'city' },
  { name: 'Beijing', lat: 39.9042, lng: 116.4074, cc: 'cn', type: 'city' },
  { name: 'Melbourne', lat: -37.8136, lng: 144.9631, cc: 'au', type: 'city' },
  { name: 'Queenstown', lat: -45.0312, lng: 168.6626, cc: 'nz', type: 'town' },
];

type SceneShape = { name: string; beds: string[]; clips: string[] };

function buildScene(sample: Sample): SceneShape {
  const region = buildProceduralRegion({
    name: sample.name,
    lat: sample.lat,
    lng: sample.lng,
    geocode: {
      type: sample.type,
      class: 'place',
      addresstype: sample.type,
      countryCode: sample.cc,
      displayName: sample.name,
    },
  });

  const bedIds = new Set((region.bedSounds ?? []).map((bed) => bed.soundId));
  const library = enrichSounds(region.sounds, region.tags);
  const selection = selectSceneVariants(library, {
    seed: region.seed ?? regionSeed('procedural', region.id),
    salt: 0,
    sceneTags: region.tags,
  });

  const clips = [...selection.values()]
    .filter((variant) => bedIds.has(variant.soundId))
    .map((variant) => variant.clipId)
    .sort();

  return { name: sample.name, beds: [...bedIds].sort(), clips };
}

function jaccardDistance(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return 1 - intersection / union;
}

function meanPairwiseDistance(scenes: SceneShape[], pick: (s: SceneShape) => string[]): number {
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    for (let j = i + 1; j < scenes.length; j += 1) {
      total += jaccardDistance(pick(scenes[i]), pick(scenes[j]));
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}

function collisionGroups(scenes: SceneShape[], pick: (s: SceneShape) => string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const scene of scenes) {
    const key = pick(scene).join('|');
    groups.set(key, [...(groups.get(key) ?? []), scene.name]);
  }
  return [...groups.values()].filter((names) => names.length > 1).sort((a, b) => b.length - a.length);
}

const scenes = SAMPLE.map(buildScene);

const layerScore = meanPairwiseDistance(scenes, (s) => s.beds);
const clipScore = meanPairwiseDistance(scenes, (s) => s.clips);
const bedCollisions = collisionGroups(scenes, (s) => s.beds);
const clipCollisions = collisionGroups(scenes, (s) => s.clips);

const uniqueShapes = new Set(scenes.map((s) => s.beds.join('|'))).size;

console.log(`Sampled ${scenes.length} places across every inhabited continent.\n`);

console.log('── Distinctiveness (1.0 = every scene unique, 0.0 = all identical) ──');
console.log(`  layer distinctiveness : ${layerScore.toFixed(3)}`);
console.log(`  clip  distinctiveness : ${clipScore.toFixed(3)}`);
console.log(`  distinct bed shapes   : ${uniqueShapes} of ${scenes.length}\n`);

if (bedCollisions.length > 0) {
  console.log('── Places generating an IDENTICAL bed skeleton ──');
  for (const group of bedCollisions) {
    console.log(`  ${group.length}x  ${group.join(', ')}`);
  }
  console.log();
}

if (clipCollisions.length > 0) {
  console.log('── Places generating an IDENTICAL set of clips ──');
  for (const group of clipCollisions) {
    console.log(`  ${group.length}x  ${group.join(', ')}`);
  }
  console.log();
}

console.log('── Per-place beds ──');
for (const scene of scenes) {
  console.log(`  ${scene.name.padEnd(16)} ${scene.beds.map((b) => b.replace(/^global-/, '')).join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Prototype comparison: the scored composer from docs/SOUNDSCAPE_GENERATION_PLAN.md
// ─────────────────────────────────────────────────────────────────────────────

/** Same crude keyword traits the shipped generator uses, so the comparison
 *  isolates the *composer* rather than smuggling in better signals. */
function keywordTraits(sample: Sample) {
  const haystack = sample.name.toLowerCase();
  return {
    coastal: /coast|beach|bay|harbour|harbor|port|island|sea|ocean|cape|gulf|shore/.test(haystack),
    riverine: /river|lake|delta|loch|canal|creek|stream/.test(haystack),
    mountain: /mountain|peak|alp|ridge|summit|valley|highland|mont|mount|massif/.test(haystack),
    forest: /forest|wood|jungle|rainforest|park|reserve|nature|bush|grove/.test(haystack),
    arid: /desert|dune|sahara|outback|arid|steppe/.test(haystack),
  };
}

const REGION_OF: Record<string, string> = {
  us: 'americas', ca: 'americas', mx: 'americas', cu: 'americas', br: 'americas',
  ar: 'americas', pe: 'americas', is: 'european', no: 'european', gb: 'european',
  ie: 'european', fr: 'european', de: 'european', it: 'european', es: 'european',
  gr: 'european', ma: 'mena', eg: 'mena', tr: 'mena', ae: 'mena', ng: 'african',
  ke: 'african', za: 'african', tz: 'african', in: 'asian', np: 'asian',
  th: 'asian', vn: 'asian', sg: 'asian', jp: 'asian', kr: 'asian', cn: 'asian',
  au: 'pacific', nz: 'nz',
};

/** Fixed date so the snapshot is reproducible; season is a real input now. */
const REFERENCE_DATE = new Date('2026-07-15T12:00:00Z');

function signalsFor(sample: Sample): PlaceSignals {
  const traits = keywordTraits(sample);
  const regionTag = (REGION_OF[sample.cc] ?? 'european') as PlaceSignals['regionTag'];
  const city = matchMajorCity(sample.name, sample.lat, sample.lng, sample.cc, sample.type);
  const utcHours = REFERENCE_DATE.getUTCHours() + REFERENCE_DATE.getUTCMinutes() / 60;
  const localHour = ((utcHours + sample.lng / 15) % 24 + 24) % 24;
  const timeOfDay =
    localHour >= 5 && localHour < 8 ? 'dawn'
    : localHour >= 8 && localHour < 17 ? 'day'
    : localHour >= 17 && localHour < 20 ? 'dusk'
    : 'night';

  return {
    name: sample.name,
    lat: sample.lat,
    lng: sample.lng,
    countryCode: sample.cc,
    regionTag,
    culture: getCultureProfile(sample.cc, regionTag),
    band: latitudeBandFor(sample.lat),
    season: seasonFor(sample.lat, REFERENCE_DATE),
    timeOfDay,
    // Matches the shipped generator's deliberate choice: only city-scale places
    // are urban, so mountain/forest towns keep a nature-leaning scene.
    urban: /city|borough|suburb|district/.test(sample.type) || Boolean(city),
    majorCity: Boolean(city),
    coastal: traits.coastal || Boolean(city?.coastal),
    riverine: traits.riverine || Boolean(city?.water),
    mountain: traits.mountain || Boolean(city?.tags?.includes('mountain')),
    forest: traits.forest,
    arid: traits.arid || Boolean(city?.tags?.includes('arid')),
  };
}

const v2Scenes: SceneShape[] = SAMPLE.map((sample) => {
  const layers = composeScene(signalsFor(sample));
  return {
    name: sample.name,
    beds: layers.filter((l) => l.bed).map((l) => l.preset).sort(),
    clips: [],
  };
});

const v2Layer = meanPairwiseDistance(v2Scenes, (s) => s.beds);
const v2Unique = new Set(v2Scenes.map((s) => s.beds.join('|'))).size;
const v2Collisions = collisionGroups(v2Scenes, (s) => s.beds);

console.log('\n════════ PROTOTYPE: scored composer (src/utils/sceneComposer.ts) ════════');
console.log('Same crude input signals as the shipped generator — only the composition');
console.log(`differs. Reference date ${REFERENCE_DATE.toISOString().slice(0, 10)} (season is an input).\n`);
console.log(`  layer distinctiveness : ${v2Layer.toFixed(3)}   (shipped: ${layerScore.toFixed(3)})`);
console.log(`  distinct bed shapes   : ${v2Unique} of ${v2Scenes.length}   (shipped: ${uniqueShapes})\n`);

if (v2Collisions.length > 0) {
  console.log('── Remaining identical skeletons ──');
  for (const group of v2Collisions) console.log(`  ${group.length}x  ${group.join(', ')}`);
  console.log();
}

console.log('── Per-place beds (prototype) ──');
for (const scene of v2Scenes) {
  console.log(`  ${scene.name.padEnd(16)} ${scene.beds.join(', ')}`);
}
