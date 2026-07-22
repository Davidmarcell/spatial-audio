import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { RegionArtContext } from '../data/iconArt';
import type { OriginRectSnapshot } from '../utils/overlayOriginAnimation';
import { ScaleBlurOverlay } from './ScaleBlurOverlay';
import { SoundArtDetailContent, type DetailTarget } from './SoundArtDetail';
import { SoundTileCardExpand } from './SoundTileCardExpand';
import {
  loadSoundTileDesign,
  soundTileDesignToCssVars,
} from './soundTileDesign';
import styles from './SoundArtDetailSheet.module.css';

const CONTENT_SWAP_MS = 460;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originRect?: OriginRectSnapshot | null;
  target: DetailTarget | null;
  onVolumeChange: (instanceId: string, volume: number) => void;
  regionArt: RegionArtContext;
  /** Prefer the shared-element card expand when an origin rect is available. */
  useCardExpand?: boolean;
  onExpandExited?: () => void;
};

export function SoundArtDetailSheet({
  open,
  onOpenChange,
  originRect,
  target,
  onVolumeChange,
  regionArt,
  useCardExpand = true,
  onExpandExited,
}: Props) {
  const [displayTarget, setDisplayTarget] = useState<DetailTarget | null>(target);
  const [contentPhase, setContentPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const wasOpenRef = useRef(open);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (!open) {
      setContentPhase('idle');
      return;
    }

    if (!target || !wasOpen || !displayTarget || displayTarget.instanceId === target.instanceId) {
      setDisplayTarget(target);
      setContentPhase('idle');
      return;
    }

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

  const panelStyle = useMemo(
    () => soundTileDesignToCssVars(loadSoundTileDesign()) as CSSProperties,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, target?.instanceId],
  );

  // Shared-element card expand (tile → detail card). Always use this path when
  // enabled so the reverse collapse can finish after `open` flips false.
  if (useCardExpand) {
    return (
      <SoundTileCardExpand
        open={open}
        onOpenChange={onOpenChange}
        originRect={originRect ?? null}
        target={target}
        onVolumeChange={onVolumeChange}
        regionArt={regionArt}
        onExited={onExpandExited}
      />
    );
  }

  return (
    <ScaleBlurOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      titleId="art-detail-overlay-title"
      closeLabel={`Close ${name} details`}
      hideTitle
      lockBodyScroll
      bodyClassName={styles.body}
      extraPanelClassName={styles.panel}
      headerClassName={styles.headerHidden}
      panelStyle={panelStyle}
      originRect={originRect}
      swapKey={target?.instanceId ?? null}
    >
      {displayTarget && (
        <div className={contentClassName}>
          <SoundArtDetailContent
            target={displayTarget}
            onVolumeChange={onVolumeChange}
            regionArt={regionArt}
            onClose={() => onOpenChange(false)}
          />
        </div>
      )}
    </ScaleBlurOverlay>
  );
}

export type { DetailTarget };
