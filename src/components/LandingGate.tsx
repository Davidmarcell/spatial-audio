import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { animateRise } from './sheetRise';
import { FALLBACK_ICON_SRC } from '../data/iconDetailSrc';
import { getLocationArtForItem } from '../data/locationArt';
import {
  formatWorldLocationLabel,
  worldLocations,
  type WorldLocation,
} from '../data/worldLocations';
import { publicUrl } from '../utils/publicUrl';
import {
  DEFAULT_FAN_CONFIG,
  DESKTOP_TILE_PX,
  MOBILE_FAN_CONFIG,
  MOBILE_TILE_PX,
  type FanConfig,
} from './landingFan';
import styles from './LandingGate.module.css';

/**
 * Number of tiles in the landing fan. Each load draws a fresh random selection
 * from the full valid roster, so the row is never the same six twice.
 */
const LANDING_TILE_COUNT = 6;

/** The hero wordmark, split per letter so each glyph can cascade in on its own
 * beat. The readable word is exposed to assistive tech via the container's
 * `aria-label`; the visible per-letter spans are decorative (`aria-hidden`). */
const WORDMARK_TEXT = 'Saudade';

/** Compact breakpoint — keep in sync with App / dock mobile media queries. */
const COMPACT_MQ = '(max-width: 768px)';

/**
 * Minimum time the centred mobile wordmark stays up before it may shrink into
 * the settled hero (even if art is already cached).
 */
const MOBILE_WORDMARK_HOLD_MS = 920;
/** Cap so a slow tile never blocks the landing forever. */
const MOBILE_PRELOAD_TIMEOUT_MS = 4200;

/** Fisher-Yates shuffle over a fresh copy (never mutates the source array). */
function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Cursor-magnet: the tile drifts a fraction of the pointer offset towards the
// cursor, capped so the nudge stays gentle. Mirrors the dock magnet's feel
// (SoundPalette) but implemented as a lightweight per-tile pointer-follow.
const MAGNET_STRENGTH = 0.16;
const MAGNET_MAX_PX = 8;

type LandingLocation = {
  location: WorldLocation;
  src: string;
  label: string;
};

type LandingPhase = 'booting' | 'revealed';

type Props = {
  /** Enter the app at this location and start its soundscape. */
  onSelect: (location: WorldLocation) => void;
  /** Search entry rendered below the body copy (reuses the app search). */
  search?: ReactNode;
  /** Live fan layout; falls back to the persisted/default "Hand of cards". */
  fanConfig?: FanConfig;
  /**
   * Enters the experience: resumes audio and opens the full-screen world map
   * (browse all soundscapes). Wired to the Enter button and empty-query Enter.
   */
  onEnter?: () => void;
  /**
   * True while the landing search is expanded. Dims the wordmark and the fan of
   * tiles to a soft background presence (they stay visible, not hidden) so the
   * expanded search reads as the focus.
   */
  searchOpen?: boolean;
  /**
   * True while the shared page wipe is sweeping the landing away (Enter, or a
   * location entry). The landing content lifts up and the whole gate cross-fades
   * so the incoming globe/workspace sheet is revealed rising underneath. The
   * gate is briefly raised above the globe (but below the wipe) so the lift is
   * visible through the reveal; the host unmounts it once the wipe completes.
   */
  exiting?: boolean;
  /**
   * True for one shot while the landing is the INCOMING page returning home
   * (map close -> landing, or the wordmark home). The whole gate rises up from
   * below the viewport over the lifting outgoing page (the globe, or the
   * workspace) with the shared curved top edge, then settles into a normal full
   * page. No cover panel and no cross-fade: the real home page is what rises.
   */
  entering?: boolean;
  /** Fired once the gate has finished rising into place (home-rise). */
  onEntered?: () => void;
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function isCompactViewport() {
  return (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(COMPACT_MQ).matches
  );
}

function preloadImages(srcs: string[]): Promise<void> {
  if (srcs.length === 0) return Promise.resolve();
  return Promise.all(
    srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = 'async';
          const done = () => resolve();
          image.onload = done;
          image.onerror = done;
          image.src = src;
        }),
    ),
  ).then(() => undefined);
}

const clampMagnet = (value: number) =>
  Math.max(-MAGNET_MAX_PX, Math.min(MAGNET_MAX_PX, value));

const FALLBACK_TILE_SRC = publicUrl(FALLBACK_ICON_SRC);

/** Fan tile image with a local fallback so a transient 404/abort after go-home
 * cannot leave a permanent broken-image icon in the hero row. */
function LandingFanImage({ src, sizePx }: { src: string; sizePx: number }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [didFallback, setDidFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setDidFallback(false);
  }, [src]);

  return (
    <img
      key={currentSrc}
      className={styles.locationImage}
      src={currentSrc}
      alt=""
      width={sizePx}
      height={sizePx}
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => {
        if (didFallback || currentSrc === FALLBACK_TILE_SRC) return;
        setDidFallback(true);
        setCurrentSrc(FALLBACK_TILE_SRC);
      }}
    />
  );
}

export function LandingGate({
  onSelect,
  search,
  fanConfig,
  onEnter,
  searchOpen = false,
  exiting = false,
  entering = false,
  onEntered,
}: Props) {
  const gateRef = useRef<HTMLDivElement>(null);
  const onEnteredRef = useRef(onEntered);
  useEffect(() => {
    onEnteredRef.current = onEntered;
  });

  const [compact, setCompact] = useState(() => isCompactViewport());
  // Mobile cold boot: centre the wordmark first, then reveal the fan once art
  // is warm. Home-rise and reduced-motion skip straight to the settled hero so
  // the rising page already looks complete.
  const [phase, setPhase] = useState<LandingPhase>(() => {
    if (prefersReducedMotion() || entering || !isCompactViewport()) return 'revealed';
    return 'booting';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mq = window.matchMedia(COMPACT_MQ);
    const sync = () => {
      const next = mq.matches;
      setCompact(next);
      if (!next) setPhase('revealed');
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Home-rise (approach A, in reverse): when the landing is the incoming page
  // returning home, the whole gate rises up over the lifting outgoing page with
  // the shared curved top edge, then settles into a normal full page (inline
  // transform/clip cleared). Reduced motion skips the rise and swaps in at once.
  useLayoutEffect(() => {
    if (!entering) return undefined;
    const el = gateRef.current;
    if (!el) return undefined;

    if (prefersReducedMotion()) {
      onEnteredRef.current?.();
      return undefined;
    }

    const cancel = animateRise(el, {
      onDone: () => {
        el.style.transform = '';
        el.style.clipPath = '';
        el.style.willChange = '';
        onEnteredRef.current?.();
      },
    });
    return () => {
      cancel();
      // If interrupted, drop the inline rise styles so nothing is left stuck
      // mid-rise.
      el.style.transform = '';
      el.style.clipPath = '';
      el.style.willChange = '';
    };
  }, [entering]);

  const locations = useMemo<LandingLocation[]>(() => {
    // Draw a fresh random six from the full valid roster on every landing load.
    // Only genuine curated pins with bespoke art qualify, so no tile can render
    // broken (missing pin or missing illustration).
    const candidates = worldLocations.flatMap((location) => {
      if (location.custom) return [];
      const art = getLocationArtForItem(location);
      if (!art) return [];
      return [
        {
          location,
          src: publicUrl(art.src),
          label: formatWorldLocationLabel(location),
        },
      ];
    });
    return shuffle(candidates).slice(0, LANDING_TILE_COUNT);
  }, []);

  // Mobile boot: hold the centred wordmark, preload fan art, then settle into
  // the hero (wordmark shrinks up, tiles cascade in). Desktop keeps the older
  // overlapping entrance and only warms the cache.
  useEffect(() => {
    if (phase !== 'booting') {
      if (locations.length === 0) return;
      locations.forEach(({ src }) => {
        const image = new Image();
        image.decoding = 'async';
        image.src = src;
      });
      return undefined;
    }

    let cancelled = false;
    const hold = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MOBILE_WORDMARK_HOLD_MS);
    });
    const preload = Promise.race([
      preloadImages(locations.map((item) => item.src)),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, MOBILE_PRELOAD_TIMEOUT_MS);
      }),
    ]);

    void Promise.all([hold, preload]).then(() => {
      if (!cancelled) setPhase('revealed');
    });

    return () => {
      cancelled = true;
    };
  }, [locations, phase]);

  const handleTilePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion()) return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    el.style.setProperty('--magnet-x', `${clampMagnet(dx * MAGNET_STRENGTH)}px`);
    el.style.setProperty('--magnet-y', `${clampMagnet(dy * MAGNET_STRENGTH)}px`);
  };

  const resetTileMagnet = (event: PointerEvent<HTMLButtonElement>) => {
    const el = event.currentTarget;
    el.style.setProperty('--magnet-x', '0px');
    el.style.setProperty('--magnet-y', '0px');
  };

  const fan = compact ? MOBILE_FAN_CONFIG : (fanConfig ?? DEFAULT_FAN_CONFIG);
  const tilePx = compact ? MOBILE_TILE_PX : DESKTOP_TILE_PX;
  const showHeroRest = phase === 'revealed';

  // Reserve just enough room below the fan for the arc drop and the rotated
  // tiles' lowest corners, so the tagline always clears the lowest tile. The
  // hover lift and magnet nudge are transform-only (no reflow) and are absorbed
  // by the even gap, so they need no extra reservation.
  const theta = (fan.endRotationDeg * Math.PI) / 180;
  const rotationOverhangPx =
    (tilePx * (Math.abs(Math.sin(theta)) + Math.abs(Math.cos(theta)) - 1)) / 2;
  const fanPadBottomPx = Math.ceil(fan.arcDepthPx + rotationOverhangPx + 4);

  const content = (
    <div
      ref={gateRef}
      className={styles.gate}
      data-theme="light"
      data-landing-gate=""
      data-phase={phase}
      data-compact={compact ? 'true' : undefined}
      data-exiting={exiting ? 'true' : undefined}
      data-entering={entering ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Enter Saudade"
      aria-busy={phase === 'booting' ? true : undefined}
    >
      <div className={styles.inner} data-search-open={searchOpen ? 'true' : undefined}>
        <h1 className={styles.wordmark} aria-label={WORDMARK_TEXT}>
          {WORDMARK_TEXT.split('').map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className={styles.wordmarkLetter}
              aria-hidden="true"
              style={{ '--letter-index': index } as React.CSSProperties}
            >
              {letter}
            </span>
          ))}
        </h1>
        {showHeroRest && (
          <>
            <ul
              className={styles.locationRow}
              style={
                {
                  '--overlap': `${fan.overlapRem}rem`,
                  '--fan-pad-bottom': `${fanPadBottomPx}px`,
                  '--tile-size': `${tilePx}px`,
                } as React.CSSProperties
              }
            >
              {locations.map(({ location, src, label }, index) => {
                // Normalised distance from the centre of the row (−1 … +1), so the
                // fan rotation, arch and edge scale stay symmetric for any tile count.
                const centre = (locations.length - 1) / 2;
                const offset = centre === 0 ? 0 : (index - centre) / centre;
                const restRotation = offset * fan.endRotationDeg;
                const arcY = offset * offset * fan.arcDepthPx;
                const restScale = 1 - Math.abs(offset) * fan.scaleFalloff;
                return (
                  <li
                    key={location.id}
                    className={styles.locationItem}
                    style={{ '--landing-index': index } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      className={styles.locationButton}
                      data-tooltip={label}
                      aria-label={`Enter ${label}`}
                      style={{
                        '--rest-rot': `${restRotation.toFixed(2)}deg`,
                        '--arc-y': `${arcY.toFixed(2)}px`,
                        '--rest-scale': restScale.toFixed(3),
                      } as React.CSSProperties}
                      onClick={() => onSelect(location)}
                      onPointerMove={handleTilePointerMove}
                      onPointerLeave={resetTileMagnet}
                      onPointerCancel={resetTileMagnet}
                      onBlur={(event) => {
                        event.currentTarget.style.setProperty('--magnet-x', '0px');
                        event.currentTarget.style.setProperty('--magnet-y', '0px');
                      }}
                    >
                      <LandingFanImage src={src} sizePx={tilePx} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className={styles.tagline}>
              An experience of sound. Invoking places, and the memories they hold through spatial audio. Best experienced with headphones.
            </p>
            {search && (
              <div className={styles.searchSlot}>
                <div className={styles.searchRow}>
                  {search}
                  {onEnter && (
                    <button
                      type="button"
                      className={styles.enterButton}
                      onClick={onEnter}
                    >
                      Enter
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Portal the gate to <body> so its stacking lives at the document root, above
  // the full-screen globe/map page (a body portal at z-index 400). The incoming
  // home-rise raises the gate to z-index 450 so it genuinely RISES over the
  // lifting globe with the shared curved edge, rather than being trapped inside
  // the app's isolated stacking context (the SheetStack outlet) beneath the
  // globe, which made the rise play hidden and then hard-cut in when the globe
  // unmounted.
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
