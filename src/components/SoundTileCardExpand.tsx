import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
import {
  type OriginRectSnapshot,
  snapshotOriginRect,
} from '../utils/overlayOriginAnimation';
import { SoundArtDetailContent, type DetailTarget } from './SoundArtDetail';
import { SoundIconImage } from './SoundIconImage';
import {
  DEFAULT_SOUND_TILE_DESIGN,
  loadSoundTileDesign,
  soundTileDesignToCssVars,
} from './soundTileDesign';
import styles from './SoundTileCardExpand.module.css';

/** Calm Apple-style curve from the card-expand reference (rselmi). */
const EXPAND_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const OPEN_MS = 440;
const CLOSE_MS = 380;
const TILE_RADIUS_PX = 13.6; // ~var(--tile-radius) 0.85rem

type Rect = OriginRectSnapshot;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originRect: OriginRectSnapshot | null;
  target: DetailTarget | null;
  onVolumeChange: (instanceId: string, volume: number) => void;
  regionArt: RegionArtContext;
  /** Fires after the reverse collapse finishes and the overlay unmounts. */
  onExited?: () => void;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRect(from: Rect, to: Rect, t: number): Rect {
  return {
    left: lerp(from.left, to.left, t),
    top: lerp(from.top, to.top, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
  };
}

function clampCardWidth(preferred: number): number {
  if (typeof window === 'undefined') return preferred;
  return Math.min(preferred, Math.max(280, window.innerWidth - 32));
}

function estimateOpenRect(panelWidthPx: number, imageSizePx: number, paddingPx: number): Rect {
  const width = clampCardWidth(panelWidthPx);
  const height = Math.min(
    paddingPx * 2 + imageSizePx + 16,
    typeof window !== 'undefined' ? window.innerHeight * 0.85 : 400,
  );
  const vw = typeof window !== 'undefined' ? window.innerWidth : width;
  const vh = typeof window !== 'undefined' ? window.innerHeight : height;
  return {
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    width,
    height,
  };
}

function readLiveTileRect(instanceId: string): Rect | null {
  if (typeof document === 'undefined') return null;
  const node = document.querySelector<HTMLElement>(
    `[data-instance-id="${instanceId}"] [data-sound-icon]`,
  );
  return snapshotOriginRect(node?.getBoundingClientRect() ?? null);
}

/**
 * Shared-element card expand for the sound detail tile.
 * Recipe (rselmi / card-expand): measure → mount clone → one progress value
 * interpolates the rect from the canvas tile to the resting card.
 */
export function SoundTileCardExpand({
  open,
  onOpenChange,
  originRect,
  target,
  onVolumeChange,
  regionArt,
  onExited,
}: Props) {
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;
  const design = useMemo(() => loadSoundTileDesign(), [open, target?.instanceId]);
  const designVars = useMemo(
    () => soundTileDesignToCssVars(design) as CSSProperties,
    [design],
  );

  const sheetRef = useRef<HTMLDivElement>(null);
  const [isPresent, setIsPresent] = useState(open);
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing'>('opening');
  const [progress, setProgress] = useState(0);
  const [animFrom, setAnimFrom] = useState<Rect | null>(null);
  const [animTo, setAnimTo] = useState<Rect | null>(null);
  const [displayTarget, setDisplayTarget] = useState<DetailTarget | null>(target);
  const animFrameRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  progressRef.current = progress;

  const cancelAnim = useCallback(() => {
    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const animateProgress = useCallback(
    (from: number, to: number, durationMs: number, onDone?: () => void) => {
      cancelAnim();
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        progressRef.current = to;
        setProgress(to);
        onDone?.();
        return;
      }

      const started = performance.now();
      // Matches the reference’s calm decelerating feel (approx of the bezier).
      const easeOut = (t: number) => 1 - (1 - t) ** 3;

      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / durationMs);
        const value = lerp(from, to, easeOut(t));
        progressRef.current = value;
        setProgress(value);
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFrameRef.current = null;
          progressRef.current = to;
          setProgress(to);
          onDone?.();
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    },
    [cancelAnim],
  );

  // Open: paint at the tile, then expand to the resting card.
  useLayoutEffect(() => {
    if (!open || !target) return;

    const from = originRect ?? readLiveTileRect(target.instanceId);
    const to = estimateOpenRect(design.panelWidthPx, design.imageSizePx, design.paddingPx);
    setAnimFrom(from);
    setAnimTo(to);
    setDisplayTarget(target);
    setIsPresent(true);
    setPhase('opening');

    if (!from) {
      setProgress(1);
      setPhase('open');
      return;
    }

    setProgress(0);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        animateProgress(0, 1, OPEN_MS, () => {
          // Prefer the real laid-out card box once content can settle.
          const measured = snapshotOriginRect(
            sheetRef.current?.getBoundingClientRect() ?? null,
          );
          if (measured && measured.width > 0) setAnimTo(measured);
          setPhase('open');
        });
      });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.instanceId]);

  // Close: collapse back onto the live canvas tile (shared-element reverse).
  useEffect(() => {
    if (open) return;
    if (!isPresent || !displayTarget) return;

    const current =
      snapshotOriginRect(sheetRef.current?.getBoundingClientRect() ?? null) ??
      animTo ??
      estimateOpenRect(design.panelWidthPx, design.imageSizePx, design.paddingPx);
    const tile =
      readLiveTileRect(displayTarget.instanceId) ?? originRect ?? current;

    setAnimFrom(tile);
    setAnimTo(current);
    // progress 1 = card (animTo), progress 0 = tile (animFrom) — same as open.
    // For close we swap: treat current as "from" visually by running 1→0 with
    // animFrom=tile and animTo=current... wait, lerpRect(animFrom, animTo, p)
    // at p=1 is animTo (card), at p=0 is animFrom (tile). So set:
    setAnimFrom(tile);
    setAnimTo(current);
    setProgress(1);
    setPhase('closing');

    animateProgress(1, 0, CLOSE_MS, () => {
      setIsPresent(false);
      setPhase('opening');
      setProgress(0);
      setDisplayTarget(null);
      onExitedRef.current?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => cancelAnim(), [cancelAnim]);

  useEffect(() => {
    if (!open || !target) return;
    setDisplayTarget(target);
  }, [open, target]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!isPresent || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, isPresent, open]);

  if (!isPresent || !displayTarget || typeof document === 'undefined') {
    return null;
  }

  const from =
    animFrom ??
    estimateOpenRect(design.panelWidthPx, design.imageSizePx, design.paddingPx);
  const to =
    animTo ??
    estimateOpenRect(design.panelWidthPx, design.imageSizePx, design.paddingPx);
  const sheetRect = lerpRect(from, to, progress);
  const cardRadius = design.cardRadiusPx || DEFAULT_SOUND_TILE_DESIGN.cardRadiusPx;
  const radius = lerp(TILE_RADIUS_PX, cardRadius, progress);

  const pad = design.paddingPx;
  const imageSize = design.imageSizePx;
  const faceLeft = lerp(0, pad, progress);
  const faceTop = lerp(0, pad, progress);
  const faceWidth = lerp(
    sheetRect.width,
    Math.min(imageSize, Math.max(48, sheetRect.width - pad * 2)),
    progress,
  );
  const faceHeight = lerp(
    sheetRect.height,
    Math.min(imageSize, Math.max(48, sheetRect.height - pad * 2)),
    progress,
  );
  const faceRadius = lerp(TILE_RADIUS_PX, design.imageRadiusPx, progress);

  const settled = phase === 'open';
  const artwork = getSoundArtworkForRegion(
    regionArt.id,
    regionArt.soundIds,
    displayTarget.soundId,
    displayTarget.instanceId,
    regionArt.tags,
  );

  const sheetStyle = {
    ...designVars,
    left: `${sheetRect.left}px`,
    top: `${sheetRect.top}px`,
    width: `${sheetRect.width}px`,
    height: settled ? 'auto' : `${sheetRect.height}px`,
    maxWidth: `min(${design.panelWidthPx}px, calc(100vw - 2rem))`,
    maxHeight: 'min(85dvh, calc(100dvh - 2.5rem))',
    borderRadius: `${radius}px`,
  } as CSSProperties;

  const faceStyle = {
    left: `${faceLeft}px`,
    top: `${faceTop}px`,
    width: `${faceWidth}px`,
    height: `${faceHeight}px`,
    borderRadius: `${faceRadius}px`,
  } as CSSProperties;

  return createPortal(
    <>
      <div
        className={`${styles.backdrop} ${progress > 0.04 || settled ? styles.backdropOpen : ''}`}
        style={{
          opacity: phase === 'closing' ? Math.max(0, Math.min(1, progress)) : undefined,
          transitionTimingFunction: EXPAND_EASE,
          transitionDuration: phase === 'closing' ? `${CLOSE_MS}ms` : '300ms',
        }}
        aria-hidden
        onClick={close}
      />
      <div
        ref={sheetRef}
        className={styles.sheet}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`${displayTarget.name} details`}
      >
        {!settled && (
          <div className={styles.face} style={faceStyle}>
            <div className={styles.faceImage}>
              <SoundIconImage
                src={artwork.src}
                sourceUrl={artwork.sourceUrl}
                detailSrc={artwork.detailSrc}
                alt={artwork.title}
                soundId={displayTarget.soundId}
                size="detail"
              />
            </div>
          </div>
        )}

        {settled && (
          <div className={`${styles.body} ${styles.bodyVisible}`}>
            <SoundArtDetailContent
              target={displayTarget}
              onVolumeChange={onVolumeChange}
              regionArt={regionArt}
              designConfig={design}
              onClose={close}
            />
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
