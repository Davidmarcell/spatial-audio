import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
import { getSoundBlurb } from '../data/soundBlurbs';
import type { SoundDef } from '../data/types';
import { SoundIconImage } from './SoundIconImage';
import styles from './SoundArtDetail.module.css';

export type DetailTarget = {
  instanceId: string;
  soundId: string;
  name: string;
  volume: number;
};

type Props = {
  target: DetailTarget;
  sound?: SoundDef;
  onClose: () => void;
  onVolumeChange: (instanceId: string, volume: number) => void;
  regionArt: RegionArtContext;
};

export function SoundArtDetailContent({
  target,
  sound,
  onClose,
  onVolumeChange,
  regionArt,
}: Props) {
  const artwork = getSoundArtworkForRegion(
    regionArt.id,
    regionArt.soundIds,
    target.soundId,
    target.instanceId,
  );
  const blurb = getSoundBlurb(target.soundId);
  const percent = Math.round(target.volume * 100);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>Sound</p>
          <h2 id="art-detail-title" className={styles.title}>
            {target.name}
          </h2>
          {sound && <p className={styles.categoryHint}>{sound.category}</p>}
        </div>
        <button type="button" className={styles.dismiss} aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

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

      <div className={styles.scroll}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>About this sound</h3>
          <p className={styles.body}>{blurb}</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Illustration</h3>
          <dl className={styles.meta}>
            <div>
              <dt>Title</dt>
              <dd>{artwork.title}</dd>
            </div>
            <div>
              <dt>Artist</dt>
              <dd>{artwork.author}</dd>
            </div>
            {artwork.medium && (
              <div>
                <dt>Medium</dt>
                <dd>{artwork.medium}</dd>
              </div>
            )}
            <div>
              <dt>License</dt>
              <dd>{artwork.license}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                <a href={artwork.sourceUrl} target="_blank" rel="noreferrer">
                  View original
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <div className={styles.volumeHeader}>
            <h3 className={styles.sectionTitle}>Volume</h3>
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
    </>
  );
}

/** @deprecated Use SoundArtDetailSheet */
export function SoundArtDetail(props: Props) {
  return <SoundArtDetailContent {...props} />;
}
