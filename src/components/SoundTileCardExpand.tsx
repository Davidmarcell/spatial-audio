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

/** Approximate cubic-bezier(0.32, 0.72, 0, 1) for rAF progress. */
function easeCardExpand(t: number): number {
  // Sampled cubic bezier — calm decelerate, zero bounce.
  const c1x = 0.32;
  const c1y = 0.72;
  const c2x = 0;
  const c2y = 1;
  // Newton solve for x, then evaluate y.
  let x = t;
  for (let i = 0; i < 5; i += 1) {
    const u = 1 - x;
    const bx = 3 * u * u * x * c1x + 3 * u * x * x * c2x + x * x * x;
    const dx =
      3 * u * u * c1x + 6 * u * x * (c2x - c1x) + 3 * x * x * (1 - c2x);
    if (Math.abs(dx) < 1e-6) break;
    x -= (bx - t) / dx;
    x = Math.min(1, Math.max(0, x));
  }
  const u = 1 - x;
  return 3 * u * u * x * c1y + 3 * u * x * x * c2y + x * x * x;
}

function clampCardWidth(preferred: number): number {
  if (typeof window === 'undefined') return preferred;
  return Math.min(preferred, Math.max(280, window.innerWidth - 32));
}

/**
 * Resting card for shared-element expand. Art slot stays a square matching the
 * canvas tile crop, so the same image (src + cover + crop) never changes shape.
 */
function estimateOpenRect(
  panelWidthPx: number,
  imageSizePx: number,
  paddingPx: number,
): Rect {
  const width = clampCardWidth(panelWidthPx);
  const art = Math.min(imageSizePx, Math.max(120, width - paddingPx * 2));
  const height = Math.min(
    paddingPx * 2 + Math.max(art, 240),
    typeof window !== 'undefined' ? window.innerHeight * 0.85 : 420,
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
 * Shared-element card expand.
 * The flying face is the SAME canvas tile image (src + crop + cover) for the
 * whole flight and the settled art slot — never swapped for a detail asset mid-way.
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

  const artwork = useMemo(() => {
    if (!displayTarget) return null;
    return getSoundArtworkForRegion(
      regionArt.id,
      regionArt.soundIds,
      displayTarget.soundId,
      displayTarget.instanceId,
      regionArt.tags,
    );
  }, [displayTarget, regionArt]);

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
        setProgress(to);
        onDone?.();
        return;
      }

      const started = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / durationMs);
        setProgress(lerp(from, to, easeCardExpand(t)));
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFrameRef.current = null;
          setProgress(to);
          onDone?.();
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    },
    [cancelAnim],
  );

  const restingRect = useCallback(
    () => estimateOpenRect(design.panelWidthPx, design.imageSizePx, design.paddingPx),
    [design],
  );

  useLayoutEffect(() => {
    if (!open || !target) return;

    const from = originRect ?? readLiveTileRect(target.instanceId);
    const to = restingRect();
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
        animateProgress(0, 1, OPEN_MS, () => setPhase('open'));
      });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.instanceId]);

  useEffect(() => {
    if (open) return;
    if (!isPresent || !displayTarget) return;

    const current =
      snapshotOriginRect(sheetRef.current?.getBoundingClientRect() ?? null) ??
      animTo ??
      restingRect();
    const tile =
      readLiveTileRect(displayTarget.instanceId) ?? originRect ?? current;

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

  if (!isPresent || !displayTarget || !artwork || typeof document === 'undefined') {
    return null;
  }

  const from = animFrom ?? restingRect();
  const to = animTo ?? restingRect();
  const sheetRect = lerpRect(from, to, progress);
  const cardRadius = design.cardRadiusPx || DEFAULT_SOUND_TILE_DESIGN.cardRadiusPx;
  const radius = lerp(TILE_RADIUS_PX, cardRadius, progress);

  const pad = design.paddingPx;
  const destArt = Math.min(design.imageSizePx, Math.max(48, to.width - pad * 2));

  // Same square-ish cover image the whole way: fill the tile sheet → art slot.
  const faceLeft = lerp(0, pad, progress);
  const faceTop = lerp(0, pad, progress);
  const faceWidth = lerp(sheetRect.width, destArt, progress);
  const faceHeight = lerp(sheetRect.height, destArt, progress);
  const faceRadius = lerp(TILE_RADIUS_PX, design.imageRadiusPx, progress);

  const settled = phase === 'open';
  // Keep the shared face mounted until fully settled, then reveal the identical
  // square art underneath (same canvas image) — no asset swap mid-flight.
  const showFace = !settled;
  const infoOpacity = settled
    ? 1
    : Math.max(0, Math.min(1, (progress - 0.55) / 0.4));

  const sheetStyle = {
    ...designVars,
    left: `${sheetRect.left}px`,
    top: `${sheetRect.top}px`,
    width: `${sheetRect.width}px`,
    height: `${sheetRect.height}px`,
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

  const sharedImage = (
    <SoundIconImage
      src={artwork.src}
      sourceUrl={artwork.sourceUrl}
      detailSrc={artwork.detailSrc}
      alt={artwork.title}
      soundId={displayTarget.soundId}
      size="canvas"
    />
  );

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
        {showFace && (
          <div className={styles.face} style={faceStyle}>
            <div className={styles.faceImage}>{sharedImage}</div>
          </div>
        )}

        <div
          className={styles.body}
          style={{
            opacity: settled || progress > 0.4 ? 1 : 0,
          }}
        >
          <SoundArtDetailContent
            target={displayTarget}
            onVolumeChange={onVolumeChange}
            regionArt={regionArt}
            designConfig={design}
            onClose={close}
            artworkHidden={showFace}
            artworkMode="shared"
            infoOpacity={infoOpacity}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
