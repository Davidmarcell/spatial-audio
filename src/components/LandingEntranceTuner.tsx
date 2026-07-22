import { useEffect, useState } from 'react';
import {
  DEFAULT_LANDING_ENTRANCE_CONFIG,
  isLandingEntranceTunerEnabled,
  landingEntranceSummary,
  LANDING_ENTRANCE_GROUPS,
  loadLandingEntranceSavedDefault,
  persistLandingEntranceTunerVisible,
  saveLandingEntranceConfigDefault,
  type LandingEntranceConfig,
} from '../utils/landingEntranceAnimation';
import styles from './LandingEntranceTuner.module.css';

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
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

type LandingEntranceTunerProps = {
  config: LandingEntranceConfig;
  onChange: (config: LandingEntranceConfig) => void;
  /** Replays the landing entrance in place (re-arms all one-shot latches). */
  onReplay: () => void;
};

export function LandingEntranceTuner({ config, onChange, onReplay }: LandingEntranceTunerProps) {
  const [visible, setVisible] = useState(() => isLandingEntranceTunerEnabled());
  const [collapsed, setCollapsed] = useState(false);
  const [savedDefault, setSavedDefault] = useState<LandingEntranceConfig | null>(() =>
    typeof window === 'undefined' ? null : loadLandingEntranceSavedDefault(),
  );

  const showPanel = (persist = true) => {
    setVisible(true);
    if (persist) persistLandingEntranceTunerVisible(true);
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('entranceDebug') === '1') showPanel();
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'e' || !event.shiftKey) return;
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
        persistLandingEntranceTunerVisible(next);
        return next;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!import.meta.env.DEV) return null;

  const hidePanel = () => {
    setVisible(false);
    persistLandingEntranceTunerVisible(false);
  };

  const patch = (next: Partial<LandingEntranceConfig>) => onChange({ ...config, ...next });

  return (
    <>
      <div className={styles.launcherDock}>
        <button
          type="button"
          className={`${styles.launcher} ${visible ? styles.launcherActive : ''}`}
          onClick={() => (visible ? hidePanel() : showPanel())}
          aria-pressed={visible}
          aria-label={visible ? 'Hide landing entrance controls' : 'Open landing entrance controls'}
        >
          Entrance
        </button>
      </div>

      {visible && (
        <aside className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}>
          <header className={styles.header}>
            <div>
              <h2 className={styles.title}>Landing entrance</h2>
              <p className={styles.summary}>{landingEntranceSummary(config)}</p>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setCollapsed((current) => !current)}
                aria-label={collapsed ? 'Expand entrance panel' : 'Collapse entrance panel'}
              >
                {collapsed ? '‹' : '›'}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={hidePanel}
                aria-label="Hide entrance panel"
              >
                ×
              </button>
            </div>
          </header>

          {!collapsed && (
            <div className={styles.body}>
              <p className={styles.hint}>
                Retime the landing loading sequence live, then hit <strong>Test</strong> to replay it
                in place. Toggle with <kbd>Shift</kbd>+<kbd>E</kbd> or <code>?entranceDebug=1</code>{' '}
                (dev only).
              </p>

              <button type="button" className={styles.replayButton} onClick={onReplay}>
                Test / replay entrance
              </button>

              {LANDING_ENTRANCE_GROUPS.map((group) => (
                <div key={group.title} className={styles.section}>
                  <h3 className={styles.sectionTitle}>{group.title}</h3>
                  {group.fields.map((f) => (
                    <SliderField
                      key={f.key}
                      label={f.label}
                      value={config[f.key]}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      unit={f.unit}
                      onChange={(value) => patch({ [f.key]: value } as Partial<LandingEntranceConfig>)}
                    />
                  ))}
                </div>
              ))}

              <div className={styles.footer}>
                <div className={styles.footerActions}>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => {
                      saveLandingEntranceConfigDefault(config);
                      setSavedDefault({ ...config });
                    }}
                  >
                    Save as default
                  </button>
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={() => onChange({ ...DEFAULT_LANDING_ENTRANCE_CONFIG })}
                  >
                    Reset
                  </button>
                </div>
                <span className={styles.defaults}>
                  {savedDefault
                    ? `Saved default: ${landingEntranceSummary(savedDefault)}`
                    : `No saved default · code default: ${landingEntranceSummary(
                        DEFAULT_LANDING_ENTRANCE_CONFIG,
                      )}`}
                </span>
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
