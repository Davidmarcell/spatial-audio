import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PLAYING_BAR_EDGE_GRADIENT,
  applyPlayingBarEdgeGradient,
  configSummary,
  loadPlayingBarEdgeGradient,
  persistPlayingBarEdgeGradientTunerVisible,
  savePlayingBarEdgeGradientSavedDefault,
  type PlayingBarEdgeGradientConfig,
} from '../utils/playingBarEdgeGradient';
import styles from './PlayingBarEdgeGradientTuner.module.css';

type PlayingBarEdgeGradientTunerProps = {
  isPlaying?: boolean;
  /** Whether the intro landing gate is enabled (dev toggle, defaults off). */
  landingEnabled?: boolean;
  onLandingEnabledChange?: (enabled: boolean) => void;
};

type SliderField = {
  key: keyof PlayingBarEdgeGradientConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Rendered value, e.g. a percentage or a degree suffix. */
  format?: (value: number) => string;
};

const STRENGTH_FIELDS: SliderField[] = [
  {
    key: 'waveOpacity',
    label: 'Strength',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: 'edgeRise',
    label: 'Corner lift',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: 'glowStopHigh',
    label: 'Glow height',
    min: 0.4,
    max: 2.2,
    step: 0.01,
  },
  {
    key: 'glowStopLow',
    label: 'Glow start',
    min: 0,
    max: 1.6,
    step: 0.01,
  },
  {
    key: 'verticalOffset',
    label: 'Vertical shift',
    min: 0,
    max: 0.6,
    step: 0.01,
  },
];

const GRADIENT_FIELDS: SliderField[] = [
  { key: 'gradientAngle', label: 'Angle', min: 0, max: 360, step: 1, format: (v) => `${Math.round(v)}°` },
  { key: 'gradientOffset', label: 'Offset', min: 0, max: 1, step: 0.01 },
  { key: 'gradientScale', label: 'Scale', min: 0.1, max: 2, step: 0.01 },
  { key: 'gradientMidpoint', label: 'Midpoint', min: 0, max: 1, step: 0.01 },
  { key: 'gradientSoftness', label: 'Softness', min: 0.01, max: 1, step: 0.01 },
];

const BREATH_FIELDS: SliderField[] = [
  { key: 'breathDurationSec', label: 'Breath cycle', min: 3, max: 24, step: 0.5, format: (v) => `${v}s` },
];

/**
 * Is the Radiance panel available in this session?
 *
 * Deliberately NOT gated on `import.meta.env.DEV`: the app is reviewed from a
 * production preview build, where a dev-only gate would mean the controls never
 * appear. Opt in per session with `?radiance=1` (or the older `?shaderDebug=1`),
 * opt out with `?radiance=0`; the choice is remembered.
 */
function readTunerVisible(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('radiance') === '1' || params.get('shaderDebug') === '1') return true;
  if (params.get('radiance') === '0' || params.get('shaderDebug') === '0') return false;
  return window.localStorage.getItem('saudade:playing-bar-edge-gradient-tuner-visible') === '1';
}

export function PlayingBarEdgeGradientTuner({
  isPlaying = false,
  landingEnabled,
  onLandingEnabledChange,
}: PlayingBarEdgeGradientTunerProps) {
  const [config, setConfig] = useState<PlayingBarEdgeGradientConfig>(() =>
    typeof window === 'undefined' ? DEFAULT_PLAYING_BAR_EDGE_GRADIENT : loadPlayingBarEdgeGradient(),
  );
  // Resolved once at mount from the URL / stored flag. Read lazily rather than in
  // an effect so the first render already knows, with no extra pass.
  const [available] = useState(() => readTunerVisible());
  const [open, setOpen] = useState(false);

  // Apply on mount even when the panel is hidden, so a saved default is what the
  // app actually renders rather than only taking effect once the panel is opened.
  useEffect(() => {
    applyPlayingBarEdgeGradient(config);
  }, [config]);

  useEffect(() => {
    if (available) persistPlayingBarEdgeGradientTunerVisible(true);
  }, [available]);

  const update = useCallback(<K extends keyof PlayingBarEdgeGradientConfig>(
    key: K,
    value: PlayingBarEdgeGradientConfig[K],
  ) => {
    setConfig((current) => ({ ...current, [key]: value }));
  }, []);

  const summary = useMemo(() => configSummary(config), [config]);

  const renderSlider = (field: SliderField) => {
    const value = config[field.key] as number;
    return (
      <label className={styles.field} key={field.key}>
        <span className={styles.fieldLabel}>
          {field.label}
          <span className={styles.fieldValue}>
            {field.format ? field.format(value) : value.toFixed(2)}
          </span>
        </span>
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(event) => update(field.key, Number(event.target.value) as never)}
        />
      </label>
    );
  };

  if (!available) return null;

  if (!open) {
    return (
      <div className={styles.launcherDock}>
        <button
          type="button"
          className={styles.launcher}
          onClick={() => setOpen(true)}
        >
          Radiance
        </button>
        {onLandingEnabledChange && (
          <button
            type="button"
            className={`${styles.landingChip} ${landingEnabled ? styles.landingChipOn : ''}`}
            onClick={() => onLandingEnabledChange(!landingEnabled)}
          >
            <span className={styles.landingChipDot} aria-hidden />
            Landing
            <span className={styles.landingChipState}>{landingEnabled ? 'On' : 'Off'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Radiance</h2>
          <p className={styles.summary}>{summary}</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconButton}
            title="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {!isPlaying && (
          <p className={styles.hint}>
            The radiance only paints while a soundscape is playing — press play to
            see these changes.
          </p>
        )}

        {STRENGTH_FIELDS.map(renderSlider)}

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Colour</h3>
          <div className={styles.fieldToggle}>
            <span className={styles.fieldLabel}>Use scene colours</span>
            <input
              type="checkbox"
              checked={config.useSceneColours}
              onChange={(event) => update('useSceneColours', event.target.checked)}
            />
          </div>
          {!config.useSceneColours && (
            <div className={styles.colourRow}>
              <label className={styles.colourField}>
                <span className={styles.colourLabel}>Colour 1</span>
                <input
                  type="color"
                  value={config.colour1}
                  onChange={(event) => update('colour1', event.target.value)}
                />
              </label>
              <label className={styles.colourField}>
                <span className={styles.colourLabel}>Colour 2</span>
                <input
                  type="color"
                  value={config.colour2}
                  onChange={(event) => update('colour2', event.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Gradient</h3>
          {GRADIENT_FIELDS.map(renderSlider)}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Motion</h3>
          <div className={styles.fieldToggle}>
            <span className={styles.fieldLabel}>Breathing</span>
            <input
              type="checkbox"
              checked={config.breatheEnabled}
              onChange={(event) => update('breatheEnabled', event.target.checked)}
            />
          </div>
          {config.breatheEnabled && BREATH_FIELDS.map(renderSlider)}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => savePlayingBarEdgeGradientSavedDefault(config)}
            >
              Save as default
            </button>
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => setConfig(DEFAULT_PLAYING_BAR_EDGE_GRADIENT)}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
