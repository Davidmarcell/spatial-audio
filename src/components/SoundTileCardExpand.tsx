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
import { useModalFocus } from '../hooks/useModalFocus';
import { getSoundArtworkForRegion, type RegionArtContext } from '../data/iconArt';
import { resolveTileIconSrc } from '../data/iconDetailSrc';
import { estimateDetailOpenRect, detailArtBox } from '../utils/detailArtLayout';
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

/** Card flight: App Store Arcade–style decelerating ease. */
const EXPAND_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
/** Short, decelerating flight without a lingering settle. */
const OPEN_MS = 380;
const CLOSE_MS = 280;
const TILE_RADIUS_PX = 13.6;
/** Copy fades in after this progress — body is already laid out at resting width. */
const COPY_REVEAL_AT = 0.78;

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

/** cubic-bezier(0.32, 0.72, 0, 1) — settles softly without a linear hard stop. */
function easeCardExpand(t: number): number {
  const c1x = 0.32;
  const c1y = 0.72;
  const c2x = 0;
  const c2y = 1;
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

/** Portrait grows taller; landscape locks ~330px tall and widens the card. */
function estimateOpenRect(
  panelWidthPx: number,
  imageSizePx: number,
  paddingPx: number,
  columnGapPx: number,
  aspect: number,
): Rect {
  const { left, top, width, height } = estimateDetailOpenRect(
    panelWidthPx,
    imageSizePx,
    paddingPx,
    columnGapPx,
    aspect,
  );
  return { left, top, width, height };
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
 * Art width + height share one progress (square → natural box together). The
 * sheet grows from the tile center on that same clock and always stays large
 * enough to contain the art, so portraits don't read as "width then height".
 * Copy fades in once the card is near resting width.
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
  /** Natural width/height of the tile image (portrait < 1). */
  const [artAspect, setArtAspect] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const openStartedRef = useRef(false);

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

  const tileSrc = useMemo(() => {
    if (!artwork) return '';
    return publicUrl(
      resolveTileIconSrc({
        src: artwork.src,
        sourceUrl: artwork.sourceUrl,
        detailSrc: artwork.detailSrc,
      }),
    );
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

  const restingRectFor = useCallback(
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

  const beginOpen = useCallback(
    (instanceId: string, aspect: number) => {
      const from = originRect ?? readLiveTileRect(instanceId);
      const to = restingRectFor(aspect);
      setAnimFrom(from);
      setAnimTo(to);
      setPhase('opening');
      if (!from) {
        setProgress(1);
        setPhase('open');
        return;
      }
      setProgress(0);
      animateProgress(0, 1, OPEN_MS, () => setPhase('open'));
    },
    [animateProgress, originRect, restingRectFor],
  );

  useLayoutEffect(() => {
    if (!open || !target) return;
    openStartedRef.current = false;
    setDisplayTarget(target);
    setIsPresent(true);
    setProgress(0);
    setPhase('opening');

    // Prefer starting once aspect is known so the destination height is right
    // from the first frame (avoids the grow→reset jump).
    const start = (aspect: number) => {
      if (openStartedRef.current) return;
      openStartedRef.current = true;
      setArtAspect(aspect);
      beginOpen(target.instanceId, aspect);
    };

    // Read the clicked tile, never the previously opened artwork. Lock the
    // aspect before flying; late image events must not retarget the destination.
    const tileImage = document.querySelector<HTMLImageElement>(
      `[data-instance-id="${CSS.escape(target.instanceId)}"] [data-sound-icon] img`,
    );
    if (tileImage?.naturalWidth && tileImage.naturalHeight) {
      start(tileImage.naturalWidth / tileImage.naturalHeight);
      return cancelAnim;
    }
    const image = new Image();
    image.onload = () => start(image.naturalWidth / Math.max(1, image.naturalHeight));
    image.onerror = () => start(1);
    if (tileImage?.currentSrc) image.src = tileImage.currentSrc;
    const fallbackTimer = window.setTimeout(() => start(1), 150);
    return () => {
      image.onload = null;
      image.onerror = null;
      window.clearTimeout(fallbackTimer);
      cancelAnim();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.instanceId]);

  useEffect(() => {
    if (open) return;
    if (!isPresent || !displayTarget) return;

    const current =
      snapshotOriginRect(sheetRef.current?.getBoundingClientRect() ?? null) ??
      animTo ??
      restingRectFor(artAspect);
    const tile =
      readLiveTileRect(displayTarget.instanceId) ?? originRect ?? current;

    setAnimFrom(tile);
    setAnimTo(current);
    setProgress(1);
    setPhase('closing');
    openStartedRef.current = false;

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
  const returnToTile = useCallback(() => {
    const id = displayTarget?.instanceId;
    if (!id) return null;
    return document.querySelector<HTMLElement>(`[data-instance-id="${CSS.escape(id)}"] [data-sound-icon]`);
  }, [displayTarget?.instanceId]);
  useModalFocus(isPresent && Boolean(displayTarget), sheetRef, returnToTile);

  useEffect(() => {
    if (!isPresent || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, isPresent, open]);

  if (!isPresent || !displayTarget || !artwork || !tileSrc || typeof document === 'undefined') {
    return null;
  }

  const from = animFrom ?? restingRectFor(artAspect);
  const to = animTo ?? restingRectFor(artAspect);
  const cardRadius = design.cardRadiusPx || DEFAULT_SOUND_TILE_DESIGN.cardRadiusPx;
  const radius = lerp(TILE_RADIUS_PX, cardRadius, progress);

  const pad = design.paddingPx;
  const openLayout = estimateDetailOpenRect(
    design.panelWidthPx,
    design.imageSizePx,
    design.paddingPx,
    design.columnGapPx,
    artAspect,
  );
  const destArtW = openLayout.artW;
  const destArtH = openLayout.artH;

  // One clock for both axes: square tile → final art box together.
  const faceLeft = lerp(0, (to.width - destArtW) / 2, progress);
  const faceTop = lerp(0, pad, progress);
  const faceWidth = lerp(from.width, destArtW, progress);
  const faceHeight = lerp(from.height, destArtH, progress);
  const faceRadius = lerp(TILE_RADIUS_PX, design.imageRadiusPx, progress);

  // Sheet tracks the resting card, but never smaller than the art + pad so a
  // portrait's height isn't gated behind the card's width travel.
  const cardW = lerp(from.width, to.width, progress);
  const cardH = lerp(from.height, to.height, progress);
  const sheetWidth = Math.max(cardW, faceWidth + faceLeft * 2);
  const sheetHeight = Math.max(cardH, faceHeight + faceTop * 2);
  // Grow from tile center → resting center so width/height bloom together.
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const toCx = to.left + to.width / 2;
  const toCy = to.top + to.height / 2;
  const sheetLeft = lerp(fromCx, toCx, progress) - sheetWidth / 2;
  const sheetTop = lerp(fromCy, toCy, progress) - sheetHeight / 2;

  const settled = phase === 'open';
  const showFace = !settled;
  // Body is locked to the resting card width (see below), so type never reflows
  // as the sheet finishes — it only fades in at full wrap.
  const showCopy = settled || progress >= COPY_REVEAL_AT;
  const infoOpacity = settled
    ? 1
    : showCopy
      ? Math.min(1, (progress - COPY_REVEAL_AT) / Math.max(0.001, 1 - COPY_REVEAL_AT))
      : 0;

  const artBox = detailArtBox(artAspect, design.imageSizePx);
  const sheetStyle = {
    ...designVars,
    '--sound-tile-art-width': `${destArtW}px`,
    '--sound-tile-art-height': `${destArtH}px`,
    '--sound-tile-image-size': `${artBox.isLandscape ? destArtW : design.imageSizePx}px`,
    left: `${sheetLeft}px`,
    top: `${sheetTop}px`,
    width: `${sheetWidth}px`,
    height: `${sheetHeight}px`,
    maxWidth: `min(${Math.max(design.panelWidthPx, to.width)}px, calc(100vw - 2.75rem))`,
    maxHeight: 'min(92dvh, calc(100dvh - 1.75rem))',
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
        data-detail-phase={phase}
        className={styles.sheet}
        style={sheetStyle}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={`${displayTarget.name} details`}
      >
        {showFace && (
          <div className={styles.face} style={faceStyle} data-detail-art="flight">
            {/* Same SoundIconImage path as the canvas tile (center-cover, no
                crop zoom) so the open handoff never reframes the art. */}
            <SoundIconImage
              src={artwork.src}
              sourceUrl={artwork.sourceUrl}
              detailSrc={artwork.detailSrc}
              alt={artwork.title}
              soundId={displayTarget.soundId}
              size="canvas"
              decodeSync
            />
          </div>
        )}

        {showCopy && (
          <div
            className={styles.body}
            style={{
              // Lay out at the resting card width immediately so title/artist
              // wrap at their final line breaks; the sheet clips until it
              // catches up — no mid-settle reflow.
              width: `${to.width}px`,
              minWidth: `${to.width}px`,
              flexShrink: 0,
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
              artAspect={artAspect}
              sharedArtBox={{ artW: destArtW, artH: destArtH, isLandscape: artAspect > 1.02 }}
              infoOpacity={infoOpacity}
            />
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
