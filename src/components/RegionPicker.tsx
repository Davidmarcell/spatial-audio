import type { Region } from '../data/types';
import styles from './RegionPicker.module.css';

type Props = {
  regions: Region[];
  value: string;
  onChange: (regionId: string) => void;
};

export function RegionPicker({ regions, value, onChange }: Props) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>Region</span>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Choose region"
      >
        {regions.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name}
          </option>
        ))}
      </select>
    </label>
  );
}
