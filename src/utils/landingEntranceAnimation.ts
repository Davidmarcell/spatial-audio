/**
 * Live-tunable timing for the landing gate's entrance / loading animation. The
 * hero stack cascades in on mount as one choreographed beat: the wordmark
 * cascades letter by letter, the fan of tiles rises once its art has decoded,
 * then the tagline, the search pill and finally the Enter button. Every delay,
 * duration and rise distance below is written onto the document root as a CSS
 * custom property (see `applyLandingEntranceAnimation`) and consumed by the
 * `gateRise` / `landingSearchRise` keyframes in `LandingGate.module.css` and
 * `LocationSearchSpotlight.module.css`, so the whole sequence can be retimed
 * live from the dev tuner without touching the components.
 *
 * The defaults below reproduce the hand-authored CSS timings exactly, so with
 * the config at defaults the out-of-the-box entrance is visually identical. The
 * variables are read via `var(--…, <default>)` fallbacks in the stylesheets, so
 * even before this runs (or in production with no saved override) the animation
 * plays at the same defaults.
 *
 * Kept in `utils/` (not the component file) so the module only exports plain
 * values/helpers and Fast Refresh / HMR of the components stays intact, mirroring
 * `searchSpotlightAnimation.ts` and `landingFan.ts`.
 */
export type LandingEntranceConfig = {
  /** Wordmark: delay before the first letter begins, in ms. */
  wordmarkStartDelayMs: number;
  /** Wordmark: stagger step added per letter, in ms. */
  wordmarkStaggerMs: number;
  /** Wordmark: per-letter rise duration, in ms. */
  wordmarkDurationMs: number;
  /** Wordmark: rise distance each letter travels up into place, in px. */
  wordmarkRisePx: number;

  /** Fan tiles: delay after the art is decode-ready before the row rises, in ms. */
  fanRevealDelayMs: number;
  /** Fan tiles: stagger step between neighbouring tiles, in ms. */
  fanStaggerMs: number;
  /** Fan tiles: per-tile rise duration, in ms. */
  fanDurationMs: number;
  /** Fan tiles: rise distance each tile travels up into place, in px. */
  fanRisePx: number;

  /** Tagline: delay before it rises in, in ms. */
  taglineDelayMs: number;
  /** Tagline: rise duration, in ms. */
  taglineDurationMs: number;

  /** Search pill: delay before it rises in, in ms. */
  searchDelayMs: number;
  /** Search pill: rise duration, in ms. */
  searchDurationMs: number;
  /** Search pill: rise distance, in px. */
  searchRisePx: number;

  /** Enter button: delay before it rises in, in ms. */
  enterDelayMs: number;
  /** Enter button: rise duration, in ms. */
  enterDurationMs: number;
};

/**
 * Code defaults — a 1:1 transcription of the existing hand-authored timings, so
 * the entrance is visually unchanged when the config is at defaults:
 *   • wordmark letters: `gateRise 0.62s … backwards; delay calc(0.05s + i*0.06s)`
 *   • fan tiles:        `gateRise 0.6s … both;       delay calc(0.2s + i*0.06s)`
 *   • tagline:          `gateRise 0.62s … both;      delay 0.6s`
 *   • search pill:      `landingSearchRise 0.55s … 0.66s backwards`
 *   • Enter button:     `gateRise 0.6s … 0.72s backwards`
 * The `gateRise` / `landingSearchRise` keyframes rise from `translateY(12px)`.
 */
export const DEFAULT_LANDING_ENTRANCE_CONFIG: LandingEntranceConfig = {
  wordmarkStartDelayMs: 40,
  wordmarkStaggerMs: 45,
  wordmarkDurationMs: 480,
  wordmarkRisePx: 12,

  fanRevealDelayMs: 140,
  fanStaggerMs: 45,
  fanDurationMs: 460,
  fanRisePx: 12,

  taglineDelayMs: 420,
  taglineDurationMs: 480,

  searchDelayMs: 520,
  searchDurationMs: 420,
  searchRisePx: 12,

  enterDelayMs: 560,
  enterDurationMs: 460,
};

export const LANDING_ENTRANCE_STORAGE_KEY = 'saudade:landing-entrance:saved-default';
export const LANDING_ENTRANCE_TUNER_VISIBLE_KEY = 'saudade:landing-entrance-tuner-visible';

/** Slider metadata (min / max / step) for each tunable parameter, grouped for
 *  the tuner UI. Kept beside the config so ranges stay in one place. */
export type LandingEntranceField = {
  key: keyof LandingEntranceConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: 'ms' | 'px';
};

export type LandingEntranceGroup = {
  title: string;
  fields: LandingEntranceField[];
};

export const LANDING_ENTRANCE_GROUPS: LandingEntranceGroup[] = [
  {
    title: 'Wordmark',
    fields: [
      { key: 'wordmarkStartDelayMs', label: 'Start delay', min: 0, max: 600, step: 10, unit: 'ms' },
      { key: 'wordmarkStaggerMs', label: 'Per-letter stagger', min: 0, max: 200, step: 5, unit: 'ms' },
      { key: 'wordmarkDurationMs', label: 'Per-letter duration', min: 100, max: 1200, step: 10, unit: 'ms' },
      { key: 'wordmarkRisePx', label: 'Rise distance', min: 0, max: 48, step: 1, unit: 'px' },
    ],
  },
  {
    title: 'Fan tiles',
    fields: [
      { key: 'fanRevealDelayMs', label: 'Reveal delay (after decode)', min: 0, max: 1000, step: 10, unit: 'ms' },
      { key: 'fanStaggerMs', label: 'Stagger between tiles', min: 0, max: 200, step: 5, unit: 'ms' },
      { key: 'fanDurationMs', label: 'Duration', min: 100, max: 1200, step: 10, unit: 'ms' },
      { key: 'fanRisePx', label: 'Rise distance', min: 0, max: 48, step: 1, unit: 'px' },
    ],
  },
  {
    title: 'Tagline',
    fields: [
      { key: 'taglineDelayMs', label: 'Delay', min: 0, max: 1500, step: 10, unit: 'ms' },
      { key: 'taglineDurationMs', label: 'Duration', min: 100, max: 1200, step: 10, unit: 'ms' },
    ],
  },
  {
    title: 'Search pill',
    fields: [
      { key: 'searchDelayMs', label: 'Delay', min: 0, max: 1500, step: 10, unit: 'ms' },
      { key: 'searchDurationMs', label: 'Duration', min: 100, max: 1200, step: 10, unit: 'ms' },
      { key: 'searchRisePx', label: 'Rise distance', min: 0, max: 48, step: 1, unit: 'px' },
    ],
  },
  {
    title: 'Enter button',
    fields: [
      { key: 'enterDelayMs', label: 'Delay', min: 0, max: 1500, step: 10, unit: 'ms' },
      { key: 'enterDurationMs', label: 'Duration', min: 100, max: 1200, step: 10, unit: 'ms' },
    ],
  },
];

function msToCss(ms: number): string {
  return `${Math.max(0, ms) / 1000}s`;
}

function pxToCss(px: number): string {
  return `${Math.max(0, px)}px`;
}

/**
 * Write the config onto the document root as CSS custom properties. The landing
 * keyframes read these (with matching `var(--…, <default>)` fallbacks), so the
 * entrance retimes live. The search pill is portalled to <body>, so the
 * properties live on the root rather than the gate element to reach both.
 */
export function applyLandingEntranceAnimation(config: LandingEntranceConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  set('--landing-wordmark-delay', msToCss(config.wordmarkStartDelayMs));
  set('--landing-wordmark-stagger', msToCss(config.wordmarkStaggerMs));
  set('--landing-wordmark-duration', msToCss(config.wordmarkDurationMs));
  set('--landing-wordmark-rise', pxToCss(config.wordmarkRisePx));

  set('--landing-fan-delay', msToCss(config.fanRevealDelayMs));
  set('--landing-fan-stagger', msToCss(config.fanStaggerMs));
  set('--landing-fan-duration', msToCss(config.fanDurationMs));
  set('--landing-fan-rise', pxToCss(config.fanRisePx));

  set('--landing-tagline-delay', msToCss(config.taglineDelayMs));
  set('--landing-tagline-duration', msToCss(config.taglineDurationMs));

  set('--landing-search-delay', msToCss(config.searchDelayMs));
  set('--landing-search-duration', msToCss(config.searchDurationMs));
  set('--landing-search-rise', pxToCss(config.searchRisePx));

  set('--landing-enter-delay', msToCss(config.enterDelayMs));
  set('--landing-enter-duration', msToCss(config.enterDurationMs));
}

function parseConfig(raw: string): LandingEntranceConfig | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LandingEntranceConfig>;
    return { ...DEFAULT_LANDING_ENTRANCE_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

/** Baseline on load: saved default if present, otherwise the code defaults. */
export function loadLandingEntranceConfig(): LandingEntranceConfig {
  if (typeof window === 'undefined') return DEFAULT_LANDING_ENTRANCE_CONFIG;
  const raw = window.localStorage.getItem(LANDING_ENTRANCE_STORAGE_KEY);
  if (raw) {
    const parsed = parseConfig(raw);
    if (parsed) return parsed;
  }
  return DEFAULT_LANDING_ENTRANCE_CONFIG;
}

/** Read the persisted default (if any) without falling back to code defaults. */
export function loadLandingEntranceSavedDefault(): LandingEntranceConfig | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LANDING_ENTRANCE_STORAGE_KEY);
  if (!raw) return null;
  return parseConfig(raw);
}

export function saveLandingEntranceConfigDefault(config: LandingEntranceConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANDING_ENTRANCE_STORAGE_KEY, JSON.stringify(config));
}

export function isLandingEntranceTunerEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('entranceDebug') === '0') return false;
  if (params.get('entranceDebug') === '1') return true;
  const stored = window.localStorage.getItem(LANDING_ENTRANCE_TUNER_VISIBLE_KEY);
  // Default ON in DEV so the landing timing panel is findable; set '0' to hide.
  if (stored === '0') return false;
  return true;
}

export function persistLandingEntranceTunerVisible(visible: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANDING_ENTRANCE_TUNER_VISIBLE_KEY, visible ? '1' : '0');
}

export function landingEntranceSummary(config: LandingEntranceConfig): string {
  return [
    `word ${config.wordmarkDurationMs}ms/${config.wordmarkStaggerMs}`,
    `fan ${config.fanRevealDelayMs}+${config.fanStaggerMs}`,
    `enter ${config.enterDelayMs}ms`,
  ].join(' · ');
}
