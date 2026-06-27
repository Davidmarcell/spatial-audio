import { getSoundIconSrc, type RegionArtContext } from '../data/iconArt';
import type { ActiveSound } from '../data/types';
import type { ResolvedTheme } from './theme';

export type Rgb = { r: number; g: number; b: number };

export type PlayingBarCssVars = {
  '--playing-bar-warm': string;
  '--playing-bar-accent': string;
  '--playing-bar-mid': string;
  '--playing-bar-line': string;
};

const colorCache = new Map<string, Rgb | null>();

const FALLBACK: Record<ResolvedTheme, PlayingBarCssVars> = {
  light: {
    '--playing-bar-warm': 'rgba(225, 200, 160, 0.28)',
    '--playing-bar-accent': 'rgba(76, 175, 120, 0.38)',
    '--playing-bar-mid': 'rgba(76, 175, 120, 0.16)',
    '--playing-bar-line': 'rgba(76, 175, 120, 0.52)',
  },
  dark: {
    '--playing-bar-warm': 'rgba(40, 72, 58, 0.36)',
    '--playing-bar-accent': 'rgba(76, 175, 120, 0.44)',
    '--playing-bar-mid': 'rgba(76, 175, 120, 0.18)',
    '--playing-bar-line': 'rgba(76, 175, 120, 0.58)',
  },
};

type LocationMoodPalette = {
  warm: Rgb;
  accent: Rgb;
  mid: Rgb;
  line: Rgb;
};

const DEFAULT_LOCATION_PALETTE: LocationMoodPalette = {
  warm: { r: 210, g: 176, b: 140 },
  accent: { r: 88, g: 170, b: 130 },
  mid: { r: 102, g: 152, b: 132 },
  line: { r: 88, g: 170, b: 130 },
};

const LOCATION_PALETTE_BY_REGION: Record<string, LocationMoodPalette> = {
  'pacific-slope': {
    warm: { r: 186, g: 166, b: 126 },
    accent: { r: 50, g: 156, b: 104 },
    mid: { r: 60, g: 124, b: 96 },
    line: { r: 82, g: 186, b: 128 },
  },
  'rio-de-janeiro': {
    warm: { r: 196, g: 162, b: 120 },
    accent: { r: 64, g: 150, b: 124 },
    mid: { r: 80, g: 124, b: 132 },
    line: { r: 90, g: 190, b: 162 },
  },
  'chiang-mai': {
    warm: { r: 192, g: 162, b: 110 },
    accent: { r: 70, g: 148, b: 94 },
    mid: { r: 76, g: 116, b: 90 },
    line: { r: 102, g: 188, b: 126 },
  },
  auckland: {
    warm: { r: 198, g: 170, b: 132 },
    accent: { r: 86, g: 150, b: 124 },
    mid: { r: 88, g: 132, b: 120 },
    line: { r: 114, g: 190, b: 170 },
  },
  london: {
    warm: { r: 170, g: 162, b: 150 },
    accent: { r: 132, g: 146, b: 162 },
    mid: { r: 108, g: 122, b: 136 },
    line: { r: 168, g: 182, b: 198 },
  },
  'bed-stuy': {
    warm: { r: 168, g: 158, b: 144 },
    accent: { r: 134, g: 146, b: 164 },
    mid: { r: 110, g: 124, b: 140 },
    line: { r: 176, g: 188, b: 204 },
  },
  dolomites: {
    warm: { r: 174, g: 166, b: 154 },
    accent: { r: 104, g: 138, b: 168 },
    mid: { r: 92, g: 112, b: 148 },
    line: { r: 136, g: 168, b: 206 },
  },
  'nz-forest-general': {
    warm: { r: 192, g: 166, b: 126 },
    accent: { r: 74, g: 140, b: 116 },
    mid: { r: 82, g: 126, b: 106 },
    line: { r: 100, g: 178, b: 144 },
  },
};

function toRgba({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function warmTint({ r, g, b }: Rgb): Rgb {
  return {
    r: Math.min(255, Math.round(r * 1.08 + 18)),
    g: Math.min(255, Math.round(g * 0.96 + 8)),
    b: Math.max(0, Math.round(b * 0.72)),
  };
}

function soften({ r, g, b }: Rgb): Rgb {
  return {
    r: Math.round(r * 0.88 + 28),
    g: Math.round(g * 0.9 + 24),
    b: Math.round(b * 0.92 + 22),
  };
}

function blendColor(base: Rgb, accent: Rgb, ratio: number): Rgb {
  const clamped = Math.max(0, Math.min(1, ratio));
  return {
    r: Math.round(base.r * (1 - clamped) + accent.r * clamped),
    g: Math.round(base.g * (1 - clamped) + accent.g * clamped),
    b: Math.round(base.b * (1 - clamped) + accent.b * clamped),
  };
}

function resolveLocationPalette(regionArt: RegionArtContext): LocationMoodPalette {
  const direct = LOCATION_PALETTE_BY_REGION[regionArt.id];
  if (direct) return direct;

  const joined = `${regionArt.id} ${regionArt.soundIds.join(' ')}`.toLowerCase();
  if (/(tropical|rainforest|jungle|monsoon|quetzal|toucan)/.test(joined)) {
    return {
      warm: { r: 188, g: 160, b: 116 },
      accent: { r: 58, g: 152, b: 102 },
      mid: { r: 70, g: 122, b: 94 },
      line: { r: 94, g: 186, b: 132 },
    };
  }
  if (/(coast|surf|ocean|seabird|gull|harbor|beach|atlantic|pacific)/.test(joined)) {
    return {
      warm: { r: 172, g: 164, b: 146 },
      accent: { r: 84, g: 144, b: 168 },
      mid: { r: 84, g: 116, b: 154 },
      line: { r: 122, g: 176, b: 210 },
    };
  }
  if (/(urban|traffic|city|street|london|brooklyn|bed-stuy)/.test(joined)) {
    return {
      warm: { r: 170, g: 160, b: 150 },
      accent: { r: 132, g: 146, b: 164 },
      mid: { r: 108, g: 122, b: 138 },
      line: { r: 168, g: 182, b: 198 },
    };
  }
  if (/(alpine|mountain|dolomites)/.test(joined)) {
    return {
      warm: { r: 172, g: 164, b: 152 },
      accent: { r: 98, g: 138, b: 170 },
      mid: { r: 88, g: 112, b: 146 },
      line: { r: 128, g: 166, b: 204 },
    };
  }
  return DEFAULT_LOCATION_PALETTE;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function sampleDominantColor(image: HTMLImageElement): Rgb | null {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 120) continue;

    const brightness = (r + g + b) / 3;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    if (brightness < 22 || brightness > 238) continue;
    if (saturation < 0.07) continue;

    rSum += r;
    gSum += g;
    bSum += b;
    count += 1;
  }

  if (count === 0) {
    let fallbackCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 120) continue;
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      fallbackCount += 1;
    }
    if (fallbackCount === 0) return null;
    count = fallbackCount;
  }

  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };
}

export async function extractDominantColor(url: string): Promise<Rgb | null> {
  if (colorCache.has(url)) {
    return colorCache.get(url) ?? null;
  }

  try {
    const image = await loadImage(url);
    const color = sampleDominantColor(image);
    colorCache.set(url, color);
    return color;
  } catch {
    colorCache.set(url, null);
    return null;
  }
}

export function getActiveSceneImageUrls(
  activeSounds: ActiveSound[],
  regionArt: RegionArtContext,
  limit = 3,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const item of activeSounds) {
    const src = getSoundIconSrc(item.soundId, item.instanceId, regionArt);
    if (seen.has(src)) continue;
    seen.add(src);
    urls.push(src);
    if (urls.length >= limit) break;
  }

  return urls;
}

export function buildPlayingBarVars(
  colors: Rgb[],
  theme: ResolvedTheme,
  locationPalette: LocationMoodPalette,
): PlayingBarCssVars {
  if (colors.length === 0) {
    return FALLBACK[theme];
  }

  const warmBase = blendColor(warmTint(colors[0]), locationPalette.warm, 0.28);
  const accentBase = blendColor(colors[1] ?? colors[0], locationPalette.accent, 0.4);
  const midBase = blendColor(soften(colors[2] ?? accentBase), locationPalette.mid, 0.46);
  const lineBase = blendColor(accentBase, locationPalette.line, 0.42);

  const alpha =
    theme === 'dark'
      ? { warm: 0.54, accent: 0.58, mid: 0.22, line: 0.72 }
      : { warm: 0.44, accent: 0.52, mid: 0.2, line: 0.64 };

  return {
    '--playing-bar-warm': toRgba(warmBase, alpha.warm),
    '--playing-bar-accent': toRgba(accentBase, alpha.accent),
    '--playing-bar-mid': toRgba(midBase, alpha.mid),
    '--playing-bar-line': toRgba(lineBase, alpha.line),
  };
}

export async function extractScenePlayingBarVars(
  activeSounds: ActiveSound[],
  regionArt: RegionArtContext,
  theme: ResolvedTheme,
): Promise<PlayingBarCssVars> {
  const locationPalette = resolveLocationPalette(regionArt);
  const urls = getActiveSceneImageUrls(activeSounds, regionArt);
  if (urls.length === 0) {
    return FALLBACK[theme];
  }

  const results = await Promise.all(urls.map((url) => extractDominantColor(url)));
  const colors = results.filter((color): color is Rgb => color !== null);

  if (colors.length === 0) {
    return FALLBACK[theme];
  }

  return buildPlayingBarVars(colors, theme, locationPalette);
}
