import type { Environment, BedSound, ActiveSound } from './types';

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
          },
          {
            id: 'morepork',
            name: 'Morepork',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            loop: true,
          },
          {
            id: 'surf',
            name: 'Beach Surf',
            category: 'water',
            src: '/audio/nz/surf-loop.ogg',
            loop: true,
          },
          {
            id: 'wind',
            name: 'Coastal Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
          },
          {
            id: 'gull',
            name: 'Seagull',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
          },
        ],
      },
      {
        id: 'nz-forest-general',
        name: 'North Island Forest',
        sounds: [
          {
            id: 'bellbird',
            name: 'Bellbird',
            category: 'bird',
            src: '/audio/nz/bellbird-loop.ogg',
            loop: true,
          },
          {
            id: 'fantail',
            name: 'Fantail',
            category: 'bird',
            src: '/audio/nz/fantail-loop.ogg',
            loop: true,
          },
          {
            id: 'forest-ambience',
            name: 'Forest Floor',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
          },
          {
            id: 'wind-forest',
            name: 'Canopy Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
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
        bedSounds: [
          { soundId: 'copacabana-surf', volume: 0.65, position: { x: 0.32, y: 0.58 } },
          { soundId: 'tropical-insects', volume: 0.45, position: { x: -0.28, y: 0.44 } },
        ],
        sounds: [
          {
            id: 'copacabana-surf',
            name: 'Atlantic Surf',
            category: 'water',
            src: '/audio/nz/surf-loop.ogg',
            loop: true,
          },
          {
            id: 'atlantic-wind',
            name: 'Coastal Breeze',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
          },
          {
            id: 'seabird',
            name: 'Seabird',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
          },
          {
            id: 'tropical-insects',
            name: 'Tropical Insects',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
          },
          {
            id: 'city-hum',
            name: 'Distant City',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
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
          },
          {
            id: 'northern-cardinal',
            name: 'Northern Cardinal',
            category: 'bird',
            src: '/audio/bed-stuy/northern-cardinal.ogg',
            loop: true,
          },
          {
            id: 'blue-jay',
            name: 'Blue Jay',
            category: 'bird',
            src: '/audio/bed-stuy/blue-jay.ogg',
            loop: true,
          },
          {
            id: 'park-rustle',
            name: 'Park Rustle',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
          },
          {
            id: 'urban-breeze',
            name: 'Urban Breeze',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
          },
          {
            id: 'distant-traffic',
            name: 'Distant Traffic',
            category: 'ambient',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
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
        bedSounds: [
          { soundId: 'blackbird', volume: 0.58, position: { x: -0.26, y: 0.54 } },
          { soundId: 'london-rain', volume: 0.42, position: { x: 0.3, y: 0.42 } },
        ],
        sounds: [
          {
            id: 'blackbird',
            name: 'Common Blackbird',
            category: 'bird',
            src: '/audio/nz/fantail-loop.ogg',
            loop: true,
          },
          {
            id: 'herring-gull',
            name: 'Herring Gull',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            loop: true,
          },
          {
            id: 'london-rain',
            name: 'Rain on Rooftops',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
          },
          {
            id: 'thames-breeze',
            name: 'River Breeze',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            loop: true,
          },
          {
            id: 'park-ambience',
            name: 'Park Ambience',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
          },
          {
            id: 'distant-city',
            name: 'Distant City',
            category: 'ambient',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
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
          },
          {
            id: 'mountain-stream',
            name: 'Mountain Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
          },
          {
            id: 'forest-valley',
            name: 'Valley Forest',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            loop: true,
          },
          {
            id: 'alpine-bird',
            name: 'Alpine Bird',
            category: 'bird',
            src: '/audio/nz/bellbird-loop.ogg',
            loop: true,
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
        bedSounds: [
          { soundId: 'jungle-insects', volume: 0.62, position: { x: -0.3, y: 0.52 } },
          { soundId: 'hill-bird', volume: 0.55, position: { x: 0.28, y: 0.64 } },
        ],
        sounds: [
          {
            id: 'jungle-insects',
            name: 'Jungle Insects',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
          },
          {
            id: 'hill-bird',
            name: 'Hill Forest Bird',
            category: 'bird',
            src: '/audio/costa-rica/quetzal-song.ogg',
            loop: true,
          },
          {
            id: 'monsoon-rain',
            name: 'Monsoon Rain',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
          },
          {
            id: 'forest-stream',
            name: 'Forest Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
          },
          {
            id: 'tropical-bird',
            name: 'Tropical Bird',
            category: 'bird',
            src: '/audio/costa-rica/toucan-call.ogg',
            loop: true,
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
        sounds: [
          {
            id: 'howler',
            name: 'Howler Monkey',
            category: 'bird',
            src: '/audio/costa-rica/howler-distant.mp3',
            loop: true,
          },
          {
            id: 'toucan',
            name: 'Toucan',
            category: 'bird',
            src: '/audio/costa-rica/toucan-call.ogg',
            loop: true,
          },
          {
            id: 'quetzal',
            name: 'Resplendent Quetzal',
            category: 'bird',
            src: '/audio/costa-rica/quetzal-song.ogg',
            loop: true,
          },
          {
            id: 'insects',
            name: 'Insect Chorus',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            loop: true,
          },
          {
            id: 'rain',
            name: 'Rain on Canopy',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            loop: true,
          },
          {
            id: 'stream',
            name: 'Forest Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            loop: true,
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

export function getEnvironment(id: string) {
  return environments.find((env) => env.id === id);
}

export function getRegion(environmentId: string, regionId: string) {
  return getEnvironment(environmentId)?.regions.find((region) => region.id === regionId);
}

export function getSoundDef(environmentId: string, regionId: string, soundId: string) {
  return getRegion(environmentId, regionId)?.sounds.find((sound) => sound.id === soundId);
}
