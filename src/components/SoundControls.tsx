import styles from './SoundControls.module.css';

type Props = {
  name: string;
  icon: string;
  volume: number;
  onVolumeChange: (volume: number) => void;
};

export function SoundControls({ name, icon, volume, onVolumeChange }: Props) {
  const percent = Math.round(volume * 100);

  return (
    <div className={styles.panel} aria-label={`Controls for ${name}`}>
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>
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
