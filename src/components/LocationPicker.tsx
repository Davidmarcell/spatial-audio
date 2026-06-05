import type { AppLocation } from '../data/environments';
import styles from './LocationPicker.module.css';

type Props = {
  locations: AppLocation[];
  environmentId: string;
  regionId: string;
  onChange: (environmentId: string, regionId: string) => void;
  compact?: boolean;
};

export function LocationPicker({
  locations,
  environmentId,
  regionId,
  onChange,
  compact = false,
}: Props) {
  const value = `${environmentId}:${regionId}`;

  return (
    <label className={compact ? styles.fieldCompact : styles.field}>
      {!compact && <span className={styles.label}>Location</span>}
      <select
        className={compact ? styles.selectCompact : styles.select}
        value={value}
        onChange={(event) => {
          const [nextEnvironmentId, nextRegionId] = event.target.value.split(':');
          onChange(nextEnvironmentId, nextRegionId);
        }}
        aria-label="Choose location"
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </label>
  );
}
