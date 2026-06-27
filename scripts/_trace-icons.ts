import { buildProceduralRegion } from '../src/utils/proceduralSoundscape';
import { getSoundArtworkForRegion } from '../src/data/iconArt';

function trace(label: string, info: Parameters<typeof buildProceduralRegion>[0]) {
  const region = buildProceduralRegion(info);
  const ids = region.sounds.map((s) => s.id);
  console.log(`\n=== ${label} ===`);
  console.log('tags:', region.tags?.join(', '));
  for (const s of region.sounds) {
    const art = getSoundArtworkForRegion(region.id, ids, s.id, undefined, region.tags);
    console.log(`  ${s.name.padEnd(16)} [${s.id}] -> ${art.title} — ${art.author}`);
  }
}

trace('Havana (coastal city)', {
  name: 'Havana',
  lat: 23.1136,
  lng: -82.3666,
  geocode: { countryCode: 'cu', displayName: 'Havana, Cuba (harbour, coast)', class: 'place', type: 'city' },
});

trace('Havana (no coastal keyword)', {
  name: 'Havana',
  lat: 23.1136,
  lng: -82.3666,
  geocode: { countryCode: 'cu', displayName: 'Havana, Cuba', class: 'place', type: 'city' },
});

trace('Banff (cold mountain town)', {
  name: 'Banff',
  lat: 51.1784,
  lng: -115.5708,
  geocode: { countryCode: 'ca', displayName: 'Banff, Alberta (mountain, forest)', class: 'place', type: 'town' },
});

trace('London (temperate city)', {
  name: 'London',
  lat: 51.5072,
  lng: -0.1276,
  geocode: { countryCode: 'gb', displayName: 'London, England', class: 'place', type: 'city' },
});

// NZ fixed-species behaviour: morepork/tui plates only inside NZ regions.
const nzIds = ['morepork-forest', 'tui-forest', 'coastal-surf', 'forest-rain'];
console.log('\n=== NZ region (auckland) fixed species plates ===');
for (const id of nzIds) {
  const art = getSoundArtworkForRegion('auckland', nzIds, id, undefined, [
    'pacific', 'nz', 'forest', 'temperate', 'native',
  ]);
  console.log(`  ${id.padEnd(16)} -> ${art.title} — ${art.author}`);
}
