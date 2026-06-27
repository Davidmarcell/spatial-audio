import { useEffect, useState } from 'react';
import { usePlayingBarEdgeGradient } from '../context/PlayingBarEdgeGradientContext';
import {
  configSummary,
  DEFAULT_PLAYING_BAR_EDGE_GRADIENT,
  isPlayingBarEdgeGradientTunerEnabled,
  persistPlayingBarEdgeGradientTunerVisible,
} from '../utils/playingBarEdgeGradient';
import styles from './PlayingBarEdgeGradientTuner.module.css';

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

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SliderField({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = '',
  displayValue,
  onChange,
}: SliderProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <span className={styles.fieldValue}>
          {displayValue ?? `${value}${unit}`}
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

function ToggleField({ label, checked, onChange }: ToggleProps) {
  return (
    <label className={styles.fieldToggle}>
      <span className={styles.fieldLabel}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function PlayingBarEdgeGradientTuner({ isPlaying = false }: { isPlaying?: boolean }) {
  const { config, setConfig, resetConfig } = usePlayingBarEdgeGradient();
  const [visible, setVisible] = useState(() => isPlayingBarEdgeGradientTunerEnabled());
  const [collapsed, setCollapsed] = useState(false);

  const showPanel = (persist = true) => {
    setVisible(true);
    if (persist) persistPlayingBarEdgeGradientTunerVisible(true);
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('shaderDebug') === '1') {
      showPanel();
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'g' || !event.shiftKey) return;
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
        persistPlayingBarEdgeGradientTunerVisible(next);
        return next;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!import.meta.env.DEV) return null;

  const hidePanel = () => {
    setVisible(false);
    persistPlayingBarEdgeGradientTunerVisible(false);
  };

  return (
    <>
      {!visible && (
        <button
          type="button"
          className={`${styles.launcher} ${isPlaying ? styles.launcherActive : ''}`}
          onClick={() => showPanel()}
          aria-label="Open background radiance controls"
        >
          Radiance
        </button>
      )}

      {visible && (
        <aside className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}>
          <header className={styles.header}>
            <div>
              <h2 className={styles.title}>Background radiance</h2>
              <p className={styles.summary}>{configSummary(config)}</p>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setCollapsed((current) => !current)}
                aria-label={collapsed ? 'Expand tuning panel' : 'Collapse tuning panel'}
              >
                {collapsed ? '‹' : '›'}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={hidePanel}
                aria-label="Hide tuning panel"
              >
                ×
              </button>
            </div>
          </header>

          {!collapsed && (
            <div className={styles.body}>
              <p className={styles.hint}>
                Press Play to preview. Toggle with <kbd>Shift</kbd>+<kbd>G</kbd> or the Radiance chip
                (dev only).
              </p>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Opacity</h3>
                <SliderField
                  label="Wave opacity"
                  value={config.waveOpacity}
                  min={0.2}
                  max={1}
                  step={0.01}
                  displayValue={config.waveOpacity.toFixed(2)}
                  onChange={(waveOpacity) => setConfig({ waveOpacity })}
                />
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Background radiance</h3>
                <SliderField
                  label="Angle"
                  value={config.gradientAngle}
                  min={0}
                  max={360}
                  step={1}
                  unit="°"
                  displayValue={`${config.gradientAngle}°`}
                  onChange={(gradientAngle) => setConfig({ gradientAngle })}
                />
                <SliderField
                  label="Offset"
                  value={config.gradientOffset}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={config.gradientOffset.toFixed(2)}
                  onChange={(gradientOffset) => setConfig({ gradientOffset })}
                />
                <SliderField
                  label="Scale"
                  value={config.gradientScale}
                  min={0.1}
                  max={2}
                  step={0.01}
                  displayValue={config.gradientScale.toFixed(2)}
                  onChange={(gradientScale) => setConfig({ gradientScale })}
                />
                <SliderField
                  label="Midpoint"
                  value={config.gradientMidpoint}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={config.gradientMidpoint.toFixed(2)}
                  onChange={(gradientMidpoint) => setConfig({ gradientMidpoint })}
                />
                <SliderField
                  label="Softness"
                  value={config.gradientSoftness}
                  min={0.01}
                  max={1}
                  step={0.01}
                  displayValue={config.gradientSoftness.toFixed(2)}
                  onChange={(gradientSoftness) => setConfig({ gradientSoftness })}
                />
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Motion</h3>
                <ToggleField
                  label="Breathe"
                  checked={config.breatheEnabled}
                  onChange={(breatheEnabled) => setConfig({ breatheEnabled })}
                />
                <SliderField
                  label="Breath duration"
                  value={config.breathDurationSec}
                  min={4}
                  max={24}
                  step={0.5}
                  unit="s"
                  onChange={(breathDurationSec) => setConfig({ breathDurationSec })}
                />
                <SliderField
                  label="Wave height shift"
                  value={config.verticalOffset}
                  min={0}
                  max={0.6}
                  step={0.01}
                  displayValue={config.verticalOffset.toFixed(2)}
                  onChange={(verticalOffset) => setConfig({ verticalOffset })}
                />
                <SliderField
                  label="Edge rise"
                  value={config.edgeRise}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={config.edgeRise.toFixed(2)}
                  onChange={(edgeRise) => setConfig({ edgeRise })}
                />
              </div>

              <div className={styles.footer}>
                <button type="button" className={styles.resetButton} onClick={resetConfig}>
                  Reset defaults
                </button>
                <span className={styles.defaults}>
                  Defaults: {configSummary(DEFAULT_PLAYING_BAR_EDGE_GRADIENT)}
                </span>
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
