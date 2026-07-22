import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useScenePlayingBarColors } from '../hooks/useScenePlayingBarColors';

export type RadarRingVariant = 1 | 2 | 3 | 4;
import {
  createPhysics,
  isSettled,
  stepPhysics,
  type IconPhysics,
} from '../audio/iconPhysics';
import { canvasToNormalized, distanceFromListener } from '../audio/spatialMath';
import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
import type { ActiveSound, SoundDef, SpatialPoint } from '../data/types';
import { displaySoundName } from '../utils/soundCatalog';
import { SoundIcon } from './SoundIcon';
import { SoundIconImage } from './SoundIconImage';
import styles from './SpatialCanvas.module.css';

type Props = {
  canvasRef?: RefObject<HTMLDivElement | null>;
  activeSounds: ActiveSound[];
  soundMap: Map<string, SoundDef>;
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
  onRemove: (instanceId: string, iconRect: DOMRect, dropPoint?: { x: number; y: number }) => void;
  onOpenDetail: (instanceId: string, originRect: DOMRect | null) => void;
  onMove: (instanceId: string, position: SpatialPoint) => void;
  onSettle: (instanceId: string, position: SpatialPoint) => void;
  onDragBegin?: () => void;
  onDockDragHover?: (state: { x: number; y: number; soundId: string } | null) => void;
  dropHighlight?: boolean;
  dockHitTest?: (clientX: number, clientY: number) => boolean;
  returningId?: string | null;
  regionArt: RegionArtContext;
  ringVariant: RadarRingVariant;
  isPlaying?: boolean;
  /**
   * Hold the tile radiate-in entrance by this many ms before it fires. Used to
   * sequence it behind the shared page wipe (see EnterTransition): the scene
   * loads while the wipe covers the screen, and the tiles are held until the
   * wipe has swept up to reveal the canvas, so they push out just as/after it
   * clears rather than under it. 0 (default) fires immediately, as at boot.
   */
  entranceHoldMs?: number;
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

// Entrance ("radiate in") timing. Tiles start small and faded at the listener
// centre and glide out to their resting spot; those resting further away land
// a touch later so the whole set ripples outward.
const ENTRANCE_DURATION_MS = 640;
const ENTRANCE_DELAY_PER_DISTANCE_MS = 300;
const ENTRANCE_MAX_DELAY_MS = 320;

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
  onDockDragHover,
  dropHighlight = false,
  dockHitTest,
  returningId = null,
  regionArt,
  ringVariant,
  isPlaying = false,
  entranceHoldMs = 0,
}: Props) {
  const internalCanvasRef = useRef<HTMLDivElement>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const physicsRef = useRef<Map<string, IconPhysics>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const pendingDragRef = useRef<PendingDragState | null>(null);
  const onMoveRef = useRef(onMove);
  const onSettleRef = useRef(onSettle);
  const onDragBeginRef = useRef(onDragBegin);
  const onDockDragHoverRef = useRef(onDockDragHover);
  const dockHitTestRef = useRef(dockHitTest);
  const activeSoundsRef = useRef(activeSounds);
  const reducedMotionRef = useRef(false);
  const movingRef = useRef<Map<string, boolean>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [renderStates, setRenderStates] = useState<Map<string, IconPhysics>>(new Map());
  // Instances currently playing their entrance ("radiate out") animation, plus
  // their per-tile stagger delays. Kept off the physics loop so the flight is a
  // pure CSS transform/opacity animation with no per-frame React churn.
  const [enteringIds, setEnteringIds] = useState<Set<string>>(() => new Set());
  const [ringsEntering, setRingsEntering] = useState(false);
  const entranceDelaysRef = useRef<Map<string, number>>(new Map());
  const entranceTimerRef = useRef<number | null>(null);
  // Timer that holds the radiate-in until the shared page wipe has revealed the
  // canvas, and a ref mirror of the current hold so the entrance effect reads a
  // live value without re-subscribing.
  const entranceStartTimerRef = useRef<number | null>(null);
  const entranceHoldRef = useRef(0);
  // Tracks the region whose entrance we last played, and whether a fresh scene
  // is armed but still waiting for its sounds to populate.
  const prevRegionIdRef = useRef<string | null>(null);
  const entranceArmedRef = useRef(false);
  // Mirror of the dragged tile, rendered in a body-level portal above the dock
  // while the drag is over the sidebar catch-zone. The real canvas icon lives in
  // the canvas' own (lower) stacking context and would otherwise slide *behind*
  // the dock; this keeps the tile visibly on top, iOS-dock style, without
  // touching the normal drag physics/visuals away from the dock.
  const [dockGhost, setDockGhost] = useState<
    { soundId: string; left: number; top: number; size: number } | null
  >(null);
  // Mirrors whether the ghost is currently shown (and for which sound) so the
  // physics loop can keep its position/size locked to the real icon every frame
  // — not just on pointermove. Otherwise, holding still before release lets the
  // spring-driven icon drift while the ghost stays frozen, and the return flight
  // then starts from a different spot, producing a visible jump on release.
  const dockGhostInfoRef = useRef<{ soundId: string } | null>(null);
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
    onDockDragHoverRef.current = onDockDragHover;
  }, [onDockDragHover]);

  useEffect(() => {
    dockHitTestRef.current = dockHitTest;
  }, [dockHitTest]);

  useEffect(() => {
    activeSoundsRef.current = activeSounds;
  }, [activeSounds]);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    entranceHoldRef.current = entranceHoldMs;
  }, [entranceHoldMs]);

  useEffect(() => {
    return () => {
      if (entranceTimerRef.current) window.clearTimeout(entranceTimerRef.current);
      if (entranceStartTimerRef.current) window.clearTimeout(entranceStartTimerRef.current);
    };
  }, []);

  // Play the radiate-in entrance whenever a fresh soundscape lands: a new region
  // is picked, or the very first scene populates. Detecting it here (rather than
  // via a prop) keeps the trigger self-contained. The region change can arrive a
  // tick before its sounds, so we "arm" on the region change and fire once the
  // tiles are present.
  useEffect(() => {
    const regionId = regionArt.id;
    if (prevRegionIdRef.current !== regionId) {
      prevRegionIdRef.current = regionId;
      entranceArmedRef.current = true;
    }

    if (!entranceArmedRef.current || activeSounds.length === 0) return;
    entranceArmedRef.current = false;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setEnteringIds(new Set());
      setRingsEntering(false);
      return;
    }

    const delays = new Map<string, number>();
    let maxDelay = 0;
    for (const item of activeSounds) {
      const delay = Math.min(
        ENTRANCE_MAX_DELAY_MS,
        distanceFromListener(item.position) * ENTRANCE_DELAY_PER_DISTANCE_MS,
      );
      delays.set(item.instanceId, delay);
      if (delay > maxDelay) maxDelay = delay;
    }

    // Snapshot the tiles to radiate so a hold delay cannot be voided by a later
    // render replacing the set before it fires.
    const enteringSnapshot = new Set(activeSounds.map((item) => item.instanceId));

    const startEntrance = () => {
      entranceDelaysRef.current = delays;
      setEnteringIds(enteringSnapshot);
      setRingsEntering(true);
      if (entranceTimerRef.current) window.clearTimeout(entranceTimerRef.current);
      entranceTimerRef.current = window.setTimeout(() => {
        setEnteringIds(new Set());
        setRingsEntering(false);
      }, ENTRANCE_DURATION_MS + maxDelay + 120);
    };

    // When the scene arrives behind the rising cover panel, hold the radiate-in
    // until the panel has finished rising and reveals the canvas, so the tiles
    // push out just as/after the sheet arrives rather than under it. (The page
    // motion itself is the cover panel rising; the canvas does not re-rise.)
    if (entranceStartTimerRef.current) window.clearTimeout(entranceStartTimerRef.current);
    const hold = entranceHoldRef.current;
    if (hold > 0) {
      entranceStartTimerRef.current = window.setTimeout(startEntrance, hold);
    } else {
      startEntrance();
    }
  }, [regionArt.id, activeSounds]);

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

      // Keep the dock mirror pinned to the live icon box each frame so its
      // on-screen position/size never goes stale relative to the physics.
      const ghostInfo = dockGhostInfoRef.current;
      if (drag && ghostInfo) {
        const iconEl = canvasRef.current?.querySelector<HTMLElement>(
          `[data-instance-id="${drag.instanceId}"] [data-sound-icon]`,
        );
        const rect = iconEl?.getBoundingClientRect();
        if (rect) {
          setDockGhost({ soundId: ghostInfo.soundId, left: rect.left, top: rect.top, size: rect.width });
        }
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

      const item = activeSoundsRef.current.find((entry) => entry.instanceId === drag.instanceId);
      if (item && dockHitTestRef.current?.(event.clientX, event.clientY)) {
        onDockDragHoverRef.current?.({
          x: event.clientX,
          y: event.clientY,
          soundId: item.soundId,
        });
        dockGhostInfoRef.current = { soundId: item.soundId };
        const iconEl = canvasRef.current?.querySelector<HTMLElement>(
          `[data-instance-id="${drag.instanceId}"] [data-sound-icon]`,
        );
        const rect = iconEl?.getBoundingClientRect();
        if (rect) {
          setDockGhost({
            soundId: item.soundId,
            left: rect.left,
            top: rect.top,
            size: rect.width,
          });
        }
      } else {
        onDockDragHoverRef.current?.(null);
        dockGhostInfoRef.current = null;
        setDockGhost(null);
      }
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

      onDockDragHoverRef.current?.(null);

      const canvas = canvasRef.current;
      const icon = canvas?.querySelector<HTMLElement>(
        `[data-instance-id="${drag.instanceId}"] [data-sound-icon]`,
      );
      const rect = icon?.getBoundingClientRect();
      dockGhostInfoRef.current = null;
      setDockGhost(null);
      if (rect && dockHitTestRef.current?.(event.clientX, event.clientY)) {
        onRemove(drag.instanceId, rect, { x: event.clientX, y: event.clientY });
      }

      dragRef.current = null;
      setDraggingId(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onOpenDetail, onRemove, resetIconMotion, updateDragTarget]);

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
        <div
          className={`${styles.radarRings} ${ringClass} ${ringsEntering ? styles.radarRingsEntering : ''}`}
          aria-hidden
        >
          <div className={styles.radarRing} />
          <div className={styles.radarRing} />
          <div className={styles.radarRing} />
        </div>
        {activeSounds.map((item) => {
          const sound = soundMap.get(item.soundId);
          if (!sound || item.instanceId === returningId) return null;

          const physics = renderStates.get(item.instanceId) ?? createPhysics(item.position);
          const isDragging = draggingId === item.instanceId;
          const entering = enteringIds.has(item.instanceId);

          return (
            <SoundIcon
              key={item.instanceId}
              instanceId={item.instanceId}
              soundId={item.soundId}
              name={displaySoundName(sound)}
              position={{ x: physics.x, y: physics.y }}
              sway={physics.sway}
              isDragging={isDragging}
              entering={entering}
              entranceDelayMs={entranceDelaysRef.current.get(item.instanceId) ?? 0}
              hiddenForGhost={isDragging && dockGhost !== null}
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
        Drag tiles from the dock onto the grid, or back to the dock to remove them. Move sounds closer to You in the centre for louder volume.
      </p>
      {dockGhost &&
        createPortal(
          <div
            className={styles.dockGhost}
            style={{
              left: dockGhost.left,
              top: dockGhost.top,
              width: dockGhost.size,
              height: dockGhost.size,
            }}
            aria-hidden
          >
            {(() => {
              const artwork = getSoundArtworkForRegion(
                regionArt.id,
                regionArt.soundIds,
                dockGhost.soundId,
                undefined,
                regionArt.tags,
              );
              return (
                <SoundIconImage
                  src={artwork.src}
                  sourceUrl={artwork.sourceUrl}
                  detailSrc={artwork.detailSrc}
                  alt=""
                  soundId={dockGhost.soundId}
                  size="canvas"
                />
              );
            })()}
          </div>,
          document.body,
        )}
    </div>
  );
}
