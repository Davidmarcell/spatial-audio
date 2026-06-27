import { type FocusEventHandler, forwardRef, type PointerEventHandler } from 'react';
import { UiIcon } from './UiIcon';
import styles from './AddSoundButton.module.css';

type Props = {
  onClick: (originRect: DOMRect) => void;
  size?: number;
  scale?: number;
  onPointerEnter?: PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: PointerEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
};

export const AddSoundButton = forwardRef<HTMLButtonElement, Props>(function AddSoundButton(
  { onClick, size = 56, scale = 1, onPointerEnter, onPointerLeave, onFocus, onBlur },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.button}
      style={{ width: `${size}px`, height: `${size}px`, transform: `scale(${scale})` }}
      onClick={(event) => onClick(event.currentTarget.getBoundingClientRect())}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label="Add sound"
      data-tooltip="Add sound"
    >
      <UiIcon icon="plus" size="lg" />
    </button>
  );
});
