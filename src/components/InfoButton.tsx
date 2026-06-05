import styles from './InfoButton.module.css';

type Props = {
  onClick: () => void;
  className?: string;
  onPointerEnter?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: () => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: () => void;
};

function InfoCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 11v5M12 8.5h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InfoButton({
  onClick,
  className,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
}: Props) {
  return (
    <button
      type="button"
      className={[styles.infoButton, className].filter(Boolean).join(' ')}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label="Attributions"
      data-tooltip="Attributions"
    >
      <InfoCircleIcon />
    </button>
  );
}
