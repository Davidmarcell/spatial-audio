import styles from './AboutButton.module.css';

type Props = {
  onClick: () => void;
  className?: string;
};

export function AboutButton({ onClick, className }: Props) {
  return (
    <button
      type="button"
      className={[styles.aboutButton, className].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-label="About and attributions"
    >
      <span className={styles.label}>About</span>
    </button>
  );
}
