import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ShareButton.module.css';

type Props = {
  onShare: () => Promise<string | null>;
  className?: string;
  onPointerEnter?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: () => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: () => void;
};

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <path
        d="M8 12l8-4.5v9L8 12zm0 0V8.5A2.5 2.5 0 0 1 10.5 6H18M8 12v3.5A2.5 2.5 0 0 0 10.5 18H18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
        <ShareIcon />
      </button>
      <span className={styles.live} role="status" aria-live="polite" aria-atomic="true">
        {status ?? ''}
      </span>
    </div>
  );
}
