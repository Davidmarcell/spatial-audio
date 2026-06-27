export type SearchSpotlightEasingPreset =
  | 'spring'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'linear'
  | 'ios'
  | 'spring-ios'
  | 'gentle-overshoot'
  | 'premium-enter'
  | 'premium-exit';

export type SearchSpotlightAnimationConfig = {
  openWidthDurationMs: number;
  openRiseDurationMs: number;
  riseOverlapMs: number;
  contentRevealDelayMs: number;
  widthStiffness: number;
  widthDamping: number;
  /** 0–1 multiplier on computed width spring overshoot (keyframes). */
  widthOvershoot: number;
  riseStiffness: number;
  riseDamping: number;
  /** 0–1 multiplier on computed rise spring overshoot (keyframes). */
  riseOvershoot: number;
  /** Duration of the rise spring keyframe bounce (ms), separate from height expand. */
  riseBounceDurationMs: number;
  widthEasing: SearchSpotlightEasingPreset;
  riseEasing: SearchSpotlightEasingPreset;
  contentEasing: SearchSpotlightEasingPreset;
  closeDropEasing: SearchSpotlightEasingPreset;
  closeShrinkEasing: SearchSpotlightEasingPreset;
  closeDropDurationMs: number;
  /** Horizontal width collapse during close (panel anchor transition). */
  closeWidthDurationMs: number;
  /** How long before the drop finishes that width shrink begins (mirrors riseOverlapMs). */
  closeOverlapMs: number;
  closeShrinkDurationMs: number;
};

export const SEARCH_SPOTLIGHT_ANIMATION_STORAGE_KEY = 'saudade:search-spotlight-animation:v15';
export const SEARCH_SPOTLIGHT_TUNER_VISIBLE_KEY = 'saudade:search-spotlight-tuner-visible';

export const SEARCH_SPOTLIGHT_EASING_PRESETS: ReadonlyArray<{
  id: SearchSpotlightEasingPreset;
  label: string;
  curve: string | null;
}> = [
  { id: 'spring', label: 'Spring (stiffness / damping)', curve: null },
  { id: 'ease-in', label: 'Ease in', curve: 'cubic-bezier(0.4, 0, 1, 1)' },
  { id: 'ease-out', label: 'Ease out', curve: 'cubic-bezier(0, 0, 0.2, 1)' },
  { id: 'ease-in-out', label: 'Ease in-out', curve: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  { id: 'linear', label: 'Linear', curve: 'linear' },
  { id: 'ios', label: 'iOS default', curve: 'cubic-bezier(0.32, 0.72, 0, 1)' },
  { id: 'spring-ios', label: 'Spring (iOS)', curve: 'cubic-bezier(0.34, 1.2, 0.64, 1)' },
  {
    id: 'gentle-overshoot',
    label: 'Gentle overshoot (settle)',
    curve: 'cubic-bezier(0.34, 1.12, 0.64, 1)',
  },
  { id: 'premium-enter', label: 'Premium enter', curve: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  { id: 'premium-exit', label: 'Premium exit', curve: 'cubic-bezier(0.4, 0, 0.2, 1)' },
];

export const DEFAULT_SEARCH_SPOTLIGHT_ANIMATION: SearchSpotlightAnimationConfig = {
  openWidthDurationMs: 150,
  openRiseDurationMs: 350,
  riseOverlapMs: 100,
  contentRevealDelayMs: 0,
  widthStiffness: 280,
  widthDamping: 38,
  widthOvershoot: 0,
  riseStiffness: 300,
  riseDamping: 32,
  riseOvershoot: 0,
  riseBounceDurationMs: 380,
  widthEasing: 'ease-in',
  riseEasing: 'ease-in',
  contentEasing: 'ease-out',
  closeDropEasing: 'gentle-overshoot',
  closeShrinkEasing: 'gentle-overshoot',
  closeDropDurationMs: 350,
  closeWidthDurationMs: 150,
  closeOverlapMs: 100,
  closeShrinkDurationMs: 380,
};

/**
 * Keep the close choreography matched to open for *timing* (drop ↔ rise,
 * shrink ↔ width), but intentionally diverge on *easing*: the open path stays
 * clean (ease-in, no overshoot) while the close gets a soft 'gentle-overshoot'
 * settle so the panel feels a little alive as it tucks away.
 */
export function syncCloseAnimationToOpen(
  config: SearchSpotlightAnimationConfig,
): SearchSpotlightAnimationConfig {
  const risePhaseMs = Math.max(config.openRiseDurationMs, config.riseBounceDurationMs);
  return {
    ...config,
    closeDropDurationMs: config.openRiseDurationMs,
    closeWidthDurationMs: config.openWidthDurationMs,
    closeOverlapMs: config.riseOverlapMs,
    closeShrinkDurationMs: risePhaseMs,
    closeDropEasing: 'gentle-overshoot',
    closeShrinkEasing: 'gentle-overshoot',
  };
}

/**
 * Maps spring physics to a 0–1 bounce amount for keyframe overshoot.
 * Lower damping (underdamped) => more bounce; critical/overdamped => none.
 */
export function computeSpringVisualBounce(stiffness: number, damping: number): number {
  const zeta = damping / (2 * Math.sqrt(Math.max(stiffness, 1)));
  if (zeta >= 1) return 0;
  const underdamped = 1 - zeta;
  return Math.min(1, Math.pow(Math.max(0, underdamped), 1.25) * 1.25);
}

/** Smooth transition easing when Spring mode delegates overshoot to keyframes. */
export function springTransitionEase(stiffness: number, damping: number): string {
  const bounce = computeSpringVisualBounce(stiffness, damping);
  if (bounce <= 0.01) return 'ease-out';
  return `cubic-bezier(0.22, ${(1 + bounce * 0.08).toFixed(3)}, 0.36, 1)`;
}

export function msToCssDuration(ms: number): string {
  return `${Math.max(0, ms) / 1000}s`;
}

export function computeRiseStartDelayMs(config: SearchSpotlightAnimationConfig): number {
  return Math.max(0, config.openWidthDurationMs - config.riseOverlapMs);
}

/** How long the opening-rise phase stays active (height expand + spring bounce). */
export function computeRisePhaseDurationMs(config: SearchSpotlightAnimationConfig): number {
  return Math.max(config.openRiseDurationMs, config.riseBounceDurationMs);
}

/** When to leave closing-drop and begin width shrink (0 = immediately with drop). */
export function computeCloseWidthStartDelayMs(config: SearchSpotlightAnimationConfig): number {
  return Math.max(0, config.closeDropDurationMs - config.closeOverlapMs);
}

/** Remaining vertical drop time once width shrink has started. */
export function computeCloseRemainingDropMs(config: SearchSpotlightAnimationConfig): number {
  return Math.min(config.closeOverlapMs, config.closeDropDurationMs);
}

/** How long closing-shrink stays active (drop tail + width bounce, whichever is longer). */
export function computeCloseShrinkPhaseDurationMs(config: SearchSpotlightAnimationConfig): number {
  return Math.max(computeCloseRemainingDropMs(config), config.closeShrinkDurationMs);
}

export function resolveSearchSpotlightEasing(
  preset: SearchSpotlightEasingPreset,
  stiffness: number,
  damping: number,
): string {
  if (preset === 'spring') {
    return springTransitionEase(stiffness, damping);
  }
  const match = SEARCH_SPOTLIGHT_EASING_PRESETS.find((entry) => entry.id === preset);
  return match?.curve ?? 'ease-out';
}

export function applySearchSpotlightAnimation(config: SearchSpotlightAnimationConfig): void {
  if (typeof document === 'undefined') return;
  const synced = syncCloseAnimationToOpen(config);
  const root = document.documentElement;
  const widthEase = resolveSearchSpotlightEasing(
    synced.widthEasing,
    synced.widthStiffness,
    synced.widthDamping,
  );
  const riseEase = resolveSearchSpotlightEasing(
    synced.riseEasing,
    synced.riseStiffness,
    synced.riseDamping,
  );
  const contentEase = resolveSearchSpotlightEasing(
    synced.contentEasing,
    synced.riseStiffness,
    synced.riseDamping,
  );
  const closeDropEase = resolveSearchSpotlightEasing(
    synced.closeDropEasing,
    synced.riseStiffness,
    synced.riseDamping,
  );
  const closeShrinkEase = resolveSearchSpotlightEasing(
    synced.closeShrinkEasing,
    synced.widthStiffness,
    synced.widthDamping,
  );

  const widthBounce =
    computeSpringVisualBounce(synced.widthStiffness, synced.widthDamping) *
    Math.min(1, Math.max(0, synced.widthOvershoot));
  const riseBounce =
    computeSpringVisualBounce(synced.riseStiffness, synced.riseDamping) *
    Math.min(1, Math.max(0, synced.riseOvershoot));
  const widthSpringActive = synced.widthEasing === 'spring' && widthBounce > 0.01;
  const riseSpringActive = riseBounce > 0.01;

  root.dataset.searchWidthSpring = widthSpringActive ? '1' : '0';
  root.dataset.searchRiseSpring = riseSpringActive ? '1' : '0';

  root.style.setProperty('--search-open-width-duration', msToCssDuration(synced.openWidthDurationMs));
  root.style.setProperty('--search-open-rise-duration', msToCssDuration(synced.openRiseDurationMs));
  root.style.setProperty('--search-content-delay', msToCssDuration(synced.contentRevealDelayMs));
  root.style.setProperty('--search-open-width-ease', widthEase);
  root.style.setProperty('--search-open-rise-ease', riseEase);
  root.style.setProperty('--search-rise-ease', riseEase);
  root.style.setProperty('--search-content-ease', contentEase);
  root.style.setProperty('--search-close-drop-ease', closeDropEase);
  root.style.setProperty('--search-close-bounce-ease', closeShrinkEase);
  root.style.setProperty('--search-width-ease', closeShrinkEase);
  root.style.setProperty('--search-close-drop-duration', msToCssDuration(synced.closeDropDurationMs));
  root.style.setProperty('--search-close-width-duration', msToCssDuration(synced.closeWidthDurationMs));
  root.style.setProperty('--search-close-overlap-ms', msToCssDuration(synced.closeOverlapMs));
  root.style.setProperty('--search-close-bounce-duration', msToCssDuration(synced.closeShrinkDurationMs));
  root.style.setProperty('--search-width-spring-peak', (1 + widthBounce * 0.06).toFixed(4));
  root.style.setProperty('--search-rise-spring-duration', msToCssDuration(synced.riseBounceDurationMs));
  root.style.setProperty('--search-rise-translate-overshoot', (1 + riseBounce * 0.09).toFixed(4));
  root.style.setProperty('--search-rise-spring-scale-peak', (1 + riseBounce * 0.085).toFixed(4));
  root.style.setProperty('--search-rise-spring-scale-settle', (1 - riseBounce * 0.028).toFixed(4));
  root.style.setProperty('--search-rise-overlap-ms', msToCssDuration(synced.riseOverlapMs));
  root.style.setProperty(
    '--search-side-shift-delay',
    msToCssDuration(computeRiseStartDelayMs(synced)),
  );
}

export function loadSearchSpotlightAnimation(): SearchSpotlightAnimationConfig {
  if (typeof window === 'undefined') return DEFAULT_SEARCH_SPOTLIGHT_ANIMATION;
  try {
    const raw = window.localStorage.getItem(SEARCH_SPOTLIGHT_ANIMATION_STORAGE_KEY);
    if (!raw) return DEFAULT_SEARCH_SPOTLIGHT_ANIMATION;
    const parsed = JSON.parse(raw) as Partial<SearchSpotlightAnimationConfig>;
    return syncCloseAnimationToOpen({ ...DEFAULT_SEARCH_SPOTLIGHT_ANIMATION, ...parsed });
  } catch {
    return DEFAULT_SEARCH_SPOTLIGHT_ANIMATION;
  }
}

export function saveSearchSpotlightAnimation(config: SearchSpotlightAnimationConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SEARCH_SPOTLIGHT_ANIMATION_STORAGE_KEY, JSON.stringify(config));
}

export function isSearchSpotlightTunerEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  // Hidden by default — require an explicit dev flag to surface the panel.
  return params.get('animDebug') === '2';
}

export function persistSearchSpotlightTunerVisible(visible: boolean): void {
  if (typeof window === 'undefined') return;
  if (visible) {
    window.localStorage.setItem(SEARCH_SPOTLIGHT_TUNER_VISIBLE_KEY, '1');
  } else {
    window.localStorage.removeItem(SEARCH_SPOTLIGHT_TUNER_VISIBLE_KEY);
  }
}

export function easingPresetLabel(preset: SearchSpotlightEasingPreset): string {
  return SEARCH_SPOTLIGHT_EASING_PRESETS.find((entry) => entry.id === preset)?.label ?? preset;
}
