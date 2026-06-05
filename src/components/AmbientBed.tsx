import { getSoundIconSrc } from '../data/iconArt';
import type { ActiveSound, BedSound, SoundDef } from '../data/types';
import { SoundIconImage } from './SoundIconImage';
import styles from './AmbientBed.module.css';

type Props = {
  bedSounds: BedSound[];
  activeSounds: ActiveSound[];
  soundMap: Map<string, SoundDef>;
  selectedSoundId: string | null;
  onVolumeChange: (soundId: string, volume: number) => void;
};

export function AmbientBed({
  bedSounds,
  activeSounds,
  soundMap,
  selectedSoundId,
  onVolumeChange,
}: Props) {
  if (bedSounds.length === 0) return null;

  return (
    <section className={styles.bed} aria-label="Ambient bed">
      <div className={styles.header}>
        <h2 className={styles.title}>Ambient bed</h2>
        <p className={styles.hint}>Drag icons on the grid · adjust volume here</p>
      </div>
      <div className={styles.tracks}>
        {bedSounds.map((item) => {
          const sound = soundMap.get(item.soundId);
          if (!sound) return null;

          const active = activeSounds.find((entry) => entry.soundId === item.soundId);
          const volume = active?.volume ?? item.volume;
          const percent = Math.round(volume * 100);
          const isSelected = selectedSoundId === item.soundId;

          return (
            <div
              key={item.soundId}
              className={`${styles.track} ${isSelected ? styles.trackSelected : ''}`}
            >
              <div className={styles.trackHeader}>
                <SoundIconImage
                  src={getSoundIconSrc(sound.id, active?.instanceId)}
                  alt=""
                  size="palette"
                />
                <span className={styles.name}>{sound.name}</span>
                <span className={styles.value}>{percent}%</span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={100}
                step={1}
                value={percent}
                aria-label={`${sound.name} bed volume`}
                onChange={(event) => onVolumeChange(item.soundId, Number(event.target.value) / 100)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
