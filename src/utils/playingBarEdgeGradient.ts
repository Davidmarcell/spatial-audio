export type PlayingBarEdgeGradientConfig = {
  /** Overall wave opacity when playing (prototype: Wave Opacity, 0.2–1). */
  waveOpacity: number;
  /** When true, scene-derived warm/accent colours drive the radiance. */
  useSceneColours: boolean;
  /** Dev override for Colour 1 (prototype default #47b9ff). */
  colour1: string;
  /** Dev override for Colour 2 (prototype default #ffd9e8). */
  colour2: string;
  /** Gradient direction in degrees (prototype default 191). */
  gradientAngle: number;
  /** Horizontal bias along the gradient axis (0–1, default 0.58). */
  gradientOffset: number;
  /** Compression along the gradient axis (0.1–2, default 0.64). */
  gradientScale: number;
  /** Where colour 2 takes over (0–1, default 0.73). */
  gradientMidpoint: number;
  /** Blend softness across the midpoint (0.01–1, default 1). */
  gradientSoftness: number;
  /** Shader stop where glow is fully visible (default 1.35). */
  glowStopHigh: number;
  /** Shader stop where glow begins (default 0.72). */
  glowStopLow: number;
  /** Corner lift emphasis (0–1, default 0.39). */
  edgeRise: number;
  /** Vertical lift of the wave band (prototype: Wave Height Shift, 0–0.6). */
  verticalOffset: number;
  /** Enable the breathing motion loop. */
  breatheEnabled: boolean;
  /** Main breath cycle duration (seconds). */
  breathDurationSec: number;
};

export const PLAYING_BAR_EDGE_GRADIENT_STORAGE_KEY = 'saudade:playing-bar-edge-gradient:v3';
export const PLAYING_BAR_EDGE_GRADIENT_TUNER_VISIBLE_KEY =
  'saudade:playing-bar-edge-gradient-tuner-visible';

/** Defaults aligned with kirschberg.co.nz/bar-shaders (`va` config). */
export const DEFAULT_PLAYING_BAR_EDGE_GRADIENT: PlayingBarEdgeGradientConfig = {
  waveOpacity: 1,
  useSceneColours: true,
  colour1: '#47b9ff',
  colour2: '#ffd9e8',
  gradientAngle: 191,
  gradientOffset: 0.58,
  gradientScale: 0.64,
  gradientMidpoint: 0.73,
  gradientSoftness: 1,
  glowStopHigh: 1.35,
  glowStopLow: 0.72,
  edgeRise: 0.39,
  verticalOffset: 0,
  breatheEnabled: true,
  breathDurationSec: 9.5,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function gradientStops(midpoint: number, softness: number): { start: string; end: string } {
  const halfSoft = Math.max(0.005, softness) * 0.5;
  const start = Math.max(0, midpoint - halfSoft);
  const end = Math.min(1, midpoint + halfSoft);
  return {
    start: `${(start * 100).toFixed(1)}%`,
    end: `${(end * 100).toFixed(1)}%`,
  };
}

export function applyPlayingBarEdgeGradient(config: PlayingBarEdgeGradientConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const glowRange = Math.max(0.12, config.glowStopHigh - config.glowStopLow);
  const shaderMaxHeightVh = Math.round((glowRange / 0.63) * 82);
  const maskFadeStart = Math.round(clamp01(config.glowStopLow) * 48);
  const stops = gradientStops(
    clamp01(config.gradientMidpoint),
    Math.max(0.01, config.gradientSoftness),
  );

  root.dataset.playingBarBreathe = config.breatheEnabled ? '1' : '0';

  root.style.setProperty('--playing-bar-wave-opacity', clamp01(config.waveOpacity).toFixed(3));
  root.style.setProperty('--playing-bar-gradient-angle', String(config.gradientAngle));
  root.style.setProperty('--playing-bar-gradient-offset', config.gradientOffset.toFixed(3));
  root.style.setProperty(
    '--playing-bar-gradient-scale',
    Math.max(0.1, config.gradientScale).toFixed(3),
  );
  root.style.setProperty('--playing-bar-gradient-stop-start', stops.start);
  root.style.setProperty('--playing-bar-gradient-stop-end', stops.end);
  root.style.setProperty('--playing-bar-edge-rise', clamp01(config.edgeRise).toFixed(3));
  root.style.setProperty('--playing-bar-vertical-offset', config.verticalOffset.toFixed(3));
  root.style.setProperty('--playing-bar-shader-max-vh', `${shaderMaxHeightVh}vh`);
  root.style.setProperty('--playing-bar-mask-fade-start', `${maskFadeStart}%`);
  root.style.setProperty('--playing-bar-breath-duration', `${config.breathDurationSec}s`);

  if (config.useSceneColours) {
    root.style.removeProperty('--playing-bar-colour-1-override');
    root.style.removeProperty('--playing-bar-colour-2-override');
  } else {
    root.style.setProperty('--playing-bar-colour-1-override', config.colour1);
    root.style.setProperty('--playing-bar-colour-2-override', config.colour2);
  }
}

export function loadPlayingBarEdgeGradient(): PlayingBarEdgeGradientConfig {
  if (typeof window === 'undefined') return DEFAULT_PLAYING_BAR_EDGE_GRADIENT;
  try {
    const raw = window.localStorage.getItem(PLAYING_BAR_EDGE_GRADIENT_STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYING_BAR_EDGE_GRADIENT;
    const parsed = JSON.parse(raw) as Partial<PlayingBarEdgeGradientConfig>;
    return { ...DEFAULT_PLAYING_BAR_EDGE_GRADIENT, ...parsed };
  } catch {
    return DEFAULT_PLAYING_BAR_EDGE_GRADIENT;
  }
}

export function savePlayingBarEdgeGradient(config: PlayingBarEdgeGradientConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PLAYING_BAR_EDGE_GRADIENT_STORAGE_KEY, JSON.stringify(config));
}

export function isPlayingBarEdgeGradientTunerEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('shaderDebug') === '1') return true;
  return window.localStorage.getItem(PLAYING_BAR_EDGE_GRADIENT_TUNER_VISIBLE_KEY) === '1';
}

export function readPlayingBarEdgeGradientTunerVisible(): boolean {
  return isPlayingBarEdgeGradientTunerEnabled();
}

export function persistPlayingBarEdgeGradientTunerVisible(visible: boolean): void {
  if (typeof window === 'undefined') return;
  if (visible) {
    window.localStorage.setItem(PLAYING_BAR_EDGE_GRADIENT_TUNER_VISIBLE_KEY, '1');
  } else {
    window.localStorage.removeItem(PLAYING_BAR_EDGE_GRADIENT_TUNER_VISIBLE_KEY);
  }
}

export function configSummary(config: PlayingBarEdgeGradientConfig): string {
  return [
    `Opacity ${Math.round(config.waveOpacity * 100)}%`,
    `${config.gradientAngle}°`,
    config.useSceneColours ? 'Scene colours' : 'Custom colours',
    config.breatheEnabled ? 'Breathing on' : 'Breathing off',
  ].join(' · ');
}
