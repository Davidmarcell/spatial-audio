import { useEffect, useRef, useState } from 'react';
import type { RegionArtContext } from '../data/iconArt';
import type { OriginRectSnapshot } from '../utils/overlayOriginAnimation';
import { ScaleBlurOverlay } from './ScaleBlurOverlay';
import { SoundArtDetailContent, type DetailTarget } from './SoundArtDetail';
import styles from './SoundArtDetailSheet.module.css';

const CONTENT_SWAP_MS = 460;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originRect?: OriginRectSnapshot | null;
  target: DetailTarget | null;
  onVolumeChange: (instanceId: string, volume: number) => void;
  regionArt: RegionArtContext;
};

export function SoundArtDetailSheet({
  open,
  onOpenChange,
  originRect,
  target,
  onVolumeChange,
  regionArt,
}: Props) {
  const [displayTarget, setDisplayTarget] = useState<DetailTarget | null>(target);
  const [contentPhase, setContentPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const wasOpenRef = useRef(open);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    // While closing, keep the last content (and title) mounted so the panel
    // retains its full height and fades/scales out cleanly. Clearing it here
    // would collapse the panel to a header-only "Sound" pill for a frame.
    if (!open) {
      setContentPhase('idle');
      return;
    }

    // Fresh open (was closed): show the target immediately with no swap so the
    // origin-enter animation plays instead of a stale-content cross-fade.
    if (!target || !wasOpen || !displayTarget || displayTarget.instanceId === target.instanceId) {
      setDisplayTarget(target);
      setContentPhase('idle');
      return;
    }

    // Already open and the target changed → cross-fade to the new sound.
    setContentPhase('out');
    const timer = window.setTimeout(() => {
      setDisplayTarget(target);
      setContentPhase('in');
    }, CONTENT_SWAP_MS * 0.42);

    return () => window.clearTimeout(timer);
  }, [displayTarget, open, target]);

  useEffect(() => {
    if (contentPhase !== 'in') return;
    const timer = window.setTimeout(() => setContentPhase('idle'), CONTENT_SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [contentPhase, displayTarget?.instanceId]);

  const name = target?.name ?? displayTarget?.name ?? 'Sound';
  const contentClassName = [
    styles.content,
    contentPhase === 'out' ? styles.contentOut : '',
    contentPhase === 'in' ? styles.contentIn : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ScaleBlurOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      titleId="art-detail-overlay-title"
      closeLabel={`Close ${name} details`}
      wide
      lockBodyScroll
      bodyClassName={styles.body}
      originRect={originRect}
      swapKey={target?.instanceId ?? null}
    >
      {displayTarget && (
        <div className={contentClassName}>
          <SoundArtDetailContent
            target={displayTarget}
            onVolumeChange={onVolumeChange}
            regionArt={regionArt}
          />
        </div>
      )}
    </ScaleBlurOverlay>
  );
}

export type { DetailTarget };
