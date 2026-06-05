import { getSoundIconSrc } from '../data/iconArt';
import { SoundIconImage } from './SoundIconImage';
import styles from './SoundControls.module.css';

type Props = {
  name: string;
  soundId: string;
  variantKey?: string;
  volume: number;
  compact?: boolean;
  onVolumeChange: (volume: number) => void;
};

export function SoundControls({
  name,
  soundId,
  variantKey,
  volume,
  compact = false,
  onVolumeChange,
}: Props) {
  const percent = Math.round(volume * 100);

  return (
    <div
      className={`${styles.panel} ${compact ? styles.compact : ''}`}
      aria-label={`Controls for ${name}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={styles.header}>
        <SoundIconImage
          src={getSoundIconSrc(soundId, variantKey)}
          alt=""
          size={compact ? 'compact' : 'palette'}
        />
        <div>
          <p className={styles.name}>{name}</p>
          <p className={styles.hint}>Volume</p>
        </div>
        <span className={styles.value}>{percent}%</span>
      </div>
      <input
        type="range"
        className={styles.slider}
        min={0}
        max={100}
        step={1}
        value={percent}
        aria-label={`${name} volume`}
        onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
      />
    </div>
  );
}
