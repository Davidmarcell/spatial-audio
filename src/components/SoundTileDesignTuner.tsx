import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { RegionArtContext } from '../data/iconArt';
import { SoundArtDetailContent, type DetailTarget } from './SoundArtDetail';
import {
  DEFAULT_SOUND_TILE_DESIGN,
  isSoundTileTunerVisible,
  loadSoundTileDesign,
  persistSoundTileTunerVisible,
  saveSoundTileDesign,
  soundTileDesignSummary,
  soundTileDesignToCssVars,
  type SoundTileDesignConfig,
} from './soundTileDesign';
import styles from './SoundTileDesignTuner.module.css';

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
};

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: SliderProps) {
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

type Props = {
  /** Live region art context so the preview uses a real tile image. */
  regionArt: RegionArtContext;
  /** Optional real tile to preview; falls back to a sample target. */
  sampleTarget?: DetailTarget | null;
};

export function SoundTileDesignTuner({ regionArt, sampleTarget = null }: Props) {
  const [visible, setVisible] = useState(() => isSoundTileTunerVisible());
  const [collapsed, setCollapsed] = useState(false);
  const [config, setConfig] = useState<SoundTileDesignConfig>(() => loadSoundTileDesign());

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('soundTileDebug') === '1') {
      setVisible(true);
      persistSoundTileTunerVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 't' || !event.shiftKey) return;
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
        persistSoundTileTunerVisible(next);
        return next;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const previewTarget = useMemo<DetailTarget>(
    () =>
      sampleTarget ?? {
        instanceId: 'sound-tile-design-preview',
        soundId: regionArt.soundIds[0] ?? 'global-wind',
        name: 'Zócalo Market',
        volume: 0.34,
      },
    [regionArt.soundIds, sampleTarget],
  );

  if (!import.meta.env.DEV) return null;

  const showPanel = () => {
    setVisible(true);
    persistSoundTileTunerVisible(true);
  };

  const hidePanel = () => {
    setVisible(false);
    persistSoundTileTunerVisible(false);
  };

  const patch = (next: Partial<SoundTileDesignConfig>) => {
    setConfig((current) => {
      const merged = { ...current, ...next };
      saveSoundTileDesign(merged);
      return merged;
    });
  };

  const previewStyle = soundTileDesignToCssVars(config) as CSSProperties;

  return (
    <>
      <div className={styles.launcherDock}>
        <button
          type="button"
          className={`${styles.launcher} ${visible ? styles.launcherActive : ''}`}
          onClick={() => (visible ? hidePanel() : showPanel())}
          aria-pressed={visible}
          aria-label={visible ? 'Hide SoundTile design controls' : 'Open SoundTile design controls'}
        >
          SoundTile
        </button>
      </div>

      {visible && (
        <>
          <div className={styles.previewStage} aria-hidden={!visible}>
            <div className={styles.previewCard} style={previewStyle}>
              <SoundArtDetailContent
                target={previewTarget}
                onVolumeChange={() => {
                  /* design sandbox: volume is visual only */
                }}
                regionArt={regionArt}
                designConfig={config}
              />
            </div>
          </div>

          <aside className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}>
            <header className={styles.header}>
              <div>
                <h2 className={styles.title}>Sound tile</h2>
                <p className={styles.summary}>{soundTileDesignSummary(config)}</p>
              </div>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setCollapsed((value) => !value)}
                  aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
                >
                  {collapsed ? '+' : '–'}
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={hidePanel}
                  aria-label="Close SoundTile design controls"
                >
                  ×
                </button>
              </div>
            </header>

            {!collapsed && (
              <div className={styles.body}>
                <p className={styles.hint}>
                  Live design spin for the sound-detail card. Knobs save to
                  localStorage and apply the next time you open a real tile.
                  Shortcut: Shift+T.
                </p>

                <SliderField
                  label="Card radius"
                  value={config.cardRadiusPx}
                  min={12}
                  max={56}
                  unit="px"
                  onChange={(cardRadiusPx) => patch({ cardRadiusPx })}
                />
                <SliderField
                  label="Image radius"
                  value={config.imageRadiusPx}
                  min={8}
                  max={40}
                  unit="px"
                  onChange={(imageRadiusPx) => patch({ imageRadiusPx })}
                />
                <SliderField
                  label="Padding"
                  value={config.paddingPx}
                  min={10}
                  max={40}
                  unit="px"
                  onChange={(paddingPx) => patch({ paddingPx })}
                />
                <SliderField
                  label="Image size"
                  value={config.imageSizePx}
                  min={180}
                  max={360}
                  unit="px"
                  onChange={(imageSizePx) => patch({ imageSizePx })}
                />
                <SliderField
                  label="Column gap"
                  value={config.columnGapPx}
                  min={12}
                  max={48}
                  unit="px"
                  onChange={(columnGapPx) => patch({ columnGapPx })}
                />
                <SliderField
                  label="Panel width"
                  value={config.panelWidthRem}
                  min={28}
                  max={56}
                  step={0.5}
                  unit="rem"
                  onChange={(panelWidthRem) => patch({ panelWidthRem })}
                />

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => {
                      setConfig({ ...DEFAULT_SOUND_TILE_DESIGN });
                      saveSoundTileDesign(DEFAULT_SOUND_TILE_DESIGN);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
