import { UiIcon } from './UiIcon';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  computeOriginEnterOffset,
  DEFAULT_ENTER_OFFSET,
  originRectFromSnapshot,
  type OriginRectSnapshot,
} from '../utils/overlayOriginAnimation';
import styles from './ScaleBlurOverlay.module.css';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleId: string;
  closeLabel: string;
  children: ReactNode;
  wide?: boolean;
  extraPanelClassName?: string;
  bodyClassName?: string;
  /** Extra class for the backdrop element (e.g. to scope a blur to one overlay). */
  backdropClassName?: string;
  /** Keep scroll inside children instead of on the panel body. */
  lockBodyScroll?: boolean;
  /** Let pointer events reach the app behind (e.g. canvas drop targets during drag). */
  pointerPassThrough?: boolean;
  /** Live element to measure when opening (e.g. a trigger button ref). */
  originRef?: RefObject<HTMLElement | null>;
  /** Snapshot rect captured at open time; preferred over originRef when set. */
  originRect?: OriginRectSnapshot | null;
  /** Changes while open re-run the origin enter animation (e.g. sound detail swap). */
  swapKey?: string | number | null;
};

export function ScaleBlurOverlay({
  open,
  onOpenChange,
  title,
  titleId,
  closeLabel,
  children,
  wide = false,
  extraPanelClassName,
  bodyClassName,
  backdropClassName: extraBackdropClassName,
  pointerPassThrough = false,
  originRef,
  originRect,
  swapKey = null,
  lockBodyScroll = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const swapKeyRef = useRef<string | number | null>(null);
  const [isPresent, setIsPresent] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [enterOffset, setEnterOffset] = useState(DEFAULT_ENTER_OFFSET);

  const isActive = isPresent && open && !isClosing;

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const finishClose = useCallback(() => {
    setIsPresent(false);
    setIsClosing(false);
    setIsPanelOpen(false);
    previousFocusRef.current?.focus?.({ preventScroll: true });
    previousFocusRef.current = null;
  }, []);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setIsPresent(true);
      setIsClosing(false);
      return;
    }

    swapKeyRef.current = null;
    if (isPresent) {
      setIsClosing(true);
    }
  }, [open, isPresent]);

  useLayoutEffect(() => {
    if (!isActive) {
      setIsSwapping(false);
      setIsPanelOpen(false);
      return;
    }

    const resolvedOrigin = originRect
      ? originRectFromSnapshot(originRect)
      : (originRef?.current?.getBoundingClientRect() ?? null);

    if (resolvedOrigin) {
      setEnterOffset(computeOriginEnterOffset(resolvedOrigin));
    } else {
      setEnterOffset(DEFAULT_ENTER_OFFSET);
    }

    const isSwap =
      swapKeyRef.current !== null &&
      swapKey !== null &&
      swapKeyRef.current !== swapKey;
    swapKeyRef.current = swapKey;

    setIsSwapping(isSwap);
    setIsPanelOpen(false);

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIsPanelOpen(true);
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isActive, originRect, originRef, swapKey]);

  useEffect(() => {
    if (!isActive) return;

    const frame = window.requestAnimationFrame(() => {
      const closeButton = panelRef.current?.querySelector('button');
      (closeButton as HTMLElement | null)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, isActive]);

  const handleBackdropClick = useCallback(() => {
    close();
  }, [close]);

  const handlePanelTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.propertyName !== 'transform' || !isClosing) return;
      finishClose();
    },
    [finishClose, isClosing],
  );

  useEffect(() => {
    if (!isClosing) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) return;

    const timer = window.setTimeout(finishClose, 0);
    return () => window.clearTimeout(timer);
  }, [finishClose, isClosing]);

  if (!isPresent || typeof document === 'undefined') {
    return null;
  }

  const panelClassName = [
    styles.panel,
    wide ? styles.panelWide : '',
    extraPanelClassName ?? '',
    isPresent ? styles.panelVisible : '',
    isActive && isPanelOpen ? styles.panelOpen : '',
    isClosing ? styles.panelClosing : '',
    isSwapping ? styles.panelSwapping : '',
  ]
    .filter(Boolean)
    .join(' ');

  const backdropClassName = [
    styles.backdrop,
    isActive ? styles.backdropOpen : '',
    isClosing ? styles.backdropClosing : '',
    pointerPassThrough ? styles.pointerPassThrough : '',
    extraBackdropClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const panelStyle = {
    '--origin-enter-x': `${enterOffset.x}px`,
    '--origin-enter-y': `${enterOffset.y}px`,
  } as CSSProperties;

  return createPortal(
    <>
      <div
        className={backdropClassName}
        aria-hidden
        onClick={pointerPassThrough ? undefined : handleBackdropClick}
      />
      <div
        ref={panelRef}
        className={panelClassName}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        <header className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label={closeLabel}
            onClick={close}
          >
            <UiIcon icon="xmark" size="sm" className={styles.closeIcon} />
          </button>
        </header>
        <div
          className={[
            styles.body,
            lockBodyScroll ? styles.bodyLocked : '',
            bodyClassName ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
