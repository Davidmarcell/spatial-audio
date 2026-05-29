import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createPhysics,
  isSettled,
  stepPhysics,
  type IconPhysics,
} from '../audio/iconPhysics';
import { canvasToNormalized } from '../audio/spatialMath';
import type { ActiveSound, SoundDef, SpatialPoint } from '../data/types';
import { SoundControls } from './SoundControls';
import { SoundIcon } from './SoundIcon';
import styles from './SpatialCanvas.module.css';

type Props = {
  activeSounds: ActiveSound[];
  soundMap: Map<string, SoundDef>;
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
  onRemove: (instanceId: string) => void;
  onMove: (instanceId: string, position: SpatialPoint) => void;
  onSettle: (instanceId: string, position: SpatialPoint) => void;
  onVolumeChange: (instanceId: string, volume: number) => void;
};

type DragState = {
  instanceId: string;
  pointerId: number;
  target: SpatialPoint;
};

export function SpatialCanvas({
  activeSounds,
  soundMap,
  selectedId,
  onSelect,
  onRemove,
  onMove,
  onSettle,
  onVolumeChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const physicsRef = useRef<Map<string, IconPhysics>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const onMoveRef = useRef(onMove);
  const onSettleRef = useRef(onSettle);
  const activeSoundsRef = useRef(activeSounds);
  const reducedMotionRef = useRef(false);
  const movingRef = useRef<Map<string, boolean>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [renderStates, setRenderStates] = useState<Map<string, IconPhysics>>(new Map());

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onSettleRef.current = onSettle;
  }, [onSettle]);

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

        const next =
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

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      updateDragTarget(event.clientX, event.clientY);
    };

    const onPointerUp = (event: PointerEvent) => {
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
  }, [updateDragTarget]);

  const handlePointerDown = useCallback(
    (instanceId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onSelect(instanceId);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const target = canvasToNormalized(
        event.clientX,
        event.clientY,
        canvas.getBoundingClientRect(),
      );

      dragRef.current = {
        instanceId,
        pointerId: event.pointerId,
        target,
      };
      setDraggingId(instanceId);

      event.currentTarget.setPointerCapture(event.pointerId);
      setRenderStates(new Map(physicsRef.current));
    },
    [onSelect],
  );

  const selectedSound = selectedId
    ? activeSounds.find((item) => item.instanceId === selectedId)
    : null;
  const selectedDef = selectedSound ? soundMap.get(selectedSound.soundId) : null;

  return (
    <div className={styles.wrapper}>
      <div ref={canvasRef} className={styles.canvas} aria-label="Spatial sound grid">
        <div className={styles.grid} aria-hidden />
        {activeSounds.map((item) => {
          const sound = soundMap.get(item.soundId);
          if (!sound) return null;

          const physics = renderStates.get(item.instanceId) ?? createPhysics(item.position);
          const isDragging = draggingId === item.instanceId;

          return (
            <SoundIcon
              key={item.instanceId}
              instanceId={item.instanceId}
              icon={sound.icon}
              name={sound.name}
              position={{ x: physics.x, y: physics.y }}
              sway={physics.sway}
              isDragging={isDragging}
              selected={selectedId === item.instanceId}
              onSelect={onSelect}
              onRemove={onRemove}
              onPointerDown={handlePointerDown}
            />
          );
        })}
        <div className={styles.listener}>
          <span className={styles.listenerLabel}>You</span>
          <span className={styles.listenerDot} aria-hidden />
        </div>
        {selectedSound && selectedDef && (
          <div className={styles.controlsOverlay}>
            <SoundControls
              name={selectedDef.name}
              icon={selectedDef.icon}
              volume={selectedSound.volume}
              onVolumeChange={(volume) => onVolumeChange(selectedSound.instanceId, volume)}
            />
          </div>
        )}
      </div>
      <p className={styles.help}>
        Drag icons to move them with weight and sway. Select one to adjust its volume. Distance from
        You still controls loudness.
      </p>
    </div>
  );
}
