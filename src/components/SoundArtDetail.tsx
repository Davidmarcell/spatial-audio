import type { CSSProperties } from 'react';
import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
import { SoundIconImage } from './SoundIconImage';
import {
  loadSoundTileDesign,
  shortArtworkSourceLabel,
  soundTileDesignToCssVars,
  type SoundTileDesignConfig,
} from './soundTileDesign';
import styles from './SoundArtDetail.module.css';

export type DetailTarget = {
  instanceId: string;
  soundId: string;
  name: string;
  volume: number;
};

type Props = {
  target: DetailTarget;
  onVolumeChange: (instanceId: string, volume: number) => void;
  regionArt: RegionArtContext;
  /** Optional live design tokens (DEV tuner). Falls back to saved defaults. */
  designConfig?: SoundTileDesignConfig;
  onClose?: () => void;
  /** Mobile iOS bottom-sheet presentation (taller, edge-to-edge). */
  presentation?: 'card' | 'sheet';
  /** Hide artwork while a shared-element face covers the same slot. */
  artworkHidden?: boolean;
  /** Fade the meta/volume column during card-expand (0–1). */
  infoOpacity?: number;
};

export function SoundArtDetailContent({
  target,
  onVolumeChange,
  regionArt,
  designConfig,
  onClose,
  presentation = 'card',
  artworkHidden = false,
  infoOpacity = 1,
}: Props) {
  const artwork = getSoundArtworkForRegion(
    regionArt.id,
    regionArt.soundIds,
    target.soundId,
    target.instanceId,
    regionArt.tags,
  );
  const percent = Math.round(target.volume * 100);
  const sourceLabel = shortArtworkSourceLabel(artwork.sourceUrl);
  const designStyle = soundTileDesignToCssVars(
    designConfig ?? loadSoundTileDesign(),
  ) as CSSProperties;

  return (
    <div
      className={`${styles.root} ${presentation === 'sheet' ? styles.sheetPresentation : ''}`}
      style={designStyle}
    >
      {onClose && (
        <button
          type="button"
          className={styles.close}
          aria-label={`Close ${target.name} details`}
          onClick={onClose}
        >
          <span className={styles.closeIcon} aria-hidden>
            ×
          </span>
        </button>
      )}

      <div className={`${styles.artworkWrap} ${artworkHidden ? styles.artworkHidden : ''}`}>
        <div className={styles.artwork}>
          <SoundIconImage
            src={artwork.src}
            sourceUrl={artwork.sourceUrl}
            detailSrc={artwork.detailSrc}
            alt={artwork.title}
            soundId={target.soundId}
            size="detailNatural"
          />
        </div>
      </div>

      <div
        className={styles.infoColumn}
        style={
          infoOpacity < 1
            ? { opacity: infoOpacity, transform: `translateY(${(1 - infoOpacity) * 12}px)` }
            : undefined
        }
      >
        <div className={styles.scroll}>
          <h3 className={styles.title}>{target.name}</h3>

          <dl className={styles.meta}>
            <div className={styles.metaRow}>
              <dt className={styles.metaLabel}>Title</dt>
              <dd className={styles.metaValue}>{artwork.title}</dd>
            </div>
            <div className={styles.metaRow}>
              <dt className={styles.metaLabel}>Artist</dt>
              <dd className={styles.metaValue}>{artwork.author}</dd>
            </div>
            <div className={styles.metaRow}>
              <dt className={styles.metaLabel}>Source</dt>
              <dd className={styles.metaValue}>
                <a
                  className={styles.sourceLink}
                  href={artwork.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span>{sourceLabel}</span>
                  <span className={styles.sourceArrow} aria-hidden>
                    ↗
                  </span>
                </a>
              </dd>
            </div>
          </dl>

          <section className={styles.volumeBlock}>
            <div className={styles.volumeHeader}>
              <p className={styles.volumeLabel}>Volume</p>
              <span className={styles.volumeValue}>{percent}%</span>
            </div>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={100}
              step={1}
              value={percent}
              aria-label={`${target.name} volume`}
              onChange={(event) =>
                onVolumeChange(target.instanceId, Number(event.target.value) / 100)
              }
            />
          </section>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use SoundArtDetailSheet */
export function SoundArtDetail(props: Props) {
  return <SoundArtDetailContent {...props} />;
}
