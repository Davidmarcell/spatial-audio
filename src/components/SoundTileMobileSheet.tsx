import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { RegionArtContext } from '../data/iconArt';
import { SoundArtDetailContent, type DetailTarget } from './SoundArtDetail';
import styles from './SoundTileMobileSheet.module.css';

const OPEN_MS = 440;
const CLOSE_MS = 360;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.95;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DetailTarget | null;
  onVolumeChange: (instanceId: string, volume: number) => void;
  regionArt: RegionArtContext;
  onExited?: () => void;
};

/**
 * Mobile sound detail as an iOS-style bottom sheet: full-bleed, tall,
 * grab-handle, drag-down to dismiss.
 */
export function SoundTileMobileSheet({
  open,
  onOpenChange,
  target,
  onVolumeChange,
  regionArt,
  onExited,
}: Props) {
  const [isPresent, setIsPresent] = useState(open);
  const [isOpen, setIsOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [displayTarget, setDisplayTarget] = useState<DetailTarget | null>(target);
  const dragStartY = useRef(0);
  const dragStartAt = useRef(0);
  const lastY = useRef(0);
  const lastAt = useRef(0);
  const velocity = useRef(0);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open && target) {
      if (closeTimer.current != null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      setDisplayTarget(target);
      setIsPresent(true);
      setDragY(0);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    if (!open && isPresent) {
      setIsOpen(false);
      setDragY(0);
      closeTimer.current = window.setTimeout(() => {
        setIsPresent(false);
        setDisplayTarget(null);
        onExitedRef.current?.();
        closeTimer.current = null;
      }, CLOSE_MS);
    }
  }, [isPresent, open, target]);

  useEffect(() => {
    if (!open || !target) return;
    setDisplayTarget(target);
  }, [open, target]);

  useEffect(
    () => () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!isPresent || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, isPresent, open]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    dragStartY.current = event.clientY;
    dragStartAt.current = performance.now();
    lastY.current = event.clientY;
    lastAt.current = dragStartAt.current;
    velocity.current = 0;
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const now = performance.now();
    const dy = Math.max(0, event.clientY - dragStartY.current);
    const dt = Math.max(1, now - lastAt.current);
    velocity.current = (event.clientY - lastY.current) / dt;
    lastY.current = event.clientY;
    lastAt.current = now;
    setDragY(dy);
  };

  const onHandlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragY > DISMISS_DISTANCE || velocity.current > DISMISS_VELOCITY) {
      close();
      return;
    }
    setDragY(0);
  };

  if (!isPresent || !displayTarget || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`}
        style={{
          opacity: isOpen ? Math.max(0.08, 1 - dragY / 420) : 0,
        }}
        aria-label="Dismiss"
        onClick={close}
      />
      <div
        className={styles.sheet}
        style={{
          transform: isOpen ? `translate3d(0, ${dragY}px, 0)` : 'translate3d(0, 100%, 0)',
          transition: dragging
            ? 'none'
            : `transform ${isOpen ? OPEN_MS : CLOSE_MS}ms var(--ease-ios, cubic-bezier(0.32, 0.72, 0, 1))`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${displayTarget.name} details`}
      >
        <div
          className={styles.handleHit}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div className={styles.handle} aria-hidden />
        </div>
        <div className={styles.body}>
          <SoundArtDetailContent
            target={displayTarget}
            onVolumeChange={onVolumeChange}
            regionArt={regionArt}
            presentation="sheet"
            onClose={close}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
