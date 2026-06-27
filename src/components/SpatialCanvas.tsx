import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useScenePlayingBarColors } from '../hooks/useScenePlayingBarColors';

export type RadarRingVariant = 1 | 2 | 3 | 4;
import {
  createPhysics,
  isSettled,
  stepPhysics,
  type IconPhysics,
} from '../audio/iconPhysics';
import { canvasToNormalized } from '../audio/spatialMath';
import type { RegionArtContext } from '../data/iconArt';
import type { ActiveSound, SoundDef, SpatialPoint } from '../data/types';
import { SoundIcon } from './SoundIcon';
import styles from './SpatialCanvas.module.css';

type Props = {
  canvasRef?: RefObject<HTMLDivElement | null>;
  activeSounds: ActiveSound[];
  soundMap: Map<string, SoundDef>;
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
  onRemove: (instanceId: string, iconRect: DOMRect) => void;
  onOpenDetail: (instanceId: string, originRect: DOMRect | null) => void;
  onMove: (instanceId: string, position: SpatialPoint) => void;
  onSettle: (instanceId: string, position: SpatialPoint) => void;
  onDragBegin?: () => void;
  dropHighlight?: boolean;
  returningId?: string | null;
  regionArt: RegionArtContext;
  ringVariant: RadarRingVariant;
  isPlaying?: boolean;
};

type DragState = {
  instanceId: string;
  pointerId: number;
  target: SpatialPoint;
};

type PendingDragState = {
  instanceId: string;
  pointerId: number;
  startX: number;
  startY: number;
};

const DRAG_THRESHOLD_PX = 8;

export function SpatialCanvas({
  canvasRef: externalCanvasRef,
  activeSounds,
  soundMap,
  selectedId,
  onSelect,
  onRemove,
  onOpenDetail,
  onMove,
  onSettle,
  onDragBegin,
  dropHighlight = false,
  returningId = null,
  regionArt,
  ringVariant,
  isPlaying = false,
}: Props) {
  const internalCanvasRef = useRef<HTMLDivElement>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const physicsRef = useRef<Map<string, IconPhysics>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const pendingDragRef = useRef<PendingDragState | null>(null);
  const onMoveRef = useRef(onMove);
  const onSettleRef = useRef(onSettle);
  const onDragBeginRef = useRef(onDragBegin);
  const activeSoundsRef = useRef(activeSounds);
  const reducedMotionRef = useRef(false);
  const movingRef = useRef<Map<string, boolean>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [renderStates, setRenderStates] = useState<Map<string, IconPhysics>>(new Map());
  const playingBarColors = useScenePlayingBarColors(activeSounds, regionArt);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onSettleRef.current = onSettle;
  }, [onSettle]);

  useEffect(() => {
    onDragBeginRef.current = onDragBegin;
  }, [onDragBegin]);

  useEffect(() => {
    activeSoundsRef.current = activeSounds;
  }, [activeSounds]);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    const activeIds = new Set(activeSounds.map((item) => item.instanceId));

    for (const id of [...physicsRef.current.keys()]) {
      if (!activeIds.has(id)) {
        physicsRef.current.delete(id);
        movingRef.current.delete(id);
      }
    }

    for (const item of activeSounds) {
      const existing = physicsRef.current.get(item.instanceId);
      const dragging = dragRef.current?.instanceId === item.instanceId;

      if (!existing) {
        physicsRef.current.set(item.instanceId, createPhysics(item.position));
      } else if (!dragging) {
        const dx = Math.abs(existing.x - item.position.x);
        const dy = Math.abs(existing.y - item.position.y);
        if (dx > 0.001 || dy > 0.001) {
          physicsRef.current.set(item.instanceId, {
            ...existing,
            x: item.position.x,
            y: item.position.y,
            vx: 0,
            vy: 0,
          });
        }
      }
    }

    setRenderStates(new Map(physicsRef.current));
  }, [activeSounds]);

  useEffect(() => {
    let lastTime = 0;
    let frame = 0;

    const loop = (now: number) => {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.032) : 0;
      lastTime = now;

      const drag = dragRef.current;
      const reducedMotion = reducedMotionRef.current;
      let animating = Boolean(drag);

      for (const item of activeSoundsRef.current) {
        const current = physicsRef.current.get(item.instanceId) ?? createPhysics(item.position);
        const isDragging = drag?.instanceId === item.instanceId;
        const target = isDragging ? drag.target : null;

        const stepped =
          dt === 0
            ? current
            : reducedMotion
              ? {
                  ...current,
                  x: target?.x ?? current.x,
                  y: target?.y ?? current.y,
                  vx: 0,
                  vy: 0,
                  sway: 0,
                }
              : stepPhysics(current, target, dt);

        const next = isDragging ? stepped : { ...stepped, sway: 0 };

        physicsRef.current.set(item.instanceId, next);

        const settled = isSettled(next, target);
        const isMoving = isDragging || !settled;
        const positionChanged =
          Math.abs(next.x - current.x) > 0.0001 || Math.abs(next.y - current.y) > 0.0001;

        if (positionChanged || isMoving) {
          onMoveRef.current(item.instanceId, { x: next.x, y: next.y });
        }

        const wasMoving = movingRef.current.get(item.instanceId) ?? false;

        if (!isMoving && wasMoving) {
          onSettleRef.current(item.instanceId, { x: next.x, y: next.y });
        }
        movingRef.current.set(item.instanceId, isMoving);

        if (isMoving) animating = true;
      }

      if (animating || drag) {
        setRenderStates(new Map(physicsRef.current));
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const updateDragTarget = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;

    drag.target = canvasToNormalized(clientX, clientY, canvas.getBoundingClientRect());
    setRenderStates(new Map(physicsRef.current));
  }, []);

  const resetIconMotion = useCallback((instanceId: string) => {
    const current = physicsRef.current.get(instanceId);
    if (!current) return;
    physicsRef.current.set(instanceId, {
      ...current,
      vx: 0,
      vy: 0,
      sway: 0,
    });
    setRenderStates(new Map(physicsRef.current));
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const pending = pendingDragRef.current;
      if (pending && event.pointerId === pending.pointerId) {
        const dx = event.clientX - pending.startX;
        const dy = event.clientY - pending.startY;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          const canvas = canvasRef.current;
          if (canvas) {
            dragRef.current = {
              instanceId: pending.instanceId,
              pointerId: pending.pointerId,
              target: canvasToNormalized(
                event.clientX,
                event.clientY,
                canvas.getBoundingClientRect(),
              ),
            };
            setDraggingId(pending.instanceId);
            onDragBeginRef.current?.();
            setRenderStates(new Map(physicsRef.current));
          }
          pendingDragRef.current = null;
        }
        return;
      }

      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      updateDragTarget(event.clientX, event.clientY);
    };

    const onPointerUp = (event: PointerEvent) => {
      const pending = pendingDragRef.current;
      if (pending && event.pointerId === pending.pointerId) {
        resetIconMotion(pending.instanceId);
        const canvas = canvasRef.current;
        const icon = canvas?.querySelector<HTMLElement>(
          `[data-instance-id="${pending.instanceId}"] [data-sound-icon]`,
        );
        onOpenDetail(pending.instanceId, icon?.getBoundingClientRect() ?? null);
        pendingDragRef.current = null;
        return;
      }

      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      dragRef.current = null;
      setDraggingId(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onOpenDetail, resetIconMotion, updateDragTarget]);

  const handlePointerDown = useCallback(
    (instanceId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onSelect(instanceId);

      pendingDragRef.current = {
        instanceId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
      dragRef.current = null;
      setDraggingId(null);

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [onSelect],
  );

  const ringClass = isPlaying
    ? styles.radarRingsPlaying
    : ringVariant === 2
      ? styles.radarRingsBreath
      : ringVariant === 3
        ? styles.radarRingsPulsate
        : ringVariant === 4
          ? styles.radarRingsRipple
          : '';

  const canvasStyle = isPlaying ? (playingBarColors as CSSProperties | undefined) : undefined;

  return (
    <div className={styles.wrapper}>
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${isPlaying ? styles.canvasPlaying : ''} ${dropHighlight ? styles.canvasDropTarget : ''}`}
        style={canvasStyle}
        aria-label="Spatial sound grid"
      >
        <div
          className={`${styles.playingBarShader} ${isPlaying ? styles.playingBarShaderActive : ''}`}
          aria-hidden
        />
        <div className={`${styles.radarRings} ${ringClass}`} aria-hidden>
          <div className={styles.radarRing} />
          <div className={styles.radarRing} />
          <div className={styles.radarRing} />
        </div>
        {activeSounds.map((item) => {
          const sound = soundMap.get(item.soundId);
          if (!sound || item.instanceId === returningId) return null;

          const physics = renderStates.get(item.instanceId) ?? createPhysics(item.position);
          const isDragging = draggingId === item.instanceId;

          return (
            <SoundIcon
              key={item.instanceId}
              instanceId={item.instanceId}
              soundId={item.soundId}
              name={sound.name}
              position={{ x: physics.x, y: physics.y }}
              sway={physics.sway}
              isDragging={isDragging}
              selected={selectedId === item.instanceId}
              onSelect={onSelect}
              onRemove={onRemove}
              onOpenDetail={onOpenDetail}
              onPointerDown={handlePointerDown}
              regionArt={regionArt}
            />
          );
        })}
        <div className={styles.listener} aria-label="You — listener position">
          <span className={styles.listenerDot} aria-hidden />
          <span className={styles.listenerLabel}>You</span>
        </div>
      </div>
      <p className={styles.help}>
        Drag tiles from the dock onto the grid. Move them closer to You in the centre for louder volume.
      </p>
    </div>
  );
}
