import { useRef } from 'react';
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
  selected: boolean;
  regionArt: RegionArtContext;
  onSelect: (instanceId: string) => void;
  onRemove: (instanceId: string, iconRect: DOMRect) => void;
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
  selected,
  onSelect,
  onRemove,
  onOpenDetail,
  onPointerDown,
  regionArt,
}: Props) {
  const iconRef = useRef<HTMLButtonElement>(null);
  const { left, top } = normalizedToPercent(position);
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
      className={`${styles.wrapper} ${selected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
      style={{ left, top, zIndex: depthZIndex(distance) }}
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
