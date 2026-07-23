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
import { iconSrcFallbackChain } from '../data/iconDetailSrc';
import { publicUrl } from '../utils/publicUrl';
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
const OPEN_MS = 460;
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

function clampCardWidth(preferred: number): number {
  if (typeof window === 'undefined') return preferred;
  return Math.min(preferred, Math.max(280, window.innerWidth - 32));
}

/**
 * Resting card box. `aspect` is width/height of the detail art so the
 * destination image slot (and card height) match the settled layout — this is
 * what removes the end-of-expand jump.
 */
function estimateOpenRect(
  panelWidthPx: number,
  imageSizePx: number,
  paddingPx: number,
  columnGapPx: number,
  aspect: number,
): Rect {
  const width = clampCardWidth(panelWidthPx);
  const artW = Math.min(imageSizePx, Math.max(120, width - paddingPx * 2));
  const artH = artW / Math.max(0.35, aspect);
  // Two-column card: height follows the taller of art vs a modest info column.
  const contentH = Math.max(artH, 240);
  const height = Math.min(
    paddingPx * 2 + contentH,
    typeof window !== 'undefined' ? window.innerHeight * 0.85 : 420,
  );
  const vw = typeof window !== 'undefined' ? window.innerWidth : width;
  const vh = typeof window !== 'undefined' ? window.innerHeight : height;
  void columnGapPx;
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
 * One progress value drives the sheet rect AND the image face into the same
 * slot the settled content uses, so the handoff does not jump on aspect ratio.
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
  /** Detail art width/height — drives destination face size. */
  const [artAspect, setArtAspect] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  progressRef.current = progress;

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

  // Prefetch natural aspect so the expand lands on the real image box.
  useEffect(() => {
    if (!artwork) return;
    const chain = iconSrcFallbackChain(
      {
        src: artwork.src,
        sourceUrl: artwork.sourceUrl,
        detailSrc: artwork.detailSrc,
      },
      'detail',
    );
    let cancelled = false;
    const probe = (index: number) => {
      const src = chain[index];
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setArtAspect(img.naturalWidth / img.naturalHeight);
        }
      };
      img.onerror = () => {
        if (!cancelled) probe(index + 1);
      };
      img.src = publicUrl(src);
    };
    probe(0);
    return () => {
      cancelled = true;
    };
  }, [artwork]);

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
      // Approx of cubic-bezier(0.32, 0.72, 0, 1) — calm decelerate, no bounce.
      const easeOut = (t: number) => {
        const u = 1 - t;
        return 1 - u * u * u * (1 - t * 0.15);
      };

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

  const restingRect = useCallback(
    (aspect: number) =>
      estimateOpenRect(
        design.panelWidthPx,
        design.imageSizePx,
        design.paddingPx,
        design.columnGapPx,
        aspect,
      ),
    [design],
  );

  // Open: paint at the tile, then expand into the aspect-correct resting card.
  useLayoutEffect(() => {
    if (!open || !target) return;

    const from = originRect ?? readLiveTileRect(target.instanceId);
    const to = restingRect(artAspect);
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
    // Re-run when aspect resolves so a late natural size can retarget mid-open
    // only if we have not finished yet — handled separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.instanceId]);

  // If aspect arrives during opening, retarget the destination without restarting.
  useEffect(() => {
    if (phase !== 'opening') return;
    setAnimTo(restingRect(artAspect));
  }, [artAspect, phase, restingRect]);

  // Close: collapse back onto the live canvas tile.
  useEffect(() => {
    if (open) return;
    if (!isPresent || !displayTarget) return;

    const current =
      snapshotOriginRect(sheetRef.current?.getBoundingClientRect() ?? null) ??
      animTo ??
      restingRect(artAspect);
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

  const from = animFrom ?? restingRect(artAspect);
  const to = animTo ?? restingRect(artAspect);
  const sheetRect = lerpRect(from, to, progress);
  const cardRadius = design.cardRadiusPx || DEFAULT_SOUND_TILE_DESIGN.cardRadiusPx;
  const radius = lerp(TILE_RADIUS_PX, cardRadius, progress);

  const pad = design.paddingPx;
  const destArtW = Math.min(
    design.imageSizePx,
    Math.max(48, to.width - pad * 2),
  );
  const destArtH = destArtW / Math.max(0.35, artAspect);

  // Shared face: full-bleed cover on the tile → natural art slot in the card.
  const faceLeft = lerp(0, pad, progress);
  const faceTop = lerp(0, pad, progress);
  const faceWidth = lerp(sheetRect.width, destArtW, progress);
  const faceHeight = lerp(sheetRect.height, destArtH, progress);
  const faceRadius = lerp(TILE_RADIUS_PX, design.imageRadiusPx, progress);
  // Blend cover → contain so the crop eases into the natural frame.
  const faceObjectFit = progress < 0.72 ? 'cover' : 'contain';

  const settled = phase === 'open';
  const showFace = !settled;
  const infoOpacity = settled
    ? 1
    : Math.max(0, Math.min(1, (progress - 0.5) / 0.45));

  const sheetStyle = {
    ...designVars,
    left: `${sheetRect.left}px`,
    top: `${sheetRect.top}px`,
    width: `${sheetRect.width}px`,
    // Keep a fixed interpolated height through the flight so content can lay
    // out underneath without popping the sheet when we hand off.
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
        {showFace && (
          <div className={styles.face} style={faceStyle}>
            <div className={styles.faceImage} data-fit={faceObjectFit}>
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

        <div
          className={`${styles.body} ${settled || progress > 0.35 ? styles.bodyVisible : ''}`}
          style={{
            // Content is present under the face so the art slot is already the
            // correct size when we reveal it — no layout jump at settle.
            opacity: settled || progress > 0.35 ? 1 : 0,
          }}
        >
          <SoundArtDetailContent
            target={displayTarget}
            onVolumeChange={onVolumeChange}
            regionArt={regionArt}
            designConfig={design}
            onClose={close}
            artworkHidden={showFace}
            infoOpacity={infoOpacity}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
