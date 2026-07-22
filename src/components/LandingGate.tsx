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
import { getLocationArtForItem } from '../data/locationArt';
import {
  formatWorldLocationLabel,
  worldLocations,
  type WorldLocation,
} from '../data/worldLocations';
import { publicUrl } from '../utils/publicUrl';
import { DEFAULT_FAN_CONFIG, type FanConfig } from './landingFan';
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

// Landing tile edge length in px (mirror of the CSS `.locationImage` size). Used
// to reserve enough vertical room beneath the fan that no tile overlaps the body
// copy, accounting for the arc drop plus the rotated tiles' hanging corners.
const TILE_PX = 150;

type LandingLocation = {
  location: WorldLocation;
  src: string;
  label: string;
};

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

const clampMagnet = (value: number) =>
  Math.max(-MAGNET_MAX_PX, Math.min(MAGNET_MAX_PX, value));

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

  // The tile art is decoded off-screen before the fan is allowed to animate in,
  // so images are ready to paint the instant each tile rises rather than popping
  // in after layout once their own async decode finishes. A short fallback makes
  // sure a slow or failed decode can never trap the fan hidden. Until ready the
  // tiles reserve their full space and simply stay invisible (no layout shift).
  const [tilesReady, setTilesReady] = useState(false);
  useEffect(() => {
    if (locations.length === 0) {
      setTilesReady(true);
      return;
    }
    let cancelled = false;
    const decodes = locations.map(({ src }) => {
      const image = new Image();
      image.src = src;
      return image.decode().catch(() => undefined);
    });
    const fallback = window.setTimeout(() => {
      if (!cancelled) setTilesReady(true);
    }, 600);
    void Promise.all(decodes).then(() => {
      if (cancelled) return;
      window.clearTimeout(fallback);
      setTilesReady(true);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [locations]);

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

  const fan = fanConfig ?? DEFAULT_FAN_CONFIG;

  // Reserve just enough room below the fan for the arc drop and the rotated
  // tiles' lowest corners, so the tagline always clears the lowest tile. The
  // hover lift and magnet nudge are transform-only (no reflow) and are absorbed
  // by the even gap, so they need no extra reservation.
  const theta = (fan.endRotationDeg * Math.PI) / 180;
  const rotationOverhangPx =
    (TILE_PX * (Math.abs(Math.sin(theta)) + Math.abs(Math.cos(theta)) - 1)) / 2;
  const fanPadBottomPx = Math.ceil(fan.arcDepthPx + rotationOverhangPx + 4);

  const content = (
    <div
      ref={gateRef}
      className={styles.gate}
      data-theme="light"
      data-landing-gate=""
      data-exiting={exiting ? 'true' : undefined}
      data-entering={entering ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Enter Saudade"
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
        <ul
          className={styles.locationRow}
          data-tiles-ready={tilesReady ? 'true' : undefined}
          style={
            {
              '--overlap': `${fan.overlapRem}rem`,
              '--fan-pad-bottom': `${fanPadBottomPx}px`,
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
                  <img
                    className={styles.locationImage}
                    src={src}
                    alt=""
                    width={TILE_PX}
                    height={TILE_PX}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
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
