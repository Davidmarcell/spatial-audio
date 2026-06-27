import { UiIcon } from './UiIcon';
import styles from './MapButton.module.css';

type Props = {
  onClick: () => void;
};

export function MapButton({ onClick }: Props) {
  return (
    <button
      type="button"
      className={styles.mapButton}
      onClick={onClick}
      aria-label="World map"
      data-tooltip="World map"
    >
      <UiIcon icon="map" />
    </button>
  );
}
