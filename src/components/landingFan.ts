/**
 * Live-tunable fan layout for the landing card row. The tiles lay out as a
 * symmetric "hand of cards" arc; every tile's resting transform is derived from
 * its normalised distance from the centre of the row (`offset` in −1 … +1):
 *   • rotation = offset × endRotationDeg  (progressive, centred near upright)
 *   • arc drop = offset² × arcDepthPx     (parabola, outer tiles sit lower)
 *   • scale    = 1 − |offset| × scaleFalloff (optional edge shrink)
 *   • overlap  = negative margin between neighbours (deck-style layering)
 * The values are adjusted live via the dev-only fan controls panel and can be
 * persisted as the landing default (see `saveLandingFanConfigDefault`).
 *
 * Kept in its own module (not `LandingGate.tsx`) so the component file only
 * exports React components and Fast Refresh / HMR stays intact.
 */
export type FanConfig = {
  /** Rotation of the outermost tiles, in degrees (spread / end rotation). */
  endRotationDeg: number;
  /** Vertical drop of the outermost tiles vs. the centre, in px (arch depth). */
  arcDepthPx: number;
  /** Horizontal overlap between neighbours, in rem (applied as negative margin). */
  overlapRem: number;
  /** Fractional scale reduction at the edges (0 = no falloff). */
  scaleFalloff: number;
};

export type FanPreset = {
  id: string;
  name: string;
  description: string;
  config: FanConfig;
};

/**
 * The four historical `?fan=` presets, kept as quick-load buttons in the fan
 * controls panel. Preset 1 ("Hand of cards") is the landing default.
 */
export const FAN_PRESETS: FanPreset[] = [
  {
    id: '1',
    name: 'Hand of cards',
    description: 'Reference look: moderate ±15° spread, shallow arc, heavy overlap.',
    config: { endRotationDeg: 15, arcDepthPx: 30, overlapRem: 2.85, scaleFalloff: 0 },
  },
  {
    id: '2',
    name: 'Wide fan',
    description: 'Larger ±24° spread, pronounced arch, deeper overlap, slight edge shrink.',
    config: { endRotationDeg: 24, arcDepthPx: 52, overlapRem: 3.4, scaleFalloff: 0.06 },
  },
  {
    id: '3',
    name: 'Tight',
    description: 'Gentle ±8° spread, minimal arc, light overlap. Close to a near-flat row.',
    config: { endRotationDeg: 8, arcDepthPx: 10, overlapRem: 1.2, scaleFalloff: 0 },
  },
  {
    id: '4',
    name: 'Steep arch',
    description: 'Strong vertical arch with moderate ±14° rotation; outer cards drop noticeably.',
    config: { endRotationDeg: 14, arcDepthPx: 72, overlapRem: 2.6, scaleFalloff: 0.04 },
  },
];

/** Landing default = the "Hand of cards" reference look. */
export const DEFAULT_FAN_CONFIG: FanConfig = { ...FAN_PRESETS[0].config };

/**
 * Compact / phone fan: smaller faces, a taller arc so the hand reads more
 * vertically, and a lighter overlap so more of each plate stays visible while
 * neighbours still nest. Tuned so six ~88px tiles fit a ~360–390px-wide
 * viewport with side padding and remain easy to tap.
 *
 * Other compact options considered:
 *  - Steeper arch (±14°, arc ~72): more vertical, but outer tips crowd the copy
 *  - Flat strip (overlap ~1.2): max face visible, loses the "hand of cards" read
 *  - Five-tile draw: easiest fit, but a thinner roster than desktop
 */
export const MOBILE_FAN_CONFIG: FanConfig = {
  endRotationDeg: 10,
  arcDepthPx: 64,
  overlapRem: 1.85,
  scaleFalloff: 0.05,
};

/** Landing tile edge length on desktop (matches `.locationImage` in CSS). */
export const DESKTOP_TILE_PX = 150;
/** Landing tile edge length on compact viewports. */
export const MOBILE_TILE_PX = 84;

export const LANDING_FAN_STORAGE_KEY = 'saudade:landing-fan:saved-default';

function parseFanConfig(raw: string): FanConfig | null {
  try {
    const parsed = JSON.parse(raw) as Partial<FanConfig>;
    return { ...DEFAULT_FAN_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

/** Baseline on load: saved default, then the "Hand of cards" code default. */
export function loadLandingFanConfig(): FanConfig {
  if (typeof window === 'undefined') return DEFAULT_FAN_CONFIG;
  const raw = window.localStorage.getItem(LANDING_FAN_STORAGE_KEY);
  if (raw) {
    const parsed = parseFanConfig(raw);
    if (parsed) return parsed;
  }
  return DEFAULT_FAN_CONFIG;
}

export function saveLandingFanConfigDefault(config: FanConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANDING_FAN_STORAGE_KEY, JSON.stringify(config));
}

export function fanConfigSummary(config: FanConfig): string {
  return [
    `±${config.endRotationDeg}°`,
    `arc ${config.arcDepthPx}px`,
    `overlap ${config.overlapRem}rem`,
    `edge ${config.scaleFalloff.toFixed(2)}`,
  ].join(' · ');
}
