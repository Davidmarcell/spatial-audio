import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getSoundIconSrc, type RegionArtContext } from '../data/iconArt';
import type { SoundDef } from '../data/types';
import { dockMagnification } from '../utils/dockMagnification';
import { DockMagnetTooltip, type DockTooltipAnchor } from './DockMagnetTooltip';
import {
  DOCK_BASE_SIZE,
  getAvailableSounds,
  getDockSlotCenter,
} from './soundPaletteLayout';
import { SoundIconImage } from './SoundIconImage';
import styles from './SoundPalette.module.css';

const MAX_SIZE = 82;
const INFLUENCE = 145;

export type SoundPaletteHandle = {
  getSlotCenter: (soundId: string, activeSoundIds: string[]) => { x: number; y: number } | null;
};

type Props = {
  sounds: SoundDef[];
  activeSoundIds: string[];
  draggingSoundId: string | null;
  draggingActive: boolean;
  regionArt: RegionArtContext;
  onDragStart: (sound: SoundDef, event: React.PointerEvent<HTMLButtonElement>) => void;
};

export const SoundPalette = forwardRef<SoundPaletteHandle, Props>(function SoundPalette(
  { sounds, activeSoundIds, draggingSoundId, draggingActive, regionArt, onDragStart },
  ref,
) {
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [scales, setScales] = useState<Map<string, number>>(new Map());
  const [horizontal, setHorizontal] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<DockTooltipAnchor | null>(null);

  const availableSounds = useMemo(
    () => getAvailableSounds(sounds, activeSoundIds),
    [sounds, activeSoundIds],
  );

  useImperativeHandle(
    ref,
    () => ({
      getSlotCenter(soundId, nextActiveIds) {
        const dock = dockRef.current;
        if (!dock) return null;
        const measured = itemRefs.current.get(soundId);
        if (measured) {
          const rect = measured.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return getDockSlotCenter(dock.getBoundingClientRect(), soundId, sounds, nextActiveIds);
      },
    }),
    [sounds],
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
      for (const sound of availableSounds) {
        const el = itemRefs.current.get(sound.id);
        if (!el || point === null) {
          next.set(sound.id, DOCK_BASE_SIZE);
          continue;
        }
        const wrap = el.parentElement;
        const rect = wrap?.getBoundingClientRect() ?? el.getBoundingClientRect();
        const centerX = rect.left + DOCK_BASE_SIZE / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = horizontal
          ? Math.abs(point.x - centerX)
          : Math.abs(point.y - centerY);
        const size = dockMagnification(distance, DOCK_BASE_SIZE, MAX_SIZE, INFLUENCE);
        next.set(sound.id, size);
      }
      setScales(next);
    },
    [availableSounds, horizontal],
  );

  useEffect(() => {
    updateScales(cursor);
  }, [cursor, availableSounds, updateScales]);

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
        sound,
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
    const soundId = tooltipAnchor?.sound.id;
    if (!soundId) return;
    const el = itemRefs.current.get(soundId);
    const sound = availableSounds.find((item) => item.id === soundId);
    if (!el || !sound) return;
    syncTooltipAnchor(sound, el);
  }, [scales, tooltipAnchor?.sound.id, availableSounds, syncTooltipAnchor]);

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
          {availableSounds.map((sound) => {
            const isDragging = draggingSoundId === sound.id;
            const size = scales.get(sound.id) ?? DOCK_BASE_SIZE;
            const hoverScale = size / DOCK_BASE_SIZE;

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
                      src={getSoundIconSrc(sound.id, undefined, regionArt)}
                      alt=""
                      soundId={sound.id}
                      size="palette"
                    />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <DockMagnetTooltip anchor={tooltipAnchor} />
    </aside>
  );
});
