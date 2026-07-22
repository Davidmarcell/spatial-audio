import { buildProceduralRegion } from '../src/utils/proceduralSoundscape';
import { getRegionSoundCatalog } from '../src/data/environments';
import { enrichSounds } from '../src/utils/soundTypeInference';
import { selectSceneVariants } from '../src/utils/soundscapeSelection';
import { getSoundIconSrc } from '../src/data/iconArt';

function trace(name: string, lat: number, lng: number, cc: string) {
  const region = buildProceduralRegion({
    name,
    lat,
    lng,
    placeId: `test-${name}`,
    geocode: { countryCode: cc, class: 'place', type: 'city', displayName: name },
  });
  const librarySounds = enrichSounds(getRegionSoundCatalog(region.sounds, region.tags), region.tags);
  const seed = region.seed;
  const selection = selectSceneVariants(librarySounds, { seed, sceneTags: region.tags });
  const regionArt = { id: region.id, soundIds: librarySounds.map((s) => s.id), tags: region.tags };
  console.log(`\n=== ${name} (${cc}) tags=[${region.tags.join(',')}] ===`);
  console.log(`beds: ${region.bedSounds.map((b) => b.soundId).join(', ')}`);
  for (const s of region.sounds) {
    const bed = region.bedSounds.some((b) => b.soundId === s.id) ? 'BED ' : 'opt ';
    const img = getSoundIconSrc(s.id, `${seed}:${s.id}`, regionArt);
    const v = selection.get(s.id);
    console.log(`  ${bed}${s.id.padEnd(24)} type=${String(s.type).padEnd(14)} name="${s.name}"  img=${img}  clip=${v?.clipId ?? '-'}`);
  }
}

trace('Berlin', 52.52, 13.41, 'de');
trace('Marrakech', 31.63, -7.99, 'ma');
trace('Bangkok', 13.75, 100.5, 'th');
trace('Istanbul', 41.01, 28.98, 'tr');
trace('Bogota', 4.71, -74.07, 'co');
trace('Rome', 41.9, 12.5, 'it');
