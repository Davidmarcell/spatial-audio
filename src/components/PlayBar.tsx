import styles from './PlayBar.module.css';

type Props = {
  isPlaying: boolean;
  onToggle: () => void;
};

export function PlayBar({ isPlaying, onToggle }: Props) {
  return (
    <div className={styles.bar}>
      <button type="button" className={styles.button} onClick={onToggle}>
        {isPlaying ? 'Pause' : 'Resume'}
      </button>
    </div>
  );
}
