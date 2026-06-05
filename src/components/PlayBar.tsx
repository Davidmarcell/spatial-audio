import styles from './PlayBar.module.css';

type Props = {
  isPlaying: boolean;
  onToggle: () => void;
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <path d="M9 7.5v9l7.5-4.5L9 7.5Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <path d="M8 7.5h3v9H8v-9ZM13 7.5h3v9h-3v-9Z" fill="currentColor" />
    </svg>
  );
}

export function PlayBar({ isPlaying, onToggle }: Props) {
  const label = isPlaying ? 'Pause' : 'Play';

  return (
    <button
      type="button"
      className={styles.button}
      onClick={onToggle}
      aria-label={label}
      data-tooltip={label}
    >
      {isPlaying ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}
