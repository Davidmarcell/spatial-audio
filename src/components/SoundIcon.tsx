import { isDefaultInstance } from '../data/environments';
import { normalizedToPercent } from '../audio/spatialMath';
import type { SpatialPoint } from '../data/types';
import styles from './SoundIcon.module.css';

type Props = {
  instanceId: string;
  icon: string;
  name: string;
  position: SpatialPoint;
  sway: number;
  isDragging: boolean;
  selected: boolean;
  onSelect: (instanceId: string) => void;
  onRemove: (instanceId: string) => void;
  onPointerDown: (instanceId: string, event: React.PointerEvent<HTMLButtonElement>) => void;
};

export function SoundIcon({
  instanceId,
  icon,
  name,
  position,
  sway,
  isDragging,
  selected,
  onSelect,
  onRemove,
  onPointerDown,
}: Props) {
  const { left, top } = normalizedToPercent(position);
  const swayDeg = (sway * 180) / Math.PI;
  const removable = !isDefaultInstance(instanceId);

  return (
    <div
      className={`${styles.wrapper} ${selected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
      style={{
        left,
        top,
        transform: `translate(-50%, -50%) rotate(${swayDeg}deg) scale(${isDragging ? 1.06 : 1})`,
      }}
    >
      <button
        type="button"
        className={styles.icon}
        aria-label={`${name}. Drag to reposition.`}
        aria-pressed={selected}
        onClick={() => onSelect(instanceId)}
        onPointerDown={(event) => onPointerDown(instanceId, event)}
      >
        <span className={styles.emoji} aria-hidden>
          {icon}
        </span>
      </button>
      <span className={styles.label}>{name}</span>
      {removable && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${name}`}
          onClick={() => onRemove(instanceId)}
        >
          ×
        </button>
      )}
    </div>
  );
}
