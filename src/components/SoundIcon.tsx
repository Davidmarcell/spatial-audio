import { useRef, type CSSProperties } from 'react';
import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
import {
  depthZIndex,
  distanceFromListener,
  normalizedToPercent,
  scaleFromDistance,
} from '../audio/spatialMath';
import type { SpatialPoint } from '../data/types';
import { SoundIconImage } from './SoundIconImage';
import { UiIcon } from './UiIcon';
import styles from './SoundIcon.module.css';

type Props = {
  instanceId: string;
  soundId: string;
  name: string;
  position: SpatialPoint;
  sway: number;
  isDragging: boolean;
  /**
   * When true, the tile plays its entrance ("radiate out") animation: it starts
   * small and faded at the listener centre and glides to its resting position.
   */
  entering?: boolean;
  /** Per-tile stagger (ms) so tiles further out land a touch later. */
  entranceDelayMs?: number;
  selected: boolean;
  /**
   * Hide the real canvas tile while its floating dock mirror (portal ghost) is
   * on screen, so the tile is never shown twice at once. Kept in layout so the
   * mirror can still measure its position/size.
   */
  hiddenForGhost?: boolean;
  /**
   * Hide while the shared-element card expand is in flight / open for this
   * instance, so the clone is the only visible tile.
   */
  hiddenForDetailExpand?: boolean;
  regionArt: RegionArtContext;
  onSelect: (instanceId: string) => void;
  onRemove: (instanceId: string, iconRect: DOMRect, dropPoint?: { x: number; y: number }) => void;
  onOpenDetail: (instanceId: string, originRect: DOMRect | null) => void;
  onPointerDown: (instanceId: string, event: React.PointerEvent<HTMLButtonElement>) => void;
};

export function SoundIcon({
  instanceId,
  soundId,
  name,
  position,
  sway,
  isDragging,
  entering = false,
  entranceDelayMs = 0,
  selected,
  hiddenForGhost = false,
  hiddenForDetailExpand = false,
  onSelect,
  onRemove,
  onOpenDetail,
  onPointerDown,
  regionArt,
}: Props) {
  const iconRef = useRef<HTMLButtonElement>(null);
  const { left, top } = normalizedToPercent(position);
  // Vector from the tile's resting spot back to the listener centre (50%, 50%),
  // expressed in container-query units so the entrance offset tracks the canvas
  // size. The tile animates from this offset (at centre) to zero (at rest).
  const leftPercent = ((position.x + 1) / 2) * 100;
  const topPercent = (1 - position.y) * 100;
  const entranceDx = 50 - leftPercent;
  const entranceDy = 50 - topPercent;
  const swayDeg = (sway * 180) / Math.PI;
  const distance = distanceFromListener(position);
  const proximityScale = scaleFromDistance(distance);
  const dragBoost = isDragging ? 1.06 : 1;
  const scale = proximityScale * dragBoost;

  const handleDismiss = (event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) onRemove(instanceId, rect);
  };

  const handleOpenDetail = (event: React.MouseEvent) => {
    event.stopPropagation();
    onSelect(instanceId);
    const rect = iconRef.current?.getBoundingClientRect() ?? null;
    onOpenDetail(instanceId, rect);
  };

  const artwork = getSoundArtworkForRegion(
    regionArt.id,
    regionArt.soundIds,
    soundId,
    instanceId,
    regionArt.tags,
  );

  return (
    <div
      className={`${styles.wrapper} ${selected ? styles.selected : ''} ${isDragging ? styles.dragging : ''} ${entering ? styles.entering : ''}`}
      style={{
        left,
        top,
        zIndex: isDragging ? 470 : depthZIndex(distance),
        visibility: hiddenForGhost || hiddenForDetailExpand ? 'hidden' : undefined,
        ...(entering
          ? ({
              '--entrance-dx': `${entranceDx}cqw`,
              '--entrance-dy': `${entranceDy}cqh`,
              '--entrance-delay': `${entranceDelayMs}ms`,
            } as CSSProperties)
          : {}),
      }}
      data-instance-id={instanceId}
    >
      <div
        className={`${styles.iconBody} ${isDragging ? styles.iconBodyDragging : ''}`}
        style={{
          transform: `rotate(${swayDeg}deg) scale(${scale})`,
        }}
      >
        <button
          ref={iconRef}
          type="button"
          className={styles.icon}
          data-sound-icon
          aria-label={`${name}. Drag to reposition. Click for details.`}
          aria-pressed={selected}
          onClick={() => {
            onSelect(instanceId);
          }}
          onPointerDown={(event) => onPointerDown(instanceId, event)}
        >
          <SoundIconImage
            src={artwork.src}
            sourceUrl={artwork.sourceUrl}
            detailSrc={artwork.detailSrc}
            alt={name}
            soundId={soundId}
            size="canvas"
          />
          <span className={styles.hoverOverlay} aria-hidden>
            <span
              className={`${styles.actionButton} ${styles.actionLeft}`}
              role="presentation"
            >
              <UiIcon icon="eye" size="xs" />
            </span>
            <span
              className={`${styles.actionButton} ${styles.actionRight}`}
              role="presentation"
            >
              <UiIcon icon="xmark" size="xs" />
            </span>
          </span>
        </button>

        <button
          type="button"
          className={`${styles.actionHit} ${styles.actionHitLeft}`}
          aria-label={`View details for ${name}`}
          onClick={handleOpenDetail}
        />
        <button
          type="button"
          className={`${styles.actionHit} ${styles.actionHitRight}`}
          aria-label={`Remove ${name}`}
          onClick={handleDismiss}
        />

        {!isDragging && <span className={styles.label}>{name}</span>}
      </div>
    </div>
  );
}
