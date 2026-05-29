import type { SoundDef } from '../data/types';
import styles from './SoundPalette.module.css';

type Props = {
  sounds: SoundDef[];
  activeSoundIds: string[];
  maxReached: boolean;
  onAdd: (sound: SoundDef) => void;
};

export function SoundPalette({ sounds, activeSoundIds, maxReached, onAdd }: Props) {
  return (
    <aside className={styles.palette} aria-label="Sound palette">
      <div className={styles.header}>
        <h2 className={styles.title}>Sounds</h2>
        <p className={styles.hint}>Click to place on the grid</p>
      </div>
      <ul className={styles.list}>
        {sounds.map((sound) => {
          const isActive = activeSoundIds.includes(sound.id);
          const disabled = isActive || maxReached;

          return (
            <li key={sound.id}>
              <button
                type="button"
                className={styles.item}
                disabled={disabled}
                onClick={() => onAdd(sound)}
                aria-label={`Add ${sound.name}`}
              >
                <span className={styles.icon} aria-hidden>
                  {sound.icon}
                </span>
                <span className={styles.meta}>
                  <span className={styles.name}>{sound.name}</span>
                  <span className={styles.category}>{sound.category}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {maxReached && (
        <p className={styles.limit}>Maximum of 6 sounds active. Remove one to add another.</p>
      )}
    </aside>
  );
}
