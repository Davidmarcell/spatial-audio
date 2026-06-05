export type GlobeStyleId =
  | 'light'
  | 'outline'
  | 'day'
  | 'topo'
  | 'night'
  | 'night-lights';

export type GlobeStyle = {
  id: GlobeStyleId;
  label: string;
  description: string;
  globeImage: string | null;
  bumpImage: string;
  atmosphereColor: string;
  atmosphereAltitude: number;
  graticule: boolean;
  hostBackground: string;
  useLightMaterial: boolean;
  materialColor?: string;
};

const CDN = 'https://unpkg.com/three-globe/example/img';
const BUMP = `${CDN}/earth-topology.png`;

/** All globe texture URLs — shareable via ?globe=<id> in the app URL. */
export const globeTextureUrls = {
  blueMarble: `${CDN}/earth-blue-marble.jpg`,
  day: `${CDN}/earth-day.jpg`,
  dark: `${CDN}/earth-dark.jpg`,
  night: `${CDN}/earth-night.jpg`,
  topology: `${CDN}/earth-topology.png`,
  water: `${CDN}/earth-water.png`,
} as const;

export const globeStyles: GlobeStyle[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Soft blue marble with warm glow and subtle coastlines.',
    globeImage: globeTextureUrls.blueMarble,
    bumpImage: BUMP,
    atmosphereColor: 'rgba(255, 252, 248, 0.78)',
    atmosphereAltitude: 0.2,
    graticule: true,
    hostBackground:
      'radial-gradient(circle at 50% 42%, #f8f6f2 0%, #ebe8e2 55%, #ddd8cf 100%)',
    useLightMaterial: false,
  },
  {
    id: 'outline',
    label: 'Outline',
    description: 'Parchment globe with terrain emboss — minimal and easy to read.',
    globeImage: null,
    bumpImage: BUMP,
    atmosphereColor: 'rgba(255, 255, 255, 0.55)',
    atmosphereAltitude: 0.16,
    graticule: true,
    hostBackground: '#ffffff',
    useLightMaterial: true,
    materialColor: '#f5f3ef',
  },
  {
    id: 'day',
    label: 'Day',
    description: 'Crisp daytime satellite — coastlines and land pop clearly.',
    globeImage: globeTextureUrls.day,
    bumpImage: BUMP,
    atmosphereColor: 'rgba(255, 255, 255, 0.72)',
    atmosphereAltitude: 0.2,
    graticule: false,
    hostBackground:
      'radial-gradient(circle at 50% 42%, #eef4fb 0%, #dce8f4 55%, #c8d8ea 100%)',
    useLightMaterial: false,
  },
  {
    id: 'topo',
    label: 'Topo',
    description: 'Terrain contour lines on white — like a paper relief map.',
    globeImage: globeTextureUrls.topology,
    bumpImage: BUMP,
    atmosphereColor: 'rgba(255, 255, 255, 0.45)',
    atmosphereAltitude: 0.12,
    graticule: true,
    hostBackground: '#ffffff',
    useLightMaterial: true,
    materialColor: '#ffffff',
  },
  {
    id: 'night',
    label: 'Night',
    description: 'Dark oceans like Radio Garden — pins pop against the globe.',
    globeImage: globeTextureUrls.dark,
    bumpImage: BUMP,
    atmosphereColor: 'rgba(17, 17, 17, 0.25)',
    atmosphereAltitude: 0.18,
    graticule: false,
    hostBackground: 'radial-gradient(circle at 50% 40%, #2a2d32 0%, #14161a 100%)',
    useLightMaterial: false,
  },
  {
    id: 'night-lights',
    label: 'City lights',
    description: 'Earth at night — glowing cities against deep oceans.',
    globeImage: globeTextureUrls.night,
    bumpImage: BUMP,
    atmosphereColor: 'rgba(120, 160, 255, 0.28)',
    atmosphereAltitude: 0.2,
    graticule: false,
    hostBackground: 'radial-gradient(circle at 50% 38%, #1a2030 0%, #060810 100%)',
    useLightMaterial: false,
  },
];

const styleIds = new Set(globeStyles.map((style) => style.id));

export function isGlobeStyleId(value: string): value is GlobeStyleId {
  return styleIds.has(value as GlobeStyleId);
}

export function getGlobeStyle(id: GlobeStyleId) {
  return globeStyles.find((style) => style.id === id) ?? globeStyles[0];
}

export function readGlobeStyleFromUrl(): GlobeStyleId {
  if (typeof window === 'undefined') return 'light';
  const param = new URLSearchParams(window.location.search).get('globe');
  if (param && isGlobeStyleId(param)) return param;
  return 'light';
}

export function writeGlobeStyleToUrl(id: GlobeStyleId) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (id === 'light') {
    url.searchParams.delete('globe');
  } else {
    url.searchParams.set('globe', id);
  }
  window.history.replaceState(null, '', url);
}

export function buildGlobeShareUrl(id: GlobeStyleId) {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.delete('globe');
  if (id !== 'light') url.searchParams.set('globe', id);
  return url.toString();
}
