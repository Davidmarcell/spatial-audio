#!/usr/bin/env node
/**
 * Acceptance check for the layered procedural soundscape (Phase 0 + Phase 1).
 *
 * Runs the REAL generation pipeline (buildProceduralRegion -> getRegionSoundCatalog
 * -> enrichSounds -> selectSceneVariants) for a searched "Hanoi, Vietnam" and a
 * spread of other diverse places, then asserts:
 *   - Hanoi produces a rich, region-true layered bed (busy SE-Asian street, an
 *     Asian market, an Asian bird pair, a temple bell, warm-night insects and
 *     lakeside water), and
 *   - no scene resolves a wrong-continent clip (the old tropical-bird routing
 *     bug and the European-city-hum-everywhere bug).
 *
 *   npx tsx scripts/test-hanoi-soundscape.ts            # assert (exit 1 on fail)
 *   npx tsx scripts/test-hanoi-soundscape.ts --report   # print full layer report
 */
import {
  buildProceduralRegion,
  type ProceduralLocationInfo,
} from '../src/utils/proceduralSoundscape';
import { getRegionSoundCatalog } from '../src/data/environments';
import { enrichSounds } from '../src/utils/soundTypeInference';
import { selectSceneVariants } from '../src/utils/soundscapeSelection';
import { soundClips } from '../src/data/soundClips.generated';

const REPORT = process.argv.includes('--report');

const CLIP_BY_ID = new Map(soundClips.map((c) => [c.id, c]));

/** Continent-level region tags the picker gates on (mirrors soundscapeSelection). */
const GATING_REGIONS = new Set([
  'european', 'americas', 'asian', 'african', 'pacific', 'nz', 'mena',
]);
/** Which gating regions are acceptable for a given scene continent. */
const COMPAT: Record<string, Set<string>> = {
  asian: new Set(['asian']),
  mena: new Set(['mena']),
  african: new Set(['african']),
  americas: new Set(['americas']),
  european: new Set(['european']),
  pacific: new Set(['pacific', 'nz']),
  nz: new Set(['nz', 'pacific']),
};

type ResolvedBed = { soundId: string; name: string; volume: number; clipId?: string; tags: string[] };

function resolveScene(info: ProceduralLocationInfo) {
  const region = buildProceduralRegion(info);
  const catalog = enrichSounds(
    getRegionSoundCatalog(region.sounds, region.tags),
    region.tags,
  );
  const selection = selectSceneVariants(catalog, {
    seed: region.seed ?? region.id,
    sceneTags: region.tags,
  });
  const nameById = new Map(region.sounds.map((s) => [s.id, s.name]));
  const beds: ResolvedBed[] = region.bedSounds.map((b) => {
    const v = selection.get(b.soundId);
    const clip = v ? CLIP_BY_ID.get(v.clipId) : undefined;
    return {
      soundId: b.soundId,
      name: nameById.get(b.soundId) ?? b.soundId,
      volume: b.volume,
      clipId: v?.clipId,
      tags: clip?.tags ?? [],
    };
  });
  return { region, beds };
}

/** A bed carries a wrong-continent clip if its clip's gating region conflicts. */
function wrongContinent(sceneRegion: string, bed: ResolvedBed): boolean {
  const ok = COMPAT[sceneRegion];
  if (!ok) return false;
  const clipRegions = bed.tags.filter((t) => GATING_REGIONS.has(t));
  if (clipRegions.length === 0) return false; // region-neutral is always fine
  return !clipRegions.some((r) => ok.has(r));
}

const failures: string[] = [];

function check(label: string, cond: boolean, detail: string) {
  if (!cond) failures.push(`${label}: ${detail}`);
}

// ---- Hanoi acceptance ----
const hanoi = resolveScene({
  name: 'Hanoi, Vietnam',
  lat: 21.0278,
  lng: 105.8342,
  placeId: 'test-hanoi',
  geocode: { countryCode: 'vn', displayName: 'Hanoi, Vietnam', class: 'place', type: 'city' },
});

function bedByType(beds: ResolvedBed[], predicate: (b: ResolvedBed) => boolean) {
  return beds.find(predicate);
}

const hStreet = bedByType(hanoi.beds, (b) => b.soundId === 'global-street-traffic');
const hMarket = bedByType(hanoi.beds, (b) => b.soundId === 'global-market');
const hBell = bedByType(hanoi.beds, (b) => b.soundId === 'global-bells');
const hTrop = bedByType(hanoi.beds, (b) => b.soundId === 'global-tropical-bird');
const hSong = bedByType(hanoi.beds, (b) => b.soundId === 'global-street-birds');
const hInsects = bedByType(hanoi.beds, (b) => b.soundId === 'global-insects');
const hWater = bedByType(hanoi.beds, (b) => b.soundId === 'global-stream');

check('hanoi-street', !!hStreet, 'missing SE-Asian street-traffic bed');
check('hanoi-street-region', !!hStreet && hStreet.tags.includes('asian'),
  `street clip not Asian: ${hStreet?.clipId} [${hStreet?.tags.join(',')}]`);
check('hanoi-market', !!hMarket && hMarket.tags.includes('asian'),
  `market clip not Asian: ${hMarket?.clipId} [${hMarket?.tags.join(',')}]`);
check('hanoi-bell', !!hBell && (hBell.tags.includes('asian') || hBell.tags.includes('temple')),
  `worship bell not temple/Asian: ${hBell?.clipId} [${hBell?.tags.join(',')}]`);
check('hanoi-tropical-bird', !!hTrop && hTrop.tags.includes('asian'),
  `tropical bird not Asian: ${hTrop?.clipId} [${hTrop?.tags.join(',')}]`);
check('hanoi-songbird', !!hSong && hSong.tags.includes('asian'),
  `second bird not Asian: ${hSong?.clipId} [${hSong?.tags.join(',')}]`);
check('hanoi-insects', !!hInsects, 'missing warm-night insects bed');
check('hanoi-water', !!hWater, 'missing lakeside water bed');
check('hanoi-bed-count', hanoi.beds.length >= 5 && hanoi.beds.length <= 7,
  `expected 5-7 beds, got ${hanoi.beds.length}`);
for (const b of hanoi.beds) {
  check('hanoi-no-wrong-continent', !wrongContinent('asian', b),
    `wrong-continent bed ${b.soundId} -> ${b.clipId} [${b.tags.join(',')}]`);
}

// ---- Spot-checks: no wrong-continent clips, sensible base bed ----
const spots: Array<{ info: ProceduralLocationInfo; region: string }> = [
  { region: 'mena', info: { name: 'Riyadh, Saudi Arabia', lat: 24.71, lng: 46.68, placeId: 't-ry', geocode: { countryCode: 'sa', displayName: 'Riyadh', class: 'place', type: 'city' } } },
  { region: 'americas', info: { name: 'Lima, Peru', lat: -12.05, lng: -77.04, placeId: 't-li', geocode: { countryCode: 'pe', displayName: 'Lima', class: 'place', type: 'city' } } },
  { region: 'european', info: { name: 'Lyon, France', lat: 45.76, lng: 4.84, placeId: 't-ly', geocode: { countryCode: 'fr', displayName: 'Lyon', class: 'place', type: 'city' } } },
  { region: 'african', info: { name: 'Lagos, Nigeria', lat: 6.52, lng: 3.38, placeId: 't-la', geocode: { countryCode: 'ng', displayName: 'Lagos', class: 'place', type: 'city' } } },
  { region: 'european', info: { name: 'Hallstatt, Austria', lat: 47.56, lng: 13.65, placeId: 't-ha', geocode: { countryCode: 'at', displayName: 'Hallstatt village', class: 'place', type: 'village' } } },
];

const spotResults = spots.map((s) => ({ ...s, ...resolveScene(s.info) }));
for (const s of spotResults) {
  check(`${s.info.name}-has-beds`, s.beds.length >= 2, `only ${s.beds.length} beds`);
  for (const b of s.beds) {
    check(`${s.info.name}-no-wrong-continent`, !wrongContinent(s.region, b),
      `${b.soundId} -> ${b.clipId} [${b.tags.join(',')}]`);
  }
}
// Europe must NOT get the SE-Asian street bed; rural village must not be "urban".
const lyon = spotResults.find((s) => s.info.name.startsWith('Lyon'));
check('lyon-not-busy-street', !lyon?.beds.some((b) => b.clipId === 'traffic-manila-jeepney'),
  'Lyon pulled the Manila jeepney street bed');
const hallstatt = spotResults.find((s) => s.info.name.startsWith('Hallstatt'));
check('hallstatt-rural', !hallstatt?.beds.some((b) => b.soundId === 'global-market'),
  'rural Hallstatt got an urban market bed');

// ---- Report ----
if (REPORT || failures.length > 0) {
  const dump = (label: string, beds: ResolvedBed[]) => {
    console.log(`\n${label}`);
    for (const b of beds) {
      console.log(
        `  ${b.name.padEnd(22)} vol ${b.volume.toFixed(2)}  ${b.clipId ?? '(fallback src)'} [${b.tags.join(', ')}]`,
      );
    }
  };
  dump('Hanoi, Vietnam', hanoi.beds);
  for (const s of spotResults) dump(s.info.name, s.beds);
}

if (failures.length > 0) {
  console.error(`\n\u2717 Hanoi soundscape acceptance FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n\u2713 Hanoi soundscape acceptance passed (${hanoi.beds.length} Hanoi beds, ${spots.length} spot-checks clean).`);
process.exit(0);
