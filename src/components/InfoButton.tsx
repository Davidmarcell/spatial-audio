import { UiIcon } from './UiIcon';
import styles from './InfoButton.module.css';

type Props = {
  onClick: () => void;
  className?: string;
  onPointerEnter?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: () => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: () => void;
};

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
      <UiIcon icon="circle-info" />
    </button>
  );
}
