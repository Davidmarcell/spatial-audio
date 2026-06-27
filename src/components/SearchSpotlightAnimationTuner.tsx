import { useEffect, useState } from 'react';
import { useSearchSpotlightAnimation } from '../context/SearchSpotlightAnimationContext';
import {
  computeCloseRemainingDropMs,
  computeCloseShrinkPhaseDurationMs,
  computeCloseWidthStartDelayMs,
  computeRisePhaseDurationMs,
  computeRiseStartDelayMs,
  DEFAULT_SEARCH_SPOTLIGHT_ANIMATION,
  easingPresetLabel,
  isSearchSpotlightTunerEnabled,
  persistSearchSpotlightTunerVisible,
  SEARCH_SPOTLIGHT_EASING_PRESETS,
  type SearchSpotlightAnimationConfig,
  type SearchSpotlightEasingPreset,
} from '../utils/searchSpotlightAnimation';
import styles from './SearchSpotlightAnimationTuner.module.css';

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
};

type SelectProps = {
  label: string;
  value: SearchSpotlightEasingPreset;
  onChange: (value: SearchSpotlightEasingPreset) => void;
  note?: string;
};

function SliderField({ label, value, min, max, step = 1, unit = '', onChange }: SliderProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <span className={styles.fieldValue}>
          {value}
          {unit}
        </span>
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

function SelectField({ label, value, onChange, note }: SelectProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value as SearchSpotlightEasingPreset)}
      >
        {SEARCH_SPOTLIGHT_EASING_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
      {note ? <span className={styles.fieldNote}>{note}</span> : null}
    </label>
  );
}

function configSummary(config: SearchSpotlightAnimationConfig) {
  return [
    `Open ${config.openWidthDurationMs}/${config.openRiseDurationMs}ms`,
    `Rise overlap ${config.riseOverlapMs}ms`,
    `Close drop ${config.closeDropDurationMs}ms`,
    `Close overlap ${config.closeOverlapMs}ms`,
  ].join(' · ');
}

export function SearchSpotlightAnimationTuner() {
  const { config, setConfig, resetConfig } = useSearchSpotlightAnimation();
  const [visible, setVisible] = useState(() => isSearchSpotlightTunerEnabled());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('animDebug') === '2') {
      setVisible(true);
      persistSearchSpotlightTunerVisible(true);
    }
  }, []);

  if (!import.meta.env.DEV || !visible) return null;

  const hidePanel = () => {
    setVisible(false);
    persistSearchSpotlightTunerVisible(false);
  };

  const riseStartMs = computeRiseStartDelayMs(config);
  const closeWidthStartMs = computeCloseWidthStartDelayMs(config);
  const closeRemainingDropMs = computeCloseRemainingDropMs(config);
  const closeShrinkPhaseMs = computeCloseShrinkPhaseDurationMs(config);

  return (
    <aside className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Search animation</h2>
          <p className={styles.summary}>{configSummary(config)}</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? 'Expand tuning panel' : 'Collapse tuning panel'}
          >
            {collapsed ? '›' : '‹'}
          </button>
          <button type="button" className={styles.iconButton} onClick={hidePanel} aria-label="Hide tuning panel">
            ×
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className={styles.body}>
          <p className={styles.hint}>
            Adjust values, then open the location search to preview. Add{' '}
            <code>?animDebug=2</code> to restore this panel.
          </p>

          <SliderField
            label="Width phase"
            value={config.openWidthDurationMs}
            min={40}
            max={400}
            unit="ms"
            onChange={(openWidthDurationMs) => setConfig({ openWidthDurationMs })}
          />
          <SliderField
            label="Rise phase"
            value={config.openRiseDurationMs}
            min={120}
            max={600}
            unit="ms"
            onChange={(openRiseDurationMs) => setConfig({ openRiseDurationMs })}
          />
          <SliderField
            label="Start rise sooner (overlap)"
            value={config.riseOverlapMs}
            min={0}
            max={120}
            unit="ms"
            onChange={(riseOverlapMs) => setConfig({ riseOverlapMs })}
          />
          <p className={styles.fieldNote}>
            Rise begins after {riseStartMs}ms ({config.riseOverlapMs}ms before width finishes at{' '}
            {config.openWidthDurationMs}ms).
          </p>
          <SliderField
            label="Content reveal delay"
            value={config.contentRevealDelayMs}
            min={0}
            max={200}
            unit="ms"
            onChange={(contentRevealDelayMs) => setConfig({ contentRevealDelayMs })}
          />

          <div className={styles.groupLabel}>Width expand easing</div>
          <SelectField
            label="Timing curve"
            value={config.widthEasing}
            onChange={(widthEasing) => setConfig({ widthEasing })}
            note={
              config.widthEasing === 'spring'
                ? 'Spring adds a horizontal overshoot via keyframes; stiffness, damping and overshoot set how far it bounces.'
                : `Curve: ${easingPresetLabel(config.widthEasing)}`
            }
          />

          <div className={styles.groupLabel}>Width bounce</div>
          <SliderField
            label="Stiffness"
            value={config.widthStiffness}
            min={120}
            max={900}
            onChange={(widthStiffness) => setConfig({ widthStiffness })}
          />
          <SliderField
            label="Damping"
            value={config.widthDamping}
            min={8}
            max={80}
            onChange={(widthDamping) => setConfig({ widthDamping })}
          />
          <SliderField
            label="Overshoot"
            value={Math.round((config.widthOvershoot ?? 1) * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => setConfig({ widthOvershoot: value / 100 })}
          />
          {config.widthEasing !== 'spring' ? (
            <p className={styles.fieldNote}>Overshoot applies when the timing curve is Spring.</p>
          ) : null}

          <div className={styles.groupLabel}>Vertical rise easing</div>
          <SelectField
            label="Timing curve"
            value={config.riseEasing}
            onChange={(riseEasing) => setConfig({ riseEasing })}
            note={
              config.riseEasing === 'spring'
                ? 'Spring adds a vertical stretch overshoot from the bottom edge via keyframes; stiffness, damping and overshoot set how far the top bounces.'
                : `Curve: ${easingPresetLabel(config.riseEasing)}`
            }
          />

          <div className={styles.groupLabel}>Rise bounce</div>
          <SliderField
            label="Rise bounce duration"
            value={config.riseBounceDurationMs}
            min={200}
            max={900}
            unit="ms"
            onChange={(riseBounceDurationMs) => setConfig({ riseBounceDurationMs })}
          />
          <p className={styles.fieldNote}>
            Spring keyframe bounce runs for {config.riseBounceDurationMs}ms (opening-rise phase stays
            active for {computeRisePhaseDurationMs(config)}ms).
          </p>
          <SliderField
            label="Stiffness"
            value={config.riseStiffness}
            min={120}
            max={900}
            onChange={(riseStiffness) => setConfig({ riseStiffness })}
          />
          <SliderField
            label="Damping"
            value={config.riseDamping}
            min={8}
            max={80}
            onChange={(riseDamping) => setConfig({ riseDamping })}
          />
          <SliderField
            label="Overshoot"
            value={Math.round((config.riseOvershoot ?? 1) * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => setConfig({ riseOvershoot: value / 100 })}
          />
          {config.riseEasing !== 'spring' ? (
            <p className={styles.fieldNote}>Overshoot applies when the timing curve is Spring.</p>
          ) : null}

          <div className={styles.groupLabel}>Content reveal easing</div>
          <SelectField
            label="Timing curve"
            value={config.contentEasing}
            onChange={(contentEasing) => setConfig({ contentEasing })}
          />

          <div className={styles.groupLabel}>Close</div>
          <SliderField
            label="Drop phase"
            value={config.closeDropDurationMs}
            min={80}
            max={400}
            unit="ms"
            onChange={(closeDropDurationMs) => setConfig({ closeDropDurationMs })}
          />
          <SelectField
            label="Drop easing"
            value={config.closeDropEasing}
            onChange={(closeDropEasing) => setConfig({ closeDropEasing })}
          />
          <SliderField
            label="Start width shrink sooner (close overlap)"
            value={config.closeOverlapMs}
            min={0}
            max={120}
            unit="ms"
            onChange={(closeOverlapMs) => setConfig({ closeOverlapMs })}
          />
          <p className={styles.fieldNote}>
            Width shrink begins after {closeWidthStartMs}ms ({config.closeOverlapMs}ms before drop
            finishes at {config.closeDropDurationMs}ms). Drop and width run together for{' '}
            {closeRemainingDropMs}ms; closing-shrink phase lasts {closeShrinkPhaseMs}ms.
          </p>
          <SliderField
            label="Width shrink duration"
            value={config.closeWidthDurationMs}
            min={40}
            max={400}
            unit="ms"
            onChange={(closeWidthDurationMs) => setConfig({ closeWidthDurationMs })}
          />
          <SliderField
            label="Shrink bounce"
            value={config.closeShrinkDurationMs}
            min={200}
            max={700}
            unit="ms"
            onChange={(closeShrinkDurationMs) => setConfig({ closeShrinkDurationMs })}
          />
          <SelectField
            label="Shrink easing"
            value={config.closeShrinkEasing}
            onChange={(closeShrinkEasing) => setConfig({ closeShrinkEasing })}
          />

          <div className={styles.footer}>
            <button type="button" className={styles.resetButton} onClick={resetConfig}>
              Reset defaults
            </button>
            <span className={styles.defaults}>
              Defaults: {configSummary(DEFAULT_SEARCH_SPOTLIGHT_ANIMATION)}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
