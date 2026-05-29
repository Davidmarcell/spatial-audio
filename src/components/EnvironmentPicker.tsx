import type { Environment } from '../data/types';
import styles from './EnvironmentPicker.module.css';

type Props = {
  environments: Environment[];
  value: string;
  onChange: (environmentId: string) => void;
};

export function EnvironmentPicker({ environments, value, onChange }: Props) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>Environment</span>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Choose environment"
      >
        {environments.map((environment) => (
          <option key={environment.id} value={environment.id}>
            {environment.name}
          </option>
        ))}
      </select>
    </label>
  );
}
