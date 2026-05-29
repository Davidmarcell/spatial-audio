import type { Environment, BedSound, ActiveSound } from './types';

export const MAX_ACTIVE_SOUNDS = 6;

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
    position: item.position ?? { x: 0, y: 0.15 },
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
          { soundId: 'tui', volume: 0.72, position: { x: -0.22, y: 0.18 } },
          { soundId: 'wind', volume: 0.48, position: { x: 0.18, y: 0.14 } },
        ],
        sounds: [
          {
            id: 'tui',
            name: 'Tui',
            category: 'bird',
            src: '/audio/nz/tui-loop.ogg',
            icon: '🐦',
            loop: true,
          },
          {
            id: 'morepork',
            name: 'Morepork',
            category: 'bird',
            src: '/audio/nz/morepork-call.ogg',
            icon: '🦉',
            loop: true,
          },
          {
            id: 'surf',
            name: 'Beach Surf',
            category: 'water',
            src: '/audio/nz/surf-loop.ogg',
            icon: '🌊',
            loop: true,
          },
          {
            id: 'wind',
            name: 'Coastal Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            icon: '💨',
            loop: true,
          },
          {
            id: 'gull',
            name: 'Seagull',
            category: 'bird',
            src: '/audio/nz/gull-call.ogg',
            icon: '🕊️',
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
            icon: '🔔',
            loop: true,
          },
          {
            id: 'fantail',
            name: 'Fantail',
            category: 'bird',
            src: '/audio/nz/fantail-loop.ogg',
            icon: '🪶',
            loop: true,
          },
          {
            id: 'forest-ambience',
            name: 'Forest Floor',
            category: 'ambient',
            src: '/audio/nz/forest-ambience.mp3',
            icon: '🌲',
            loop: true,
          },
          {
            id: 'wind-forest',
            name: 'Canopy Wind',
            category: 'ambient',
            src: '/audio/nz/wind-loop.mp3',
            icon: '🍃',
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
            icon: '🐒',
            loop: true,
          },
          {
            id: 'toucan',
            name: 'Toucan',
            category: 'bird',
            src: '/audio/costa-rica/toucan-call.ogg',
            icon: '🦜',
            loop: true,
          },
          {
            id: 'quetzal',
            name: 'Resplendent Quetzal',
            category: 'bird',
            src: '/audio/costa-rica/quetzal-song.ogg',
            icon: '🦚',
            loop: true,
          },
          {
            id: 'insects',
            name: 'Insect Chorus',
            category: 'insect',
            src: '/audio/costa-rica/insect-chorus.mp3',
            icon: '🦗',
            loop: true,
          },
          {
            id: 'rain',
            name: 'Rain on Canopy',
            category: 'ambient',
            src: '/audio/costa-rica/rain-canopy.mp3',
            icon: '🌧️',
            loop: true,
          },
          {
            id: 'stream',
            name: 'Forest Stream',
            category: 'water',
            src: '/audio/costa-rica/stream-distant.mp3',
            icon: '💧',
            loop: true,
          },
        ],
      },
    ],
  },
];

export function getEnvironment(id: string) {
  return environments.find((env) => env.id === id);
}

export function getRegion(environmentId: string, regionId: string) {
  return getEnvironment(environmentId)?.regions.find((region) => region.id === regionId);
}

export function getSoundDef(environmentId: string, regionId: string, soundId: string) {
  return getRegion(environmentId, regionId)?.sounds.find((sound) => sound.id === soundId);
}
