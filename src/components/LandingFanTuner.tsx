import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFAULT_FAN_CONFIG,
  fanConfigSummary,
  FAN_PRESETS,
  saveLandingFanConfigDefault,
  loadLandingFanConfig,
  type FanConfig,
} from './landingFan';
import styles from './LandingFanTuner.module.css';

const FAN_TUNER_VISIBLE_KEY = 'saudade:landing-fan-tuner-visible';

function isFanTunerEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('fanDebug') === '1') return true;
  return window.localStorage.getItem(FAN_TUNER_VISIBLE_KEY) === '1';
}

function persistFanTunerVisible(visible: boolean): void {
  if (typeof window === 'undefined') return;
  if (visible) {
    window.localStorage.setItem(FAN_TUNER_VISIBLE_KEY, '1');
  } else {
    window.localStorage.removeItem(FAN_TUNER_VISIBLE_KEY);
  }
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  displayValue?: string;
  onChange: (value: number) => void;
};

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  displayValue,
  onChange,
}: SliderProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <span className={styles.fieldValue}>{displayValue ?? `${value}${unit}`}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

type LandingFanTunerProps = {
  config: FanConfig;
  onChange: (config: FanConfig) => void;
  /** Whether the landing gate is currently shown (drives the preview hint). */
  landingEnabled?: boolean;
  /** Toggles the landing gate on/off (dev control, persisted by the parent). */
  onLandingEnabledChange?: (enabled: boolean) => void;
};

export function LandingFanTuner({
  config,
  onChange,
  landingEnabled = false,
  onLandingEnabledChange,
}: LandingFanTunerProps) {
  const [visible, setVisible] = useState(() => isFanTunerEnabled());
  const [collapsed, setCollapsed] = useState(false);
  const [savedDefault, setSavedDefault] = useState<FanConfig | null>(() =>
    typeof window === 'undefined' ? null : loadLandingFanConfig(),
  );

  const showPanel = (persist = true) => {
    setVisible(true);
    if (persist) persistFanTunerVisible(true);
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('fanDebug') === '1') showPanel();
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'f' || !event.shiftKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }
      event.preventDefault();
      setVisible((current) => {
        const next = !current;
        persistFanTunerVisible(next);
        return next;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!import.meta.env.DEV || typeof document === 'undefined') return null;

  const hidePanel = () => {
    setVisible(false);
    persistFanTunerVisible(false);
  };

  const patch = (next: Partial<FanConfig>) => onChange({ ...config, ...next });

  const activePresetId = FAN_PRESETS.find(
    (preset) =>
      preset.config.endRotationDeg === config.endRotationDeg &&
      preset.config.arcDepthPx === config.arcDepthPx &&
      preset.config.overlapRem === config.overlapRem &&
      preset.config.scaleFalloff === config.scaleFalloff,
  )?.id;

  return createPortal(
    <>
      <div className={styles.launcherDock}>
        <button
          type="button"
          role="switch"
          aria-checked={landingEnabled}
          className={`${styles.landingSwitch} ${landingEnabled ? styles.landingSwitchOn : ''}`}
          onClick={() => onLandingEnabledChange?.(!landingEnabled)}
          aria-label="Show the landing hero moment"
          title="Show the landing hero moment (dev only)"
        >
          <span className={styles.switchTrack} aria-hidden>
            <span className={styles.switchKnob} />
          </span>
          <span className={styles.switchLabel}>Landing</span>
        </button>
        <button
          type="button"
          className={`${styles.launcher} ${visible ? styles.launcherActive : ''}`}
          onClick={() => (visible ? hidePanel() : showPanel())}
          aria-pressed={visible}
          aria-label={visible ? 'Hide landing fan controls' : 'Open landing fan controls'}
        >
          Fan
        </button>
      </div>

      {visible && (
        <aside className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}>
          <header className={styles.header}>
            <div>
              <h2 className={styles.title}>Landing fan</h2>
              <p className={styles.summary}>{fanConfigSummary(config)}</p>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setCollapsed((current) => !current)}
                aria-label={collapsed ? 'Expand fan panel' : 'Collapse fan panel'}
              >
                {collapsed ? '‹' : '›'}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={hidePanel}
                aria-label="Hide fan panel"
              >
                ×
              </button>
            </div>
          </header>

          {!collapsed && (
            <div className={styles.body}>
              <p className={styles.hint}>
                {landingEnabled
                  ? 'Adjust the fan of card tiles live.'
                  : 'Flip the Landing switch to preview.'}{' '}
                Toggle with <kbd>Shift</kbd>+<kbd>F</kbd> or <code>?fanDebug=1</code> (dev only).
              </p>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Presets</h3>
                <div className={styles.presetRow}>
                  {FAN_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`${styles.presetButton} ${
                        activePresetId === preset.id ? styles.presetButtonActive : ''
                      }`}
                      title={preset.description}
                      onClick={() => onChange({ ...preset.config })}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Layout</h3>
                <SliderField
                  label="Spread / end rotation"
                  value={config.endRotationDeg}
                  min={0}
                  max={40}
                  step={1}
                  unit="°"
                  displayValue={`±${config.endRotationDeg}°`}
                  onChange={(endRotationDeg) => patch({ endRotationDeg })}
                />
                <SliderField
                  label="Arc depth"
                  value={config.arcDepthPx}
                  min={0}
                  max={120}
                  step={1}
                  unit="px"
                  onChange={(arcDepthPx) => patch({ arcDepthPx })}
                />
                <SliderField
                  label="Overlap"
                  value={config.overlapRem}
                  min={0}
                  max={4.5}
                  step={0.05}
                  displayValue={`${config.overlapRem.toFixed(2)}rem`}
                  onChange={(overlapRem) => patch({ overlapRem })}
                />
                <SliderField
                  label="Edge scale falloff"
                  value={config.scaleFalloff}
                  min={0}
                  max={0.3}
                  step={0.01}
                  displayValue={config.scaleFalloff.toFixed(2)}
                  onChange={(scaleFalloff) => patch({ scaleFalloff })}
                />
              </div>

              <div className={styles.footer}>
                <div className={styles.footerActions}>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => {
                      saveLandingFanConfigDefault(config);
                      setSavedDefault({ ...config });
                    }}
                  >
                    Save as default
                  </button>
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={() => onChange({ ...DEFAULT_FAN_CONFIG })}
                  >
                    Reset
                  </button>
                </div>
                <span className={styles.defaults}>
                  {savedDefault
                    ? `Saved default: ${fanConfigSummary(savedDefault)}`
                    : `No saved default · code default: ${fanConfigSummary(DEFAULT_FAN_CONFIG)}`}
                </span>
              </div>
            </div>
          )}
        </aside>
      )}
    </>,
    document.body,
  );
}
