import styles from './MapButton.module.css';

type Props = {
  onClick: () => void;
};

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <path
        d="M3 7.5 9 5l6 2.5 6-2.5v13l-6 2.5-6-2.5-6 2.5V7.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M9 5v13M15 7.5v13" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function MapButton({ onClick }: Props) {
  return (
    <button
      type="button"
      className={styles.mapButton}
      onClick={onClick}
      aria-label="World map"
      data-tooltip="World map"
    >
      <MapIcon />
    </button>
  );
}
