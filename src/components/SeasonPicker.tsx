import type { Season } from '../data/types';
import styles from './SeasonPicker.module.css';

const SEASONS: Array<{ id: Season; label: string }> = [
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'fall', label: 'Fall' },
  { id: 'winter', label: 'Winter' },
];

type Props = {
  value: Season;
  onChange: (season: Season) => void;
  disabled?: boolean;
};

/** v0 stub — UI only; palette filtering wired in AddSoundSheet, not dock defaults yet. */
export function SeasonPicker({ value, onChange, disabled }: Props) {
  return (
    <div className={styles.root} role="group" aria-label="Bird season">
      <span className={styles.label}>Season</span>
      <div className={styles.segments}>
        {SEASONS.map((season) => (
          <button
            key={season.id}
            type="button"
            className={`${styles.segment} ${value === season.id ? styles.segmentActive : ''}`}
            aria-pressed={value === season.id}
            disabled={disabled}
            onClick={() => onChange(season.id)}
          >
            {season.label}
          </button>
        ))}
      </div>
    </div>
  );
}
