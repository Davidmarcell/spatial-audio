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
};

export function SoundArtDetailContent({
  target,
  onVolumeChange,
  regionArt,
  designConfig,
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
    <div className={styles.root} style={designStyle}>
      <div className={styles.artwork}>
        <SoundIconImage
          src={artwork.src}
          sourceUrl={artwork.sourceUrl}
          detailSrc={artwork.detailSrc}
          alt={target.name}
          soundId={target.soundId}
          size="detail"
        />
      </div>

      <div className={styles.infoColumn}>
        <div className={styles.scroll}>
          <h3 className={styles.title}>{target.name}</h3>

          <dl className={styles.meta}>
            <div className={styles.metaRow}>
              <dt className={styles.metaLabel}>Illustration</dt>
              <dd className={styles.metaValue}>{artwork.title}</dd>
            </div>
            <div className={styles.metaRow}>
              <dt className={styles.metaLabel}>Source</dt>
              <dd className={styles.metaValue}>
                <a
                  href={artwork.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {sourceLabel}
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
