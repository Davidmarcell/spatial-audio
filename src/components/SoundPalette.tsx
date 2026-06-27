import {
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
  DOCK_BASE_SIZE,
  getDockSlotCenter,
  getDockSounds,
} from './soundPaletteLayout';
import { AddSoundButton } from './AddSoundButton';
import { SoundIconImage } from './SoundIconImage';
import styles from './SoundPalette.module.css';

const MAX_SIZE = 82;
const INFLUENCE = 60;
const HOVER_MAX_SIZE = DOCK_BASE_SIZE + (MAX_SIZE - DOCK_BASE_SIZE) * 0.25;
const ADD_BUTTON_ID = '__dock-add-sound__';

export type SoundPaletteHandle = {
  getSlotCenter: (
    soundId: string,
    activeSoundIds: string[],
    dockDefaultIds?: string[],
  ) => { x: number; y: number } | null;
};

type Props = {
  sounds: SoundDef[];
  dockDefaultIds: string[];
  activeSoundIds: string[];
  draggingSoundId: string | null;
  draggingActive: boolean;
  regionArt: RegionArtContext;
  onDragStart: (sound: SoundDef, event: React.PointerEvent<HTMLButtonElement>) => void;
  onAddClick: (originRect: DOMRect) => void;
};

export const SoundPalette = forwardRef<SoundPaletteHandle, Props>(function SoundPalette(
  {
    sounds,
    dockDefaultIds,
    activeSoundIds,
    draggingSoundId,
    draggingActive,
    regionArt,
    onDragStart,
    onAddClick,
  },
  ref,
) {
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [scales, setScales] = useState<Map<string, number>>(new Map());
  const [horizontal, setHorizontal] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<DockTooltipAnchor | null>(null);

  const dockSounds = useMemo(
    () => getDockSounds(sounds, activeSoundIds, dockDefaultIds),
    [sounds, activeSoundIds, dockDefaultIds],
  );

  useImperativeHandle(
    ref,
    () => ({
      getSlotCenter(soundId, nextActiveIds, dockDefaultIdsOverride) {
        const dock = dockRef.current;
        if (!dock) return null;
        const measured = itemRefs.current.get(soundId);
        if (measured) {
          const rect = measured.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return getDockSlotCenter(
          dock.getBoundingClientRect(),
          soundId,
          sounds,
          nextActiveIds,
          dockDefaultIdsOverride ?? dockDefaultIds,
        );
      },
    }),
    [sounds, dockDefaultIds],
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const sync = () => setHorizontal(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const updateScales = useCallback(
    (point: { x: number; y: number } | null) => {
      const next = new Map<string, number>();
      for (const sound of dockSounds) {
        const el = itemRefs.current.get(sound.id);
        if (!el || point === null) {
          next.set(sound.id, DOCK_BASE_SIZE);
          continue;
        }
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(point.x - centerX, point.y - centerY);
        const size = dockMagnification(distance, DOCK_BASE_SIZE, HOVER_MAX_SIZE, INFLUENCE);
        next.set(sound.id, size);
      }
      const addButtonEl = addButtonRef.current;
      if (!addButtonEl || point === null) {
        next.set(ADD_BUTTON_ID, DOCK_BASE_SIZE);
      } else {
        const rect = addButtonEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(point.x - centerX, point.y - centerY);
        const size = dockMagnification(distance, DOCK_BASE_SIZE, HOVER_MAX_SIZE, INFLUENCE);
        next.set(ADD_BUTTON_ID, size);
      }
      setScales(next);
    },
    [dockSounds],
  );

  useEffect(() => {
    updateScales(cursor);
  }, [cursor, dockSounds, updateScales]);

  useEffect(() => {
    if (!draggingSoundId) return;
    setCursor(null);
    setTooltipAnchor(null);
    updateScales(null);
  }, [draggingSoundId, updateScales]);

  const syncTooltipAnchor = useCallback(
    (sound: SoundDef, el: HTMLButtonElement) => {
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
    [horizontal],
  );

  useEffect(() => {
    const anchorId = tooltipAnchor?.id;
    if (!anchorId) return;
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
  }, [scales, tooltipAnchor?.id, dockSounds, horizontal, syncTooltipAnchor]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (draggingSoundId) return;

      const dock = dockRef.current;
      if (!dock) return;

      const rect = dock.getBoundingClientRect();
      const pad = INFLUENCE;
      const nearDock =
        event.clientX >= rect.left - 12 &&
        event.clientX <= rect.right + MAX_SIZE + pad &&
        event.clientY >= rect.top - pad &&
        event.clientY <= rect.bottom + pad;

      setCursor(nearDock ? { x: event.clientX, y: event.clientY } : null);
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [draggingSoundId]);

  useEffect(() => {
    if (cursor === null) updateScales(null);
  }, [cursor, updateScales]);

  const handlePointerDown = useCallback(
    (sound: SoundDef, event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onDragStart(sound, event);
    },
    [onDragStart],
  );

  return (
    <aside className={styles.palette} aria-label="Sound palette">
      <div
        ref={dockRef}
        className={`${styles.dock} ${draggingSoundId ? styles.dockDragging : ''} ${
          draggingActive ? styles.dockDraggingOut : ''
        }`}
      >
        <ul className={styles.list}>
          {dockSounds.map((sound) => {
            const isDragging = draggingSoundId === sound.id;
            const size = scales.get(sound.id) ?? DOCK_BASE_SIZE;
            const hoverScale = size / DOCK_BASE_SIZE;
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
              <li key={sound.id} className={`${styles.itemWrap} ${wrapClass}`.trim()}>
                {!isDragging && (
                  <button
                    ref={(node) => {
                      if (node) itemRefs.current.set(sound.id, node);
                      else itemRefs.current.delete(sound.id);
                    }}
                    type="button"
                    className={styles.item}
                    style={{
                      width: `${DOCK_BASE_SIZE}px`,
                      height: `${DOCK_BASE_SIZE}px`,
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
                )}
              </li>
            );
          })}
          <li className={styles.addWrap}>
            <AddSoundButton
              ref={addButtonRef}
              onClick={onAddClick}
              size={DOCK_BASE_SIZE}
              scale={(scales.get(ADD_BUTTON_ID) ?? DOCK_BASE_SIZE) / DOCK_BASE_SIZE}
              onPointerEnter={(event) => {
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
