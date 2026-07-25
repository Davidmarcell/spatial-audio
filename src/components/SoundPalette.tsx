import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
import type { SoundDef } from '../data/types';
import { dockMagnification } from '../utils/dockMagnification';
import { getSoundTooltipLines } from '../utils/soundTooltip';
import { DockMagnetTooltip, type DockTooltipAnchor } from './DockMagnetTooltip';
import {
  DOCK_ACTIVATION_PAD,
  DOCK_BASE_SIZE,
  DOCK_HOVER_INFLUENCE,
  getDockInsertionGap,
  getDockInsertionIndex,
  getDockSlotCenter,
  getDockSlotCenters,
  getDockSounds,
  getDockTileSize,
  predictInsertedSlotCenter,
} from './soundPaletteLayout';
import { AddSoundButton } from './AddSoundButton';
import { SoundIconImage } from './SoundIconImage';
import styles from './SoundPalette.module.css';

const DESKTOP_HOVER_MAX_SIZE = 82;
const ADD_BUTTON_ID = '__dock-add-sound__';

export type DockMagnetDrag = {
  x: number;
  y: number;
  soundId: string;
};

export type SoundPaletteHandle = {
  getSlotCenter: (
    soundId: string,
    activeSoundIds: string[],
    dockDefaultIds?: string[],
    returningSoundId?: string | null,
  ) => { x: number; y: number; size: number } | null;
  getInsertionIndex: (clientX: number, clientY: number) => number;
  hitTest: (clientX: number, clientY: number) => boolean;
};

type Props = {
  sounds: SoundDef[];
  dockDefaultIds: string[];
  activeSoundIds: string[];
  returningSoundId?: string | null;
  draggingSoundId: string | null;
  draggingActive: boolean;
  magnetDrag?: DockMagnetDrag | null;
  regionArt: RegionArtContext;
  onDragStart: (sound: SoundDef, event: React.PointerEvent<HTMLButtonElement>) => void;
  onAddClick: (originRect: DOMRect) => void;
};

export const SoundPalette = forwardRef<SoundPaletteHandle, Props>(function SoundPalette(
  {
    sounds,
    dockDefaultIds,
    activeSoundIds,
    returningSoundId = null,
    draggingSoundId,
    draggingActive,
    magnetDrag = null,
    regionArt,
    onDragStart,
    onAddClick,
  },
  ref,
) {
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  // Snapshot of the dock's resting geometry. While the magnet is engaged the
  // tray grows vertically to open the insertion gap, which shifts the live
  // bounding rect; measuring insertion slots against this frozen resting rect
  // keeps the chosen slot stable instead of feeding back on its own growth.
  const restingRectRef = useRef<DOMRect | null>(null);
  // Snapshot of each dock slot's *resting* centre (in dock order). A returning
  // tile flies to one of these slots; measuring them at rest — not while the
  // tray is grown/spread for the gap — makes the flight land exactly where the
  // docked icon settles, with no post-settle jump.
  const restingSlotCentersRef = useRef<{ x: number; y: number }[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [scales, setScales] = useState<Map<string, number>>(new Map());
  const [horizontal, setHorizontal] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<DockTooltipAnchor | null>(null);

  const dockSounds = useMemo(
    () => getDockSounds(sounds, activeSoundIds, dockDefaultIds, returningSoundId),
    [sounds, activeSoundIds, dockDefaultIds, returningSoundId],
  );

  const isNearDock = useCallback((point: { x: number; y: number }) => {
    const dock = dockRef.current;
    if (!dock) return false;
    const rect = dock.getBoundingClientRect();
    const pad = DOCK_ACTIVATION_PAD;
    return (
      point.x >= rect.left - pad
      && point.x <= rect.right + pad
      && point.y >= rect.top - pad
      && point.y <= rect.bottom + pad
    );
  }, []);

  const magnetActive = magnetDrag !== null && isNearDock(magnetDrag);

  // Animated 0→1 "magnet intensity". Rather than snapping the dock into its
  // grown/magnified state the instant the pointer crosses the influence zone,
  // we ease this value in and out so the growth ramps smoothly on approach and
  // settles gently on leave.
  const [magnetProgress, setMagnetProgress] = useState(0);
  const magnetProgressRef = useRef(0);

  useEffect(() => {
    const target = magnetActive ? 1 : 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      magnetProgressRef.current = target;
      setMagnetProgress(target);
      return;
    }
    // Exponential approach: reaches ~0.95 in ~220ms, and gracefully reverses
    // direction mid-flight if the pointer briefly re-enters/leaves the zone.
    const RATE = 13;
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      if (!last) last = now;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const current = magnetProgressRef.current;
      const blend = 1 - Math.exp(-RATE * dt);
      let next = current + (target - current) * blend;
      if (Math.abs(next - target) < 0.003) next = target;
      magnetProgressRef.current = next;
      setMagnetProgress(next);
      if (next !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [magnetActive]);

  // Once the ramp has fully retracted the dock is back to its resting state.
  const magnetRender = magnetActive || magnetProgress > 0.001;

  // Keep the resting geometry snapshot fresh whenever the tray is at rest, so
  // the moment the magnet engages we already hold its ungrown rect and the true
  // resting centre of every slot.
  useEffect(() => {
    if (magnetRender || !dockRef.current) return;
    restingRectRef.current = dockRef.current.getBoundingClientRect();
    const centers: { x: number; y: number }[] = [];
    for (const sound of dockSounds) {
      const el = itemRefs.current.get(sound.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      centers.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
    if (centers.length === dockSounds.length) {
      restingSlotCentersRef.current = centers;
    }
  });

  const collectSlotCenters = useCallback(() => {
    const dock = dockRef.current;
    if (!dock) return [];
    const rect = restingRectRef.current ?? dock.getBoundingClientRect();
    return getDockSlotCenters(rect, dockSounds.length, horizontal);
  }, [dockSounds.length, horizontal]);

  const insertionIndex = useMemo(() => {
    if (!magnetActive || !magnetDrag) return null;
    const coord = horizontal ? magnetDrag.x : magnetDrag.y;
    const raw = getDockInsertionIndex(coord, collectSlotCenters());
    // Clamp to the add-button slot so pointing just past the last tile still
    // opens the gap there instead of leaving a dead spot.
    return Math.min(raw, dockSounds.length);
  }, [collectSlotCenters, horizontal, magnetActive, magnetDrag, dockSounds.length]);

  useImperativeHandle(
    ref,
    () => ({
      getSlotCenter(soundId, nextActiveIds, dockDefaultIdsOverride, returningSoundIdOverride) {
        const dock = dockRef.current;
        if (!dock) return null;
        const nextDockDefaults = dockDefaultIdsOverride ?? dockDefaultIds;
        const nextReturning = returningSoundIdOverride ?? returningSoundId;
        const tileSize = getDockTileSize(horizontal);
        // Resolve the tile's final index in the *post-drop* resting dock and,
        // when the slot count is unchanged, land it on the real resting centre
        // captured at rest. This avoids reading the grown/spread tray (which is
        // ~half a slot taller mid-drag) and so removes the post-settle jump.
        const finalDock = getDockSounds(sounds, nextActiveIds, nextDockDefaults, nextReturning);
        const finalIndex = finalDock.findIndex((entry) => entry.id === soundId);
        const captured = restingSlotCentersRef.current;
        if (finalIndex >= 0 && captured.length === finalDock.length && captured[finalIndex]) {
          return { ...captured[finalIndex], size: tileSize };
        }
        // Returning tile is not in the resting capture yet (slot count +1):
        // predict from neighbours so the flight stays on the tray instead of
        // leaping to a vertical-layout fallback at the screen edge.
        if (finalIndex >= 0 && captured.length === finalDock.length - 1) {
          const predicted = predictInsertedSlotCenter(captured, finalIndex, horizontal);
          if (predicted) return predicted;
        }
        // Fallback: axis-aware geometry against the resting rect.
        const rect = restingRectRef.current ?? dock.getBoundingClientRect();
        return getDockSlotCenter(
          rect,
          soundId,
          sounds,
          nextActiveIds,
          nextDockDefaults,
          nextReturning,
          horizontal,
        );
      },
      getInsertionIndex(clientX, clientY) {
        const coord = horizontal ? clientX : clientY;
        return getDockInsertionIndex(coord, collectSlotCenters());
      },
      hitTest(clientX, clientY) {
        const dock = dockRef.current;
        if (!dock) return false;
        const rect = dock.getBoundingClientRect();
        const pad = DOCK_ACTIVATION_PAD;
        return (
          clientX >= rect.left - pad
          && clientX <= rect.right + pad
          && clientY >= rect.top - pad
          && clientY <= rect.bottom + pad
        );
      },
    }),
    [sounds, dockDefaultIds, returningSoundId, horizontal, collectSlotCenters],
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const sync = () => setHorizontal(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const baseSize = getDockTileSize(horizontal);
  const hoverMaxSize = horizontal
    ? baseSize + 6
    : DOCK_BASE_SIZE + (DESKTOP_HOVER_MAX_SIZE - DOCK_BASE_SIZE) * 0.25;

  const updateScales = useCallback(
    (point: { x: number; y: number } | null, externalMagnet: boolean) => {
      // During a canvas→dock drag the tray parts to make space (the gap) but the
      // icons themselves stay at their resting size — magnifying them would bulge
      // the bar sideways, which we explicitly want to avoid. Magnification is
      // reserved for plain mouse hover over the dock.
      if (externalMagnet) {
        const base = new Map<string, number>();
        for (const sound of dockSounds) base.set(sound.id, baseSize);
        base.set(ADD_BUTTON_ID, baseSize);
        setScales(base);
        return;
      }
      const influence = DOCK_HOVER_INFLUENCE;
      const maxSize = hoverMaxSize;
      const next = new Map<string, number>();
      for (const sound of dockSounds) {
        const el = itemRefs.current.get(sound.id);
        if (!el || point === null) {
          next.set(sound.id, baseSize);
          continue;
        }
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(point.x - centerX, point.y - centerY);
        const size = dockMagnification(distance, baseSize, maxSize, influence);
        next.set(sound.id, size);
      }
      const addButtonEl = addButtonRef.current;
      if (!addButtonEl || point === null) {
        next.set(ADD_BUTTON_ID, baseSize);
      } else {
        const rect = addButtonEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(point.x - centerX, point.y - centerY);
        const size = dockMagnification(distance, baseSize, maxSize, influence);
        next.set(ADD_BUTTON_ID, size);
      }
      setScales(next);
    },
    [baseSize, dockSounds, hoverMaxSize],
  );

  const magnetPoint = magnetActive && magnetDrag ? { x: magnetDrag.x, y: magnetDrag.y } : null;
  const effectivePoint = magnetPoint ?? cursor;

  useEffect(() => {
    updateScales(effectivePoint, magnetPoint !== null);
  }, [effectivePoint, magnetPoint, dockSounds, updateScales]);

  // `updateScales` computes the full magnified sizes for the current magnet
  // point; we snapshot them so the ramp can keep easing back down after the
  // pointer has left (when `updateScales` has already reset to base sizes).
  const magnetTargetsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (magnetActive) magnetTargetsRef.current = new Map(scales);
  }, [scales, magnetActive]);

  // Blend the resting base size and the full magnified target by the eased
  // magnet progress, so magnification grows in and shrinks out with the dock.
  const resolveSize = useCallback(
    (id: string) => {
      const hoverSize = scales.get(id) ?? baseSize;
      if (!magnetRender) return hoverSize;
      const target =
        (magnetActive ? scales.get(id) : magnetTargetsRef.current.get(id)) ?? baseSize;
      return baseSize + (target - baseSize) * magnetProgress;
    },
    [baseSize, magnetActive, magnetProgress, magnetRender, scales],
  );

  useEffect(() => {
    if (!draggingSoundId) return;
    setCursor(null);
    setTooltipAnchor(null);
    updateScales(null, false);
  }, [draggingSoundId, updateScales]);

  const syncTooltipAnchor = useCallback(
    (sound: SoundDef, el: HTMLElement) => {
      if (magnetActive) return;
      const rect = el.getBoundingClientRect();
      setTooltipAnchor({
        id: sound.id,
        title: getSoundTooltipLines(sound).title,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        iconTop: rect.top,
        iconHeight: rect.height,
        iconLeft: rect.left,
        iconWidth: rect.width,
        horizontal,
      });
    },
    [horizontal, magnetActive],
  );

  useEffect(() => {
    const anchorId = tooltipAnchor?.id;
    if (!anchorId || magnetActive) return;
    if (anchorId === ADD_BUTTON_ID) {
      const el = addButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTooltipAnchor({
        id: ADD_BUTTON_ID,
        title: 'Add sound',
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        iconTop: rect.top,
        iconHeight: rect.height,
        iconLeft: rect.left,
        iconWidth: rect.width,
        horizontal,
      });
      return;
    }
    const sound = dockSounds.find((item) => item.id === anchorId);
    if (!sound) return;
    const el = itemRefs.current.get(sound.id);
    if (!el) return;
    syncTooltipAnchor(sound, el);
  }, [scales, tooltipAnchor?.id, dockSounds, horizontal, magnetActive, syncTooltipAnchor]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (draggingSoundId || magnetDrag) return;

      const dock = dockRef.current;
      if (!dock) return;

      const rect = dock.getBoundingClientRect();
      const pad = DOCK_HOVER_INFLUENCE;
      const nearDock =
        event.clientX >= rect.left - 12 &&
        event.clientX <= rect.right + hoverMaxSize + pad &&
        event.clientY >= rect.top - pad &&
        event.clientY <= rect.bottom + pad;

      setCursor(nearDock ? { x: event.clientX, y: event.clientY } : null);
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [draggingSoundId, hoverMaxSize, magnetDrag]);

  useEffect(() => {
    if (cursor === null && !magnetPoint) updateScales(null, false);
  }, [cursor, magnetPoint, updateScales]);

  useEffect(() => {
    if (!magnetActive) setTooltipAnchor(null);
  }, [magnetActive]);

  const handlePointerDown = useCallback(
    (sound: SoundDef, event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onDragStart(sound, event);
    },
    [onDragStart],
  );

  // The insertion gap is a real layout change (a margin on the slot the tile
  // will drop into) rather than a transform, so the tray actually grows to hold
  // the incoming tile. Because the dock is vertically centred in its overlay,
  // that growth pushes the tiles above the gap up and those below it down — an
  // even, iOS-style parting — while horizontal size and padding stay untouched.
  // The `.itemGroup`/`.addWrap` margin transitions ease the gap open and shut.
  const gapMargin = (renderIndex: number): CSSProperties | undefined => {
    if (!magnetRender || insertionIndex === null || renderIndex !== insertionIndex) {
      return undefined;
    }
    const gap = getDockInsertionGap(horizontal);
    return horizontal
      ? { marginLeft: `${gap}px` }
      : { marginTop: `${gap}px` };
  };

  return (
    <aside className={styles.palette} aria-label="Sound palette">
      <div
        ref={dockRef}
        className={`${styles.dock} ${draggingSoundId ? styles.dockDragging : ''} ${
          draggingActive ? styles.dockDraggingOut : ''
        }`}
      >
        <span
          className={styles.dockGlow}
          aria-hidden
          style={{
            position: 'absolute',
            zIndex: 0,
            opacity: magnetRender ? magnetProgress : 0,
          }}
        />
        <ul className={styles.list}>
          {dockSounds.map((sound, index) => {
            const isDragging = draggingSoundId === sound.id;
            const isReturning = returningSoundId === sound.id;
            const size = resolveSize(sound.id);
            const hoverScale = size / baseSize;
            const artwork = getSoundArtworkForRegion(
              regionArt.id,
              regionArt.soundIds,
              sound.id,
              undefined,
              regionArt.tags,
            );

            const wrapClass = isDragging
              ? draggingActive
                ? styles.itemWrapOut
                : styles.itemWrapLift
              : '';

            return (
              <li key={sound.id} className={styles.itemGroup} style={gapMargin(index)}>
                <div className={`${styles.itemWrap} ${wrapClass}`.trim()}>
                  {isReturning ? (
                    <div
                      ref={(node) => {
                        if (node) itemRefs.current.set(sound.id, node);
                        else itemRefs.current.delete(sound.id);
                      }}
                      className={styles.itemPlaceholder}
                      style={{
                        width: `${baseSize}px`,
                        height: `${baseSize}px`,
                      }}
                      aria-hidden
                    />
                  ) : !isDragging ? (
                    <button
                      ref={(node) => {
                        if (node) itemRefs.current.set(sound.id, node);
                        else itemRefs.current.delete(sound.id);
                      }}
                      type="button"
                      className={styles.item}
                      style={{
                        width: `${baseSize}px`,
                        height: `${baseSize}px`,
                        transform: `scale(${hoverScale})`,
                      }}
                      onPointerDown={(event) => handlePointerDown(sound, event)}
                      onPointerEnter={(event) => syncTooltipAnchor(sound, event.currentTarget)}
                      onPointerLeave={() => setTooltipAnchor(null)}
                      onFocus={(event) => syncTooltipAnchor(sound, event.currentTarget)}
                      onBlur={() => setTooltipAnchor(null)}
                      aria-label={`Drag ${sound.name} onto the grid`}
                    >
                      <SoundIconImage
                        src={artwork.src}
                        sourceUrl={artwork.sourceUrl}
                        detailSrc={artwork.detailSrc}
                        alt=""
                        soundId={sound.id}
                        size="palette"
                      />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
          <li className={styles.addWrap} style={gapMargin(dockSounds.length)}>
            <AddSoundButton
              ref={addButtonRef}
              onClick={onAddClick}
              size={baseSize}
              scale={resolveSize(ADD_BUTTON_ID) / baseSize}
              onPointerEnter={(event) => {
                if (magnetActive) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setTooltipAnchor({
                  id: ADD_BUTTON_ID,
                  title: 'Add sound',
                  centerX: rect.left + rect.width / 2,
                  centerY: rect.top + rect.height / 2,
                  iconTop: rect.top,
                  iconHeight: rect.height,
                  iconLeft: rect.left,
                  iconWidth: rect.width,
                  horizontal,
                });
              }}
              onPointerLeave={() => setTooltipAnchor(null)}
              onFocus={(event) => {
                if (magnetActive) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setTooltipAnchor({
                  id: ADD_BUTTON_ID,
                  title: 'Add sound',
                  centerX: rect.left + rect.width / 2,
                  centerY: rect.top + rect.height / 2,
                  iconTop: rect.top,
                  iconHeight: rect.height,
                  iconLeft: rect.left,
                  iconWidth: rect.width,
                  horizontal,
                });
              }}
              onBlur={() => setTooltipAnchor(null)}
            />
          </li>
        </ul>
      </div>
      <DockMagnetTooltip anchor={tooltipAnchor} />
    </aside>
  );
});
