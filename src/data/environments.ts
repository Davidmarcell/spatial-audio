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
        bedSounds: [
          { soundId: 'tui', volume: 0.72, position: { x: -0.3, y: 0.62 } },
          { soundId: 'wind', volume: 0.48, position: { x: 0.34, y: 0.4 } },
        ],
        sounds: [
          {
            id: 'tui',
            name: 'Tui',
            category: 'bird',
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
            src: '/audio/nz/fantail-loop.ogg',
            loop: true,
            description: 'Cheerful fantail chatter in suburban gardens',
            keywords: ['bird', 'fantail', 'piwakawaka', 'songbird', 'garden'],
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
            name: 'Auckland Rain',
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
      {
        id: 'nz-forest-general',
        name: 'North Island Forest',
        tags: ['pacific', 'nz', 'forest', 'woodland', 'temperate', 'native'],
        bedSounds: [
          { soundId: 'bellbird', volume: 0.62, position: { x: -0.28, y: 0.58 } },
          { soundId: 'forest-ambience', volume: 0.48, position: { x: 0.32, y: 0.42 } },
          { soundId: 'wind-forest', volume: 0.5, position: { x: -0.18, y: 0.38 } },
          { soundId: 'bush-stream', volume: 0.44, position: { x: 0.24, y: 0.7 } },
        ],
        sounds: [
          {
            id: 'bellbird',
            name: 'Bellbird',
            category: 'bird',
            src: '/audio/nz/bellbird-loop.ogg',
            loop: true,
            description: 'Bell-like calls echoing through native bush',
            keywords: ['bird', 'bellbird', 'songbird', 'native'],
          },
          {
            id: 'fantail',
            name: 'Fantail',
            category: 'bird',
            src: '/audio/nz/fantail-loop.ogg',
            loop: true,
            description: 'Piwakawaka flitting through understory',
            keywords: ['bird', 'fantail', 'songbird', 'native'],
          },
          {
            id: 'tui-forest',
            name: 'Tui',
            category: 'bird',
            src: '/audio/nz/tui-loop.ogg',
            loop: true,
            description: 'Tui song high in the canopy',
            keywords: ['bird', 'tui', 'songbird', 'native'],
          },
          {
            id: 'morepork-forest',
            name: 'Morepork',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            loop: true,
            description: 'Ruru calling after dusk',
            keywords: ['owl', 'night', 'morepork', 'bird', 'nocturnal'],
          },
          {
            id: 'forest-ambience',
            name: 'Forest Floor',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
            description: 'Leaf litter and quiet understory',
            keywords: ['forest', 'woods', 'rustle', 'nature', 'trees'],
          },
          {
            id: 'wind-forest',
            name: 'Canopy Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
            description: 'Wind through tall native trees',
            keywords: ['wind', 'breeze', 'forest', 'canopy'],
          },
          {
            id: 'forest-rain',
            name: 'Forest Rain',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Rain dripping through dense canopy',
            keywords: ['rain', 'storm', 'forest', 'weather', 'shower'],
          },
          {
            id: 'bush-stream',
            name: 'Bush Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Mountain stream in native forest',
            keywords: ['stream', 'water', 'brook', 'creek', 'river'],
          },
          {
            id: 'coastal-surf',
            name: 'Distant Surf',
            category: 'water',
            src: '/audio/nz/surf-loop.ogg',
            loop: true,
            description: 'Far-off ocean surf beyond the hills',
            keywords: ['surf', 'ocean', 'waves', 'coast', 'water'],
          },
          {
            id: 'forest-gull',
            name: 'Coastal Gull',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
            description: 'Gulls near forested coastline',
            keywords: ['gull', 'bird', 'coast', 'seagull'],
          },
          {
            id: 'dusk-insects',
            name: 'Dusk Insects',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Evening insect chorus at forest edge',
            keywords: ['insects', 'crickets', 'cicadas', 'evening', 'night'],
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
        bedSounds: [
          { soundId: 'copacabana-surf', volume: 0.65, position: { x: 0.32, y: 0.58 } },
          { soundId: 'tropical-insects', volume: 0.2, position: { x: -0.28, y: 0.44 } },
        ],
        sounds: [
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
        name: 'Bedford-Stuyvesant, Brooklyn',
        tags: ['americas', 'urban', 'temperate', 'garden'],
        migratoryBirds: true,
        defaultSeason: 'spring',
        bedSounds: [
          { soundId: 'gray-catbird', volume: 0.52, position: { x: -0.28, y: 0.52 } },
          { soundId: 'park-rustle', volume: 0.4, position: { x: 0.32, y: 0.46 } },
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
        bedSounds: [
          { soundId: 'blackbird', volume: 0.58, position: { x: -0.26, y: 0.54 } },
          { soundId: 'london-rain', volume: 0.42, position: { x: 0.3, y: 0.42 } },
          { soundId: 'street-jazz-busker', volume: 0.32, position: { x: -0.12, y: 0.78 } },
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
    id: 'alpine-europe',
    name: 'Alpine Europe',
    regions: [
      {
        id: 'dolomites',
        name: 'Dolomites, Italy',
        tags: ['european', 'alpine', 'mountain', 'cold'],
        bedSounds: [
          { soundId: 'alpine-wind', volume: 0.55, position: { x: -0.22, y: 0.6 } },
          { soundId: 'mountain-stream', volume: 0.5, position: { x: 0.34, y: 0.38 } },
        ],
        sounds: [
          {
            id: 'alpine-wind',
            name: 'Alpine Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
            description: 'Cold wind across high passes',
            keywords: ['wind', 'breeze', 'alpine', 'mountain', 'weather'],
          },
          {
            id: 'mountain-stream',
            name: 'Mountain Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Snowmelt stream in the valley',
            keywords: ['stream', 'water', 'mountain', 'brook', 'river'],
          },
          {
            id: 'forest-valley',
            name: 'Valley Forest',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
            description: 'Larch and pine forest below the peaks',
            keywords: ['forest', 'valley', 'trees', 'nature', 'woods'],
          },
          {
            id: 'alpine-bird',
            name: 'Alpine Bird',
            category: 'bird',
            src: '/audio/nz/bellbird-loop.ogg',
            loop: true,
            description: 'Mountain bird song at timberline',
            keywords: ['bird', 'alpine', 'songbird', 'wildlife'],
          },
          {
            id: 'alpine-rain',
            name: 'Mountain Rain',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Rain sweeping through alpine meadows',
            keywords: ['rain', 'storm', 'mountain', 'weather', 'shower'],
          },
          {
            id: 'dolomites-insects',
            name: 'Meadow Insects',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Summer insects in alpine meadows',
            keywords: ['insects', 'meadow', 'summer', 'crickets'],
          },
          {
            id: 'dolomites-owl',
            name: 'Night Owl',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            loop: true,
            description: 'Owl calls in mountain valleys',
            keywords: ['owl', 'night', 'bird', 'nocturnal'],
          },
          {
            id: 'dolomites-gull',
            name: 'Highland Bird',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
            description: 'Bird calls over alpine lakes',
            keywords: ['bird', 'wildlife', 'alpine', 'lake'],
          },
          {
            id: 'dolomites-surf',
            name: 'Distant Thunder',
            category: 'ambient',
            src: '/audio/nz/surf-loop.ogg',
            loop: true,
            description: 'Rolling echo of storm over ridgelines',
            keywords: ['thunder', 'storm', 'weather', 'distant'],
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
        id: 'chiang-mai',
        name: 'Chiang Mai, Thailand',
        tags: ['asian', 'tropical', 'forest'],
        bedSounds: [
          { soundId: 'jungle-insects', volume: 0.2, position: { x: -0.3, y: 0.52 } },
          { soundId: 'hill-bird', volume: 0.55, position: { x: 0.28, y: 0.64 } },
        ],
        sounds: [
          {
            id: 'jungle-insects',
            name: 'Jungle Insects',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Dense insect chorus in humid hills',
            keywords: ['insects', 'jungle', 'crickets', 'tropical', 'night'],
          },
          {
            id: 'hill-bird',
            name: 'Hill Forest Bird',
            category: 'bird',
            src: '/audio/costa-rica/quetzal-song.ogg',
            loop: true,
            description: 'Forest bird song on Doi Suthep slopes',
            keywords: ['bird', 'forest', 'songbird', 'wildlife'],
          },
          {
            id: 'monsoon-rain',
            name: 'Monsoon Rain',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Heavy monsoon rain on tropical canopy',
            keywords: ['rain', 'monsoon', 'storm', 'tropical', 'weather'],
          },
          {
            id: 'forest-stream',
            name: 'Forest Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Stream tumbling through hill forest',
            keywords: ['stream', 'water', 'forest', 'brook', 'jungle'],
          },
          {
            id: 'tropical-bird',
            name: 'Tropical Bird',
            category: 'bird',
            src: '/audio/costa-rica/toucan-call.ogg',
            loop: true,
            description: 'Colourful tropical bird calls',
            keywords: ['bird', 'tropical', 'toucan', 'wildlife', 'jungle'],
          },
          {
            id: 'temple-wind',
            name: 'Temple Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
            description: 'Breeze through temple grounds and hills',
            keywords: ['wind', 'breeze', 'temple', 'hill', 'weather'],
          },
          {
            id: 'chiang-mai-forest',
            name: 'Bamboo Forest',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
            description: 'Rustling bamboo and forest floor',
            keywords: ['forest', 'bamboo', 'rustle', 'nature', 'jungle'],
          },
          {
            id: 'chiang-mai-primates',
            name: 'Jungle Primates',
            category: 'bird',
            src: '/audio/costa-rica/howler-distant.mp3',
            loop: true,
            description: 'Distant primate calls in the canopy',
            keywords: ['monkey', 'primate', 'jungle', 'wildlife'],
          },
          {
            id: 'chiang-mai-owl',
            name: 'Night Owl',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            loop: true,
            description: 'Owl calls over quiet hill villages',
            keywords: ['owl', 'night', 'bird', 'nocturnal'],
          },
          {
            id: 'chiang-mai-gull',
            name: 'Open Country Bird',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
            description: 'Bird calls over rice paddies and fields',
            keywords: ['bird', 'field', 'wildlife', 'countryside'],
          },
        ],
      },
    ],
  },
  {
    id: 'costa-rica-rainforest',
    name: 'Costa Rican Rainforest',
    regions: [
      {
        id: 'pacific-slope',
        name: 'Pacific Slope Rainforest',
        tags: ['americas', 'tropical', 'rainforest', 'forest'],
        bedSounds: [
          { soundId: 'howler', volume: 0.65, position: { x: -0.3, y: 0.55 } },
          { soundId: 'insects', volume: 0.2, position: { x: 0.26, y: 0.62 } },
          { soundId: 'rain', volume: 0.45, position: { x: 0.32, y: 0.4 } },
          { soundId: 'stream', volume: 0.48, position: { x: -0.22, y: 0.72 } },
        ],
        sounds: [
          {
            id: 'howler',
            name: 'Howler Monkey',
            category: 'bird',
            src: '/audio/costa-rica/howler-distant.mp3',
            loop: true,
            description: 'Distant howler monkeys in the canopy',
            keywords: ['monkey', 'howler', 'primate', 'jungle', 'wildlife'],
          },
          {
            id: 'toucan',
            name: 'Toucan',
            category: 'bird',
            src: '/audio/costa-rica/toucan-call.ogg',
            loop: true,
            description: 'Toucan calls through the rainforest',
            keywords: ['bird', 'toucan', 'tropical', 'wildlife'],
          },
          {
            id: 'quetzal',
            name: 'Resplendent Quetzal',
            category: 'bird',
            src: '/audio/costa-rica/quetzal-song.ogg',
            loop: true,
            description: 'Quetzal song in cloud forest',
            keywords: ['bird', 'quetzal', 'songbird', 'wildlife', 'cloud forest'],
          },
          {
            id: 'insects',
            name: 'Insect Chorus',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
            description: 'Wall of tropical insect sound',
            keywords: ['insects', 'crickets', 'cicadas', 'tropical', 'night'],
          },
          {
            id: 'rain',
            name: 'Rain on Canopy',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
            description: 'Rain drumming on dense canopy',
            keywords: ['rain', 'storm', 'canopy', 'weather', 'shower'],
          },
          {
            id: 'stream',
            name: 'Forest Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
            description: 'Mountain stream through primary forest',
            keywords: ['stream', 'water', 'forest', 'brook', 'river'],
          },
          {
            id: 'canopy-wind',
            name: 'Canopy Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
            description: 'Wind through emergent canopy trees',
            keywords: ['wind', 'breeze', 'canopy', 'forest', 'weather'],
          },
          {
            id: 'forest-floor',
            name: 'Forest Floor',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
            description: 'Understory rustle and forest ambience',
            keywords: ['forest', 'floor', 'rustle', 'understory', 'nature'],
          },
          {
            id: 'coastal-bird',
            name: 'Coastal Bird',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
            description: 'Seabird near Pacific slope coastline',
            keywords: ['bird', 'gull', 'coast', 'seabird'],
          },
          {
            id: 'night-owl-rainforest',
            name: 'Night Owl',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            loop: true,
            description: 'Nocturnal owl in the rainforest',
            keywords: ['owl', 'night', 'bird', 'nocturnal'],
          },
          {
            id: 'pacific-surf',
            name: 'Pacific Surf',
            category: 'water',
            src: '/audio/nz/surf-loop.ogg',
            loop: true,
            description: 'Pacific breakers below the cloud forest',
            keywords: ['surf', 'ocean', 'waves', 'pacific', 'beach', 'water'],
          },
          {
            id: 'understory-bird',
            name: 'Understory Bird',
            category: 'bird',
            src: '/audio/nz/tui-loop.ogg',
            loop: true,
            description: 'Melodic bird in forest margins',
            keywords: ['bird', 'songbird', 'forest', 'wildlife', 'understory'],
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
