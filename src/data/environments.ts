import { globalAmbientLibrary } from './globalAmbientLibrary';
import type {
  Environment,
  BedSound,
  ActiveSound,
  Region,
  SoundDef,
  VariantTag,
} from './types';

export function defaultInstanceId(soundId: string) {
  return `default:${soundId}`;
}

export function isDefaultInstance(instanceId: string) {
  return instanceId.startsWith('default:');
}

export function createDefaultActiveSounds(bedSounds: BedSound[]): ActiveSound[] {
  return bedSounds.map((item) => ({
    instanceId: defaultInstanceId(item.soundId),
    soundId: item.soundId,
    position: item.position ?? { x: 0.28, y: 0.72 },
    volume: item.volume,
  }));
}

export const environments: Environment[] = [
  {
    id: 'nz-forest',
    name: 'New Zealand Forest',
    regions: [
      {
        id: 'auckland',
        name: 'Auckland, New Zealand',
        tags: ['pacific', 'nz', 'coastal', 'temperate', 'native'],
        // Native default palette: Tui, Fantail (Pīwakawaka), Kererū and summer
        // cicadas. Coastal wind / surf / rain stay in the library to add by
        // hand — they are not force-defaulted here.
        bedSounds: [
          { soundId: 'tui', volume: 0.62, position: { x: -0.3, y: 0.62 } },
          { soundId: 'fantail', volume: 0.5, position: { x: 0.32, y: 0.5 } },
          { soundId: 'kereru', volume: 0.44, position: { x: -0.14, y: 0.4 } },
          { soundId: 'summer-cicadas', volume: 0.2, position: { x: 0.24, y: 0.72 } },
        ],
        sounds: [
          {
            id: 'tui',
            name: 'Tui',
            category: 'bird',
            type: 'songbird',
            fixedClipId: 'legacy-tui',
            src: '/audio/nz/tui-loop.ogg',
            loop: true,
            description: 'Iconic NZ songbird with rich melodic calls',
            keywords: ['bird', 'tui', 'songbird', 'native', 'wildlife'],
          },
          {
            id: 'morepork',
            name: 'Morepork',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            loop: true,
            description: 'Night owl calls over the city fringe',
            keywords: ['owl', 'night', 'morepork', 'ruru', 'bird', 'nocturnal'],
          },
          {
            id: 'bellbird',
            name: 'Bellbird',
            category: 'bird',
            src: '/audio/nz/bellbird-loop.ogg',
            loop: true,
            description: 'Clear bell-like notes from bush reserves',
            keywords: ['bird', 'bellbird', 'songbird', 'native', 'wildlife'],
          },
          {
            id: 'fantail',
            name: 'Fantail',
            category: 'bird',
            type: 'songbird',
            fixedClipId: 'legacy-bellbird',
            src: '/audio/nz/fantail-loop.ogg',
            loop: true,
            description: 'Cheerful fantail chatter in suburban gardens',
            keywords: ['bird', 'fantail', 'piwakawaka', 'songbird', 'garden'],
          },
          {
            id: 'kereru',
            name: 'Kererū',
            category: 'bird',
            type: 'songbird',
            fixedClipId: 'songbird-breeze-birds',
            src: '/audio/nz/bellbird-loop.ogg',
            loop: true,
            description: 'New Zealand wood pigeon — soft wingbeats and a low coo',
            keywords: ['kereru', 'wood pigeon', 'kūkū', 'native', 'nz', 'bird', 'songbird'],
          },
          {
            id: 'surf',
            name: 'Beach Surf',
            category: 'water',
            src: '/audio/nz/surf-loop.ogg',
            loop: true,
            description: 'Pacific surf along Auckland beaches',
            keywords: ['surf', 'ocean', 'waves', 'beach', 'water', 'coast'],
          },
          {
            id: 'wind',
            name: 'Coastal Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
            description: 'Harbour breeze across the Waitematā',
            keywords: ['wind', 'breeze', 'coast', 'harbor', 'weather'],
          },
          {
            id: 'gull',
            name: 'Seagull',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
            description: 'Red-billed gulls along the waterfront',
            keywords: ['gull', 'seagull', 'bird', 'harbor', 'coast'],
          },
          {
            id: 'domain-park',
            name: 'Domain Park',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
            description: 'Leaf rustle in Auckland Domain and city parks',
            keywords: ['park', 'forest', 'trees', 'rustle', 'garden', 'nature'],
          },
          {
            id: 'auckland-rain',
            name: 'Rain',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Rain on rooftops and umbrella weather',
            keywords: ['rain', 'shower', 'storm', 'weather', 'drizzle'],
          },
          {
            id: 'urban-creek',
            name: 'Urban Creek',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'A trickling stream in a green belt',
            keywords: ['stream', 'creek', 'water', 'brook', 'river'],
          },
          {
            id: 'summer-cicadas',
            name: 'Summer Cicadas',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Hot summer evening insect hum',
            keywords: ['cicadas', 'insects', 'summer', 'crickets', 'evening'],
          },
        ],
      },
    ],
  },
  {
    id: 'brazil-coast',
    name: 'Brazil Coast',
    regions: [
      {
        id: 'rio-de-janeiro',
        name: 'Rio de Janeiro, Brazil',
        tags: ['americas', 'tropical', 'coastal'],
        // The Rio brief: soft surf, a gentle city hum, bossa nova, a toucan and
        // quiet forest wildlife. Wind, rain, traffic and heavier primates stay
        // in the library to add by hand.
        bedSounds: [
          { soundId: 'rio-bossa-nova', volume: 0.4, position: { x: 0, y: 0.4 } },
          { soundId: 'copacabana-surf', volume: 0.32, position: { x: 0.34, y: 0.6 } },
          { soundId: 'city-hum', volume: 0.2, position: { x: -0.34, y: 0.5 } },
          { soundId: 'toucan-rio', volume: 0.48, position: { x: 0.24, y: 0.38 } },
          { soundId: 'tropical-insects', volume: 0.18, position: { x: -0.2, y: 0.72 } },
        ],
        sounds: [
          {
            id: 'rio-bossa-nova',
            name: 'Bossa Nova',
            category: 'ambient',
            type: 'bossa-nova',
            src: '',
            loop: true,
            description: 'Gentle bossa nova drifting from a beachfront bar',
            keywords: ['bossa', 'nova', 'music', 'guitar', 'brazil', 'mellow'],
          },
          {
            id: 'copacabana-surf',
            name: 'Atlantic Surf',
            category: 'water',
            src: '/audio/nz/surf-loop.ogg',
            loop: true,
            description: 'Atlantic breakers along Copacabana',
            keywords: ['surf', 'ocean', 'waves', 'beach', 'water', 'atlantic'],
          },
          {
            id: 'atlantic-wind',
            name: 'Coastal Breeze',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
            description: 'Warm sea breeze off the bay',
            keywords: ['wind', 'breeze', 'coast', 'sea', 'weather'],
          },
          {
            id: 'seabird',
            name: 'Seabird',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
            description: 'Seabirds over the shoreline',
            keywords: ['bird', 'gull', 'seabird', 'coast'],
          },
          {
            id: 'tropical-insects',
            name: 'Tropical Insects',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Humid evening insect chorus',
            keywords: ['insects', 'tropical', 'crickets', 'night', 'summer'],
          },
          {
            id: 'city-hum',
            name: 'Distant City',
            category: 'ambient',
            type: 'city-hum',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
            description: 'Muted urban ambience beyond the beach',
            keywords: ['city', 'urban', 'distant', 'ambient'],
          },
          {
            id: 'rio-rain',
            name: 'Tropical Rain',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Sudden tropical downpour',
            keywords: ['rain', 'storm', 'tropical', 'shower', 'weather'],
          },
          {
            id: 'rio-stream',
            name: 'Jungle Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Stream in nearby Atlantic forest',
            keywords: ['stream', 'water', 'jungle', 'brook', 'forest'],
          },
          {
            id: 'toucan-rio',
            name: 'Toucan',
            category: 'bird',
            src: '/audio/costa-rica/toucan-call.ogg',
            loop: true,
            description: 'Toucan call from coastal forest',
            keywords: ['bird', 'toucan', 'tropical', 'wildlife'],
          },
          {
            id: 'quetzal-rio',
            name: 'Forest Bird',
            category: 'bird',
            src: '/audio/costa-rica/quetzal-song.ogg',
            loop: true,
            description: 'Melodic bird in Atlantic forest',
            keywords: ['bird', 'songbird', 'forest', 'wildlife'],
          },
          {
            id: 'rio-traffic',
            name: 'City Traffic',
            category: 'ambient',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Traffic from Rio streets inland',
            keywords: ['traffic', 'city', 'cars', 'road', 'urban'],
          },
          {
            id: 'jungle-primates',
            name: 'Jungle Primates',
            category: 'bird',
            src: '/audio/costa-rica/howler-distant.mp3',
            loop: true,
            description: 'Distant primate calls from Tijuca forest',
            keywords: ['monkey', 'primate', 'jungle', 'wildlife'],
          },
        ],
      },
    ],
  },
  {
    id: 'urban-americas',
    name: 'Urban Americas',
    regions: [
      {
        id: 'bed-stuy',
        name: 'Brooklyn, New York',
        tags: ['americas', 'urban', 'temperate', 'garden'],
        migratoryBirds: true,
        defaultSeason: 'spring',
        // Brownstone garden default: catbird + cardinal, a blue jay, park
        // rustle and distant traffic hum. No owl or rain in the default — both
        // stay in the library.
        bedSounds: [
          { soundId: 'gray-catbird', volume: 0.5, position: { x: -0.3, y: 0.52 } },
          { soundId: 'northern-cardinal', volume: 0.48, position: { x: 0.3, y: 0.5 } },
          { soundId: 'blue-jay', volume: 0.44, position: { x: -0.12, y: 0.4 } },
          { soundId: 'park-rustle', volume: 0.4, position: { x: 0.22, y: 0.7 } },
          { soundId: 'distant-traffic', volume: 0.2, position: { x: -0.3, y: 0.76 } },
        ],
        sounds: [
          {
            id: 'gray-catbird',
            name: 'Gray Catbird',
            category: 'bird',
            src: '/audio/bed-stuy/gray-catbird.ogg',
            loop: true,
            description: 'Catbird mewing in backyard thickets',
            keywords: ['bird', 'catbird', 'songbird', 'wildlife'],
            seasons: ['spring', 'summer'],
          },
          {
            id: 'northern-cardinal',
            name: 'Northern Cardinal',
            category: 'bird',
            src: '/audio/bed-stuy/northern-cardinal.ogg',
            loop: true,
            description: 'Cardinal whistles year-round in the neighbourhood',
            keywords: ['bird', 'cardinal', 'songbird', 'wildlife'],
          },
          {
            id: 'blue-jay',
            name: 'Blue Jay',
            category: 'bird',
            src: '/audio/bed-stuy/blue-jay.ogg',
            loop: true,
            description: 'Blue jay calls from treetops and stoops',
            keywords: ['bird', 'jay', 'songbird', 'wildlife'],
          },
          {
            id: 'park-rustle',
            name: 'Park Rustle',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
            description: 'Leaves and branches in Herbert Von King Park',
            keywords: ['park', 'rustle', 'trees', 'nature', 'garden'],
          },
          {
            id: 'urban-breeze',
            name: 'Urban Breeze',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
            description: 'Wind between brownstones and avenues',
            keywords: ['wind', 'breeze', 'urban', 'weather'],
          },
          {
            id: 'distant-traffic',
            name: 'Distant Traffic',
            category: 'ambient',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Bedford Avenue traffic in the distance',
            keywords: ['traffic', 'road', 'cars', 'city', 'urban', 'street'],
          },
          {
            id: 'brooklyn-rain',
            name: 'Brooklyn Rain',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Rain on brownstone roofs and fire escapes',
            keywords: ['rain', 'storm', 'shower', 'weather'],
          },
          {
            id: 'park-stream',
            name: 'Park Fountain',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Trickling water in a community garden',
            keywords: ['water', 'fountain', 'stream', 'brook', 'park'],
          },
          {
            id: 'evening-crickets',
            name: 'Evening Crickets',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Summer cricket chorus after sunset',
            keywords: ['crickets', 'insects', 'evening', 'summer', 'night'],
            seasons: ['summer'],
          },
          {
            id: 'night-owl-brooklyn',
            name: 'Night Owl',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            loop: true,
            description: 'Owl hoots over quiet blocks',
            keywords: ['owl', 'night', 'bird', 'nocturnal'],
          },
          {
            id: 'street-bird',
            name: 'Street Sparrow',
            category: 'bird',
            src: '/audio/nz/fantail-loop.ogg',
            loop: true,
            description: 'Small birds along sidewalk hedges',
            keywords: ['bird', 'sparrow', 'songbird', 'street'],
          },
        ],
      },
    ],
  },
  {
    id: 'urban-europe',
    name: 'Urban Europe',
    regions: [
      {
        id: 'london',
        name: 'London, United Kingdom',
        tags: ['european', 'urban', 'temperate'],
        // London default: blackbird song, Thames gulls, a pavement jazz busker,
        // Hyde Park rustle and a low city hum. Rain, owl and nightingale stay in
        // the library rather than auto-playing.
        bedSounds: [
          { soundId: 'blackbird', volume: 0.52, position: { x: -0.3, y: 0.54 } },
          { soundId: 'herring-gull', volume: 0.4, position: { x: 0.32, y: 0.5 } },
          { soundId: 'street-jazz-busker', volume: 0.34, position: { x: -0.1, y: 0.4 } },
          { soundId: 'park-ambience', volume: 0.4, position: { x: 0.24, y: 0.72 } },
          { soundId: 'distant-city', volume: 0.2, position: { x: -0.3, y: 0.76 } },
        ],
        sounds: [
          {
            id: 'blackbird',
            name: 'Common Blackbird',
            category: 'bird',
            src: '/audio/nz/fantail-loop.ogg',
            loop: true,
            description: 'Blackbird song at dawn in city parks',
            keywords: ['bird', 'blackbird', 'songbird', 'dawn', 'wildlife'],
          },
          {
            id: 'herring-gull',
            name: 'Herring Gull',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
            description: 'Gulls along the Thames embankment',
            keywords: ['gull', 'seagull', 'bird', 'river', 'thames'],
          },
          {
            id: 'london-rain',
            name: 'Rain on Rooftops',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Classic London drizzle on slate roofs',
            keywords: ['rain', 'drizzle', 'shower', 'weather', 'storm'],
          },
          {
            id: 'thames-breeze',
            name: 'River Breeze',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
            description: 'Wind off the Thames through the city',
            keywords: ['wind', 'breeze', 'river', 'thames', 'weather'],
          },
          {
            id: 'park-ambience',
            name: 'Park Ambience',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
            description: 'Hyde Park trees and leaf rustle',
            keywords: ['park', 'trees', 'rustle', 'garden', 'nature'],
          },
          {
            id: 'distant-city',
            name: 'Distant City',
            category: 'ambient',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Low urban hum beyond the square',
            keywords: ['city', 'urban', 'traffic', 'distant', 'ambient'],
          },
          {
            id: 'thames-stream',
            name: 'Thames Water',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Gentle river flow along the embankment',
            keywords: ['river', 'thames', 'water', 'stream', 'flow'],
          },
          {
            id: 'evening-insects',
            name: 'Evening Insects',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Warm evening insect chorus in gardens',
            keywords: ['insects', 'crickets', 'evening', 'summer', 'garden'],
          },
          {
            id: 'nightingale',
            name: 'Garden Warbler',
            category: 'bird',
            src: '/audio/nz/bellbird-loop.ogg',
            loop: true,
            description: 'Sweet warbler notes in suburban gardens',
            keywords: ['bird', 'warbler', 'songbird', 'garden', 'wildlife'],
          },
          {
            id: 'london-night-owl',
            name: 'Tawny Owl',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            loop: true,
            description: 'Owl calls over moonlit rooftops',
            keywords: ['owl', 'night', 'bird', 'nocturnal'],
          },
          {
            id: 'street-jazz-busker',
            name: 'Street Jazz Busker',
            category: 'ambient',
            src: '/audio/london/street-jazz-busker.mp3',
            loop: true,
            type: 'jazz',
            description: 'A loose jazz trio drifting up from the pavement',
            keywords: ['jazz', 'music', 'busker', 'street', 'guitar', 'saxophone', 'urban'],
          },
          {
            id: 'london-traffic',
            name: 'Street Traffic',
            category: 'ambient',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Buses and cars on nearby streets',
            keywords: ['traffic', 'cars', 'bus', 'road', 'street', 'urban'],
          },
        ],
      },
    ],
  },
  {
    id: 'southeast-asia',
    name: 'Southeast Asia',
    regions: [
      {
        id: 'bangkok',
        name: 'Bangkok, Thailand',
        tags: ['asian', 'tropical', 'urban'],
        // Bangkok brief: a tropical city on the Chao Phraya. Wat temple bells,
        // street-market bustle, the koel calling over the rooftops, the river
        // with its ferries and a low city-traffic hum. Monsoon rain and warm
        // evening insects stay in the library to add by hand.
        bedSounds: [
          { soundId: 'bangkok-temple-bells', volume: 0.34, position: { x: 0, y: 0.4 } },
          { soundId: 'bangkok-market', volume: 0.3, position: { x: -0.3, y: 0.5 } },
          { soundId: 'bangkok-koel', volume: 0.5, position: { x: 0.3, y: 0.44 } },
          { soundId: 'bangkok-river', volume: 0.42, position: { x: -0.22, y: 0.76 } },
          { soundId: 'bangkok-traffic', volume: 0.2, position: { x: 0.24, y: 0.72 } },
        ],
        sounds: [
          {
            id: 'bangkok-temple-bells',
            name: 'Temple Bells',
            category: 'ambient',
            type: 'bells',
            src: '',
            loop: true,
            description: 'Bronze bells and gongs drifting from a riverside wat',
            keywords: ['bells', 'temple', 'gong', 'wat', 'buddhist'],
          },
          {
            id: 'bangkok-market',
            name: 'Street Market',
            category: 'ambient',
            type: 'market',
            src: '',
            loop: true,
            description: 'Chatter and clatter of a Bangkok street market',
            keywords: ['market', 'crowd', 'street', 'bustle', 'stalls'],
          },
          {
            id: 'bangkok-koel',
            name: 'Asian Koel',
            category: 'bird',
            type: 'tropical-bird',
            src: '/audio/costa-rica/toucan-call.ogg',
            loop: true,
            description: 'A tropical koel calling over the rooftops',
            keywords: ['bird', 'koel', 'tropical', 'city', 'cuckoo'],
          },
          {
            id: 'bangkok-river',
            name: 'Chao Phraya River',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Wash of the river as ferries and longtail boats pass',
            keywords: ['river', 'water', 'ferry', 'boat', 'chao phraya'],
          },
          {
            id: 'bangkok-traffic',
            name: 'City Traffic',
            category: 'ambient',
            type: 'traffic',
            // Manila jeepney ride — closest openly-licensed SE-Asian street bed
            // (tuk-tuk / scooter texture) until a Bangkok-specific clip lands.
            fixedClipId: 'traffic-manila-jeepney',
            src: '',
            loop: true,
            description: 'Tuk-tuks and traffic humming through the city',
            keywords: ['traffic', 'city', 'tuk-tuk', 'urban', 'street'],
          },
          {
            id: 'bangkok-monsoon-rain',
            name: 'Monsoon Rain',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Warm monsoon rain over the city',
            keywords: ['rain', 'monsoon', 'storm', 'tropical', 'weather'],
          },
          {
            id: 'bangkok-insects',
            name: 'Warm-Night Insects',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Humid evening insect chorus between the canals',
            keywords: ['insects', 'crickets', 'cicadas', 'evening', 'tropical'],
          },
        ],
      },
    ],
  },
];

export type AppLocation = {
  id: string;
  name: string;
  environmentId: string;
  regionId: string;
};

export const appLocations: AppLocation[] = environments.flatMap((env) =>
  env.regions.map((region) => ({
    id: `${env.id}:${region.id}`,
    name: region.name,
    environmentId: env.id,
    regionId: region.id,
  })),
);

/**
 * Runtime-registered procedural regions (assembled from arbitrary searched
 * locations). Kept in a registry so getRegion/getSoundDef resolve them exactly
 * like curated regions without bloating the static catalog.
 */
export const PROCEDURAL_ENVIRONMENT_ID = 'procedural';
const proceduralRegions = new Map<string, Region>();

export function registerProceduralRegion(region: Region): void {
  proceduralRegions.set(region.id, region);
}

export function getEnvironment(id: string) {
  return environments.find((env) => env.id === id);
}

export function getRegion(environmentId: string, regionId: string) {
  const curated = getEnvironment(environmentId)?.regions.find(
    (region) => region.id === regionId,
  );
  if (curated) return curated;
  return proceduralRegions.get(regionId);
}

export function getSoundDef(environmentId: string, regionId: string, soundId: string) {
  const regional = getRegion(environmentId, regionId)?.sounds.find(
    (sound) => sound.id === soundId,
  );
  if (regional) return regional;
  return globalAmbientLibrary.find((sound) => sound.id === soundId);
}

/**
 * Climate restrictions for cross-region global sounds. Tropical-only species
 * (jungle primates, tropical birds) must never surface in temperate/cold
 * scenes; warm-climate ambiences (cicada/cricket chorus) are kept out of cold
 * scenes. Generic ambiences (wind, rain, surf, stream, traffic, jazz) carry no
 * restriction and remain available everywhere for free-form scene building.
 */
const GLOBAL_SOUND_CLIMATE: Record<string, 'tropical' | 'warm'> = {
  'global-tropical-bird': 'tropical',
  'global-jungle-primates': 'tropical',
  'global-insects': 'warm',
};

function regionClimateClass(tags: VariantTag[] = []): 'tropical' | 'cold' | 'temperate' {
  if (tags.includes('tropical')) return 'tropical';
  if (tags.includes('cold')) return 'cold';
  return 'temperate';
}

function isGlobalSoundAllowed(soundId: string, climate: 'tropical' | 'cold' | 'temperate'): boolean {
  const requirement = GLOBAL_SOUND_CLIMATE[soundId];
  if (!requirement) return true;
  if (requirement === 'tropical') return climate === 'tropical';
  // 'warm' — anything that is not cold.
  return climate !== 'cold';
}

/**
 * Region sound library = regional sounds + cross-region global ambiences.
 * When `regionTags` are supplied, climate-inappropriate global sounds (e.g.
 * tropical primates in an alpine scene) are filtered out of the appended
 * globals. Without tags the full library is returned (used by share/restore
 * validation, which must accept any previously-saved sound id).
 */
export function getRegionSoundCatalog(
  regionSounds: SoundDef[],
  regionTags?: VariantTag[],
): SoundDef[] {
  const seen = new Set(regionSounds.map((sound) => sound.id));
  let extras = globalAmbientLibrary.filter((sound) => !seen.has(sound.id));
  if (regionTags) {
    const climate = regionClimateClass(regionTags);
    extras = extras.filter((sound) => isGlobalSoundAllowed(sound.id, climate));
  }
  return [...regionSounds, ...extras];
}
