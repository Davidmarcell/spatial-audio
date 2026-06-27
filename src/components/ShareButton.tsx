import { useCallback, useEffect, useRef, useState } from 'react';
import { UiIcon } from './UiIcon';
import styles from './ShareButton.module.css';

type Props = {
  onShare: () => Promise<string | null>;
  className?: string;
  onPointerEnter?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: () => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: () => void;
};

export function ShareButton({
  onShare,
  className,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setStatus(null);
      timerRef.current = null;
    }, 2400);
  }, []);

  const handleClick = useCallback(async () => {
    const url = await onShare();
    if (!url) {
      showStatus('Nothing to share yet');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showStatus('Link copied');
    } catch {
      showStatus('Copy the link from the address bar');
    }
  }, [onShare, showStatus]);

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.shareButton}
        onClick={() => void handleClick()}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-label="Share soundscape"
        data-tooltip="Share soundscape"
      >
        <UiIcon icon="arrow-up-from-bracket" />
      </button>
      <span className={styles.live} role="status" aria-live="polite" aria-atomic="true">
        {status ?? ''}
      </span>
    </div>
  );
}
