import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { WorldLocation } from '../data/worldLocations';
import { animateRise, prefersReducedMotion } from './sheetRise';
import styles from './GlobeMapSheet.module.css';

const GlobeExplorer = lazy(() =>
  import('./GlobeExplorer').then((module) => ({ default: module.GlobeExplorer })),
);

type Props = {
  open: boolean;
  /**
   * True for one shot while the globe is the OUTGOING page (globe close, or
   * globe -> location entry). It stays mounted and non-interactive and is gently
   * lifted + dimmed (see `.exiting`) beneath the rising cover panel, so the old
   * page visibly stays and pushes up rather than disappearing. The host unmounts
   * it once the panel has fully risen (`onCovered`).
   */
  exiting?: boolean;
  /** Fired once the globe has finished rising into place (approach-A open). */
  onEntered?: () => void;
  onOpenChange: (open: boolean) => void;
  locations: WorldLocation[];
  activeEnvironmentId: string;
  activeRegionId: string;
  activeLocationId?: string;
  onSelect: (location: WorldLocation) => void;
};

// The world map is a full-screen page (not a modal): it fills the viewport with
// its own themed surface and no dimmed backdrop behind it. As the INCOMING page
// it rises up from the bottom on top of whatever it opened over (the landing or
// the workspace, which stays visible and lifts beneath it) with the shared
// curved top edge; as the OUTGOING page it lifts and stays beneath the rising
// cover panel. The globe still respects the app theme via the global data-theme.
export function GlobeMapSheet({
  open,
  exiting = false,
  onEntered,
  onOpenChange,
  locations,
  activeEnvironmentId,
  activeRegionId,
  activeLocationId,
  onSelect,
}: Props) {
  // Present on screen while open, and kept mounted for one extra beat while the
  // exit lift plays (open flips false first, then the host clears `exiting`).
  const present = open || exiting;
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const onEnteredRef = useRef(onEntered);

  useEffect(() => {
    onEnteredRef.current = onEntered;
  });

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Approach-A rise: on open, the real globe page rises up from the bottom with
  // the shared curved top edge over the outgoing page beneath it, then settles
  // into a normal, interactive full-screen page (inline transform/clip cleared).
  useLayoutEffect(() => {
    if (!open || exiting) return undefined;
    const el = fullscreenRef.current;
    if (!el) return undefined;

    if (prefersReducedMotion()) {
      onEnteredRef.current?.();
      return undefined;
    }

    const cancel = animateRise(el, {
      onDone: () => {
        el.style.transform = '';
        el.style.clipPath = '';
        el.style.willChange = '';
        onEnteredRef.current?.();
      },
    });
    return () => {
      cancel();
      // If interrupted (e.g. closed mid-rise), drop the inline rise styles so the
      // `.exiting` lift is not fighting a leftover clip/transform.
      el.style.transform = '';
      el.style.clipPath = '';
      el.style.willChange = '';
    };
  }, [open, exiting]);

  if (!present || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={fullscreenRef}
      className={`${styles.fullscreen} ${exiting ? styles.exiting : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="World map"
    >
      <Suspense
        fallback={
          <div className={styles.loading} role="status" aria-live="polite">
            Loading world map...
          </div>
        }
      >
        <GlobeExplorer
          locations={locations}
          activeEnvironmentId={activeEnvironmentId}
          activeRegionId={activeRegionId}
          activeLocationId={activeLocationId}
          onSelect={onSelect}
          onClose={() => onOpenChange(false)}
          showCloseButton
        />
      </Suspense>
    </div>,
    document.body,
  );
}
