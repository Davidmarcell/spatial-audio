import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { animateRise, prefersReducedMotion, SHEET_REVEAL_FADE_MS } from './sheetRise';
import styles from './EnterTransition.module.css';

type Props = {
  /**
   * True for one shot for navigations where the incoming page cannot be stacked
   * above the outgoing one (globe close -> landing/workspace, globe -> location,
   * landing -> location, home). A solid panel painted in the page background
   * RISES up from the bottom, on top of the outgoing page (which stays mounted
   * and lifts beneath it), with an upward-bending curved TOP edge, so it reads
   * as the next page sweeping up over the old one. Set back to false in `onDone`.
   */
  active: boolean;
  /**
   * Fired the instant the panel has fully risen into a flat, full-viewport
   * cover. The host uses this to unmount the outgoing page (the lifted globe /
   * landing) so the following cross-fade reveals the true destination beneath
   * rather than the outgoing layer.
   */
  onCovered?: () => void;
  /** Fired once the cover has cross-faded away, so the host can unmount it. */
  onDone: () => void;
};

/**
 * Stacked-sheet cover panel. It does NOT pre-cover the screen: it starts fully
 * below the viewport and rises up over the outgoing page (which lifts and stays
 * visible above the rising curved edge the whole time), then, once it fully
 * covers, cross-fades out to reveal the destination mounted beneath. This is the
 * corrected model: the old page stays and lifts, the new surface rises up on top
 * of it with the curved leading edge, instead of an opaque panel blanking the
 * screen from the start.
 *
 * The rise (translate) and the curved top edge (an animated clip-path) are
 * driven from one rAF clock in `animateRise`, matching the app's strong ease.
 *
 * Reduced motion: skip the rise/curve and do a quick cross-fade (cover, hand
 * over the "covered" beat, reveal) that still fires `onCovered`/`onDone`.
 */
export function EnterTransition({ active, onCovered, onDone }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();
  const onCoveredRef = useRef(onCovered);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onCoveredRef.current = onCovered;
    onDoneRef.current = onDone;
  });

  useLayoutEffect(() => {
    if (!active) return undefined;
    const overlay = overlayRef.current;
    if (!overlay) return undefined;

    let cancelled = false;
    let fadeTimer = 0;

    // The panel now fully covers the viewport: hand the "covered" beat to the
    // host (so it unmounts the outgoing page beneath), then cross-fade the cover
    // out to softly reveal the destination.
    const revealAfterCover = () => {
      if (cancelled) return;
      onCoveredRef.current?.();
      overlay.style.transition = `opacity ${SHEET_REVEAL_FADE_MS}ms linear`;
      requestAnimationFrame(() => {
        if (!cancelled) overlay.style.opacity = '0';
      });
      fadeTimer = window.setTimeout(() => {
        if (!cancelled) onDoneRef.current();
      }, SHEET_REVEAL_FADE_MS + 20);
    };

    if (reduced) {
      overlay.style.transform = 'none';
      overlay.style.clipPath = 'none';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 120ms linear';
      requestAnimationFrame(() => {
        if (!cancelled) overlay.style.opacity = '1';
      });
      fadeTimer = window.setTimeout(revealAfterCover, 140);
      return () => {
        cancelled = true;
        window.clearTimeout(fadeTimer);
      };
    }

    const cancelRise = animateRise(overlay, { onDone: revealAfterCover });
    return () => {
      cancelled = true;
      cancelRise();
      window.clearTimeout(fadeTimer);
    };
  }, [active, reduced]);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={overlayRef} className={styles.overlay} aria-hidden="true" />,
    document.body,
  );
}
