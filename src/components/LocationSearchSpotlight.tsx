import { UiIcon } from './UiIcon';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { AppLocation } from '../data/environments';
import { getRegion } from '../data/environments';
import { getLocationArtForItem } from '../data/locationArt';
import { publicUrl } from '../utils/publicUrl';
import { resolveProceduralSoundscape } from '../utils/proceduralSoundscape';
import {
  createCustomWorldLocation,
  formatWorldLocationLabel,
  type WorldLocation,
} from '../data/worldLocations';
import {
  fetchGeocodeResults,
  GEOCODE_DEBOUNCE_MS,
  type GeocodeResult,
} from '../utils/geocode';
import { useSearchSpotlightAnimation } from '../context/SearchSpotlightAnimationContext';
import {
  computeCloseShrinkPhaseDurationMs,
  computeCloseWidthStartDelayMs,
  computeRisePhaseDurationMs,
  computeRiseStartDelayMs,
} from '../utils/searchSpotlightAnimation';
import styles from './LocationSearchSpotlight.module.css';

type Props = {
  appLocations: readonly AppLocation[];
  worldLocations: readonly WorldLocation[];
  environmentId: string;
  regionId: string;
  onChange: (
    environmentId: string,
    regionId: string,
    customLocation?: WorldLocation,
  ) => void;
  onOpenChange?: (open: boolean) => void;
  blocked?: boolean;
  /**
   * Soft-recede the portalled pill under a higher overlay (e.g. sound tile).
   * Unlike `blocked`, the pill stays mounted for layout continuity, but it is
   * dimmed, non-interactive, and forced below the overlay scrim.
   */
  recessed?: boolean;
  resetToken?: number;
  /**
   * Overrides the collapsed pill's resting label (normally the current region
   * name). Used on the landing gate to invite a search ("Search your
   * location") instead of echoing the pre-entry location.
   */
  idleLabel?: string;
  /**
   * Direction the panel expands when opened. Default (and landing) grow
   * UPWARD so the open sheet stays in the viewport. Prefer `down` only when
   * the collapsed pill sits high enough that downward growth remains on-screen.
   */
  expandDirection?: 'up' | 'down';
  /**
   * Forces a theme on the portalled panel/backdrop (which render to
   * document.body and so escape a landing container's `data-theme`). Used to
   * keep the landing search in light mode regardless of the global theme.
   */
  theme?: 'light' | 'dark';
  /**
   * Called when Enter is pressed with an empty query and no highlighted result.
   * Used on the landing to open the full-page globe (browse everything).
   */
  onEmptyEnter?: () => void;
  /**
   * Renders the full-screen backdrop scrim behind the panel. The landing keeps
   * its hero content softly visible instead, so it opts out.
   */
  backdrop?: boolean;
  /**
   * Scales the search shell up ~15% (landing hero moment) via its metric custom
   * properties, so the whole pill and expanded panel grow together.
   */
  enlarged?: boolean;
  /**
   * Landing only: the collapsed pill sits left of the page centre because the
   * Enter button shares its row, so recentre the EXPANDED panel on the viewport
   * centre. Driven by a `--recenter-x` translate on the portal anchor that is 0
   * while collapsed (so the resting pill never moves, and there is no hover/focus
   * jump) and eases to the page-centre offset as the panel widens.
   */
  recenterOnExpand?: boolean;
  /**
   * The pill is portalled to `document.body`, so it does NOT inherit the page
   * transform that carries its host (the landing gate, or the workspace bottom
   * bar) during a page transition. Rather than measuring the host every frame
   * (which lags a frame and reads as two separate assets moving at different
   * speeds), the portal replays the SAME animation on the SAME clock:
   *
   *   • `exit-lift`  — host page is lifting away (landing exit / workspace push
   *                    under a rising sheet). Mirrors `pageExitLift`.
   *   • `rise-home`  — host page is rising home from below (`animateRise`).
   *   • `scene-rise` — workspace assets nudge up as a cover reveals the scene.
   *
   * The pill's resting anchor is frozen for the duration, so the animation is
   * the only motion and it lands exactly where it started/belongs.
   */
  pageMotion?: PageMotion;
};

export type PageMotion = 'none' | 'exit-lift' | 'rise-home' | 'scene-rise';

type SearchItem = {
  key: string;
  name: string;
  subtitle: string;
  environmentId: string;
  regionId: string;
};
type PanelAnchor = {
  top: number;
  height: number;
  centerX: number;
};
type SpotlightPhase =
  | 'closed'
  | 'opening-width'
  | 'opening-rise'
  | 'open'
  | 'closing-drop'
  | 'closing-shrink';

const SEARCH_FOCUS_SETTLE_MS = 32;

// A short, tasteful beat while a searched place is turned into a bespoke
// procedural soundscape. The resolve itself is synchronous and instant, so this
// is purely the on-brand "generating" moment. Trimmed right down when the
// visitor prefers reduced motion.
const GENERATE_HOLD_MS = 900;
const GENERATE_HOLD_REDUCED_MS = 260;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Outgoing-page push, kept in sync with `pageExitLift` (App.module.css) and
// `landingExitLift` (LandingGate.module.css) so the portalled pill lifts on
// exactly the same geometry as the page that owns it.
const PAGE_EXIT_SCALE = 0.96;
const PAGE_EXIT_LIFT_VH = 0.18;

// Read an element's current translateY (px) from its computed transform matrix.
// Used to strip a transformed ancestor's live vertical offset off a measured
// rect so the portal anchor always describes the element's RESTING baseline,
// never a transient mid-animation position.
function readTranslateY(el: Element): number {
  const transform = window.getComputedStyle(el).transform;
  if (!transform || transform === 'none') return 0;
  const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
  if (matrix3d) {
    const ty = Number(matrix3d[1].split(',')[13]);
    return Number.isFinite(ty) ? ty : 0;
  }
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (matrix) {
    const ty = Number(matrix[1].split(',')[5]);
    return Number.isFinite(ty) ? ty : 0;
  }
  return 0;
}

// Recommended is a fresh random draw from the full curated catalog each time the
// panel opens (and on load), sized to comfortably fill the taller panel.
const RECOMMENDED_COUNT = 4;

// Trending is a fresh random draw from the full curated catalog each time the
// panel opens (excluding whatever is already drawn into Recommended).
const TRENDING_COUNT = 6;

function shuffleItems(items: SearchItem[]): SearchItem[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function itemKey(environmentId: string, regionId: string) {
  return `${environmentId}:${regionId}`;
}

function matchesQuery(name: string, subtitle: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    name.toLowerCase().includes(normalized) || subtitle.toLowerCase().includes(normalized)
  );
}

function buildSearchCatalog(
  appLocations: readonly AppLocation[],
  worldLocations: readonly WorldLocation[],
): SearchItem[] {
  const subtitleByRegion = new Map<string, string>();
  for (const location of worldLocations) {
    subtitleByRegion.set(itemKey(location.environmentId, location.regionId), location.subtitle);
  }

  const seen = new Set<string>();
  const items: SearchItem[] = [];

  for (const location of appLocations) {
    const key = itemKey(location.environmentId, location.regionId);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      name: location.name,
      subtitle: subtitleByRegion.get(key) ?? '',
      environmentId: location.environmentId,
      regionId: location.regionId,
    });
  }

  for (const location of worldLocations) {
    if (location.custom) continue;
    const key = itemKey(location.environmentId, location.regionId);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      name: location.name,
      subtitle: location.subtitle,
      environmentId: location.environmentId,
      regionId: location.regionId,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

// A small, cute map-pin glyph shown inside a thumbnail surface whenever there
// is no curated artwork (the geocoded "More places" entries, and any
// recommended/trending item that lacks art). It inherits the surface's muted
// token colour via `currentColor`, so it reads gently in both light and dark.
function ThumbMapIcon() {
  return (
    <svg
      className={styles.thumbIcon}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.15" fill="currentColor" />
    </svg>
  );
}

// The empty-state thumbnail: the shared fallback surface (now a 12px rounded
// square, matching the curated art tiles) with the cute map pin centred inside.
function ThumbPlaceholder({ className }: { className?: string }) {
  return (
    <span
      className={`${styles.thumbFallback}${className ? ` ${className}` : ''}`}
      aria-hidden
    >
      <ThumbMapIcon />
    </span>
  );
}

function LocationThumbnail({ item }: { item: SearchItem }) {
  const art = getLocationArtForItem(item);
  const [failed, setFailed] = useState(false);

  if (!art || failed) {
    return <ThumbPlaceholder />;
  }

  return (
    <span className={styles.thumbWrap}>
      <img
        src={publicUrl(art.src)}
        alt=""
        className={styles.thumb}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function searchItemLabel(item: SearchItem): string {
  return formatWorldLocationLabel(item);
}

function geocodeResultLabel(result: GeocodeResult): string {
  return formatWorldLocationLabel({
    name: result.shortName,
    subtitle: result.subtitle || '',
  });
}

function TrendingRow({
  items,
  onSelect,
}: {
  items: SearchItem[];
  onSelect: (item: SearchItem) => void;
}) {
  return (
    <div className={styles.trendingScroller}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={styles.trendChip}
          onClick={() => onSelect(item)}
        >
          <LocationThumbnail item={item} />
          <span className={styles.trendChipLabel}>{searchItemLabel(item)}</span>
        </button>
      ))}
    </div>
  );
}

function ResultRow({
  item,
  active,
  onSelect,
  onHighlight,
}: {
  item: SearchItem;
  active?: boolean;
  onSelect: () => void;
  onHighlight?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`${styles.resultButton} ${active ? styles.resultActive : ''}`}
        role="option"
        aria-selected={active}
        onMouseEnter={onHighlight}
        onClick={onSelect}
      >
        <LocationThumbnail item={item} />
        <span className={styles.resultText}>
          <span className={styles.resultName}>{searchItemLabel(item)}</span>
        </span>
      </button>
    </li>
  );
}

export function LocationSearchSpotlight({
  appLocations,
  worldLocations,
  environmentId,
  regionId,
  onChange,
  onOpenChange,
  blocked = false,
  recessed = false,
  resetToken = 0,
  idleLabel,
  expandDirection = 'up',
  theme,
  onEmptyEnter,
  backdrop = true,
  enlarged = false,
  recenterOnExpand = false,
  pageMotion = 'none',
}: Props) {
  // While the page carries the pill, freeze the resting anchor: the CSS page
  // animation supplies all the motion, so any re-measure would fight it.
  const trackingActive = pageMotion !== 'none';
  const trackingActiveRef = useRef(trackingActive);
  trackingActiveRef.current = trackingActive;
  const risingHome = pageMotion === 'rise-home';
  const { config: animationConfig } = useSearchSpotlightAnimation();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const phaseTimerRef = useRef<number | null>(null);
  const phaseRunIdRef = useRef(0);
  const [phase, setPhase] = useState<SpotlightPhase>('closed');
  // Mirror the live phase into a ref so the (otherwise identity-stable) anchor
  // measurement callbacks can read it without being torn down on every phase
  // change. The anchor must only ever be committed while the bar is at rest
  // (see `syncPanelAnchor`).
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [panelAnchor, setPanelAnchor] = useState<PanelAnchor | null>(null);
  const panelAnchorRef = useRef<PanelAnchor | null>(panelAnchor);
  panelAnchorRef.current = panelAnchor;
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodePhase, setGeocodePhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  // The query the current geocode state (results/phase) actually reflects, so we
  // never flash "nothing matched" for a query whose lookup has not settled yet.
  const [geocodeQuery, setGeocodeQuery] = useState('');
  // While set, the panel shows the brief "generating your soundscape" moment for
  // a searched (non-curated) place before the generated scene is applied.
  const [generating, setGenerating] = useState<{ label: string } | null>(null);
  // Bumped whenever the panel resets/closes so an in-flight generate (its hold
  // beat or a pending geocode fetch) that resolves afterwards can detect it lost
  // the race and not apply a stale place.
  const generateRunIdRef = useRef(0);
  // Bumped each time the panel opens so Trending draws a fresh random set.
  const [trendingToken, setTrendingToken] = useState(0);

  // Landing-only entrance latch: the enlarged (landing) pill fades and rises in
  // exactly once, as the final beat of the hero sequence. It is disarmed the
  // moment the search is first opened (so the entrance can never fight the open
  // transform) and, as a fallback, once the entrance has finished, and is never
  // re-armed. This guarantees the rise plays only on the initial landing mount,
  // never on a later open / close / hover / focus. It is also suppressed when
  // the pill mounts as part of a gate home-rise (`rise-home`): there the
  // whole pill travels up with the sheet, so a second, separate hero fade-up
  // would double the motion.
  const [landingEntranceArmed, setLandingEntranceArmed] = useState(enlarged && !risingHome);
  // Keep the portal unmounted until it can rise with Enter. Inside LandingGate
  // the in-flow spacer is mounted during preload for layout, but the visible
  // pill must wait for data-hero-ready so it pairs with Enter after settle.
  const [landingPortalAllowed, setLandingPortalAllowed] = useState(
    () => !enlarged || risingHome,
  );
  const [pairEntranceImmediate, setPairEntranceImmediate] = useState(false);

  useLayoutEffect(() => {
    if (!enlarged || risingHome || !landingEntranceArmed) {
      setLandingPortalAllowed(true);
      setPairEntranceImmediate(false);
      return;
    }
    const gate = rootRef.current?.closest('[data-landing-gate]');
    if (gate) {
      const syncFromGate = () => {
        if (gate.getAttribute('data-hero-ready') === 'true') {
          setPairEntranceImmediate(true);
          setLandingPortalAllowed(true);
          return true;
        }
        setPairEntranceImmediate(false);
        setLandingPortalAllowed(false);
        return false;
      };
      if (syncFromGate()) return undefined;
      const observer = new MutationObserver(() => {
        if (syncFromGate()) observer.disconnect();
      });
      observer.observe(gate, { attributes: true, attributeFilter: ['data-hero-ready'] });
      return () => observer.disconnect();
    }
    // Non-gate landing mount: wait the shared Enter delay.
    setPairEntranceImmediate(false);
    setLandingPortalAllowed(false);
    const raw =
      getComputedStyle(document.documentElement).getPropertyValue('--landing-enter-delay').trim() ||
      getComputedStyle(document.documentElement).getPropertyValue('--landing-search-delay').trim();
    let delayMs = 560;
    if (raw.endsWith('ms')) delayMs = Number.parseFloat(raw) || delayMs;
    else if (raw.endsWith('s')) delayMs = (Number.parseFloat(raw) || 0.56) * 1000;
    const timer = window.setTimeout(() => setLandingPortalAllowed(true), Math.max(0, delayMs));
    return () => window.clearTimeout(timer);
  }, [enlarged, landingEntranceArmed, risingHome]);

  useEffect(() => {
    if (phase === 'opening-width') setTrendingToken((token) => token + 1);
  }, [phase]);

  useEffect(() => {
    if (!landingEntranceArmed) return;
    // Opening the search retires the entrance immediately.
    if (phase !== 'closed') {
      setLandingEntranceArmed(false);
      return;
    }
    // Otherwise retire it once the delayed fade-up has comfortably finished.
    const timer = window.setTimeout(() => setLandingEntranceArmed(false), 1600);
    return () => window.clearTimeout(timer);
  }, [landingEntranceArmed, phase]);

  const catalog = useMemo(
    () => buildSearchCatalog(appLocations, worldLocations),
    [appLocations, worldLocations],
  );

  const recommended = useMemo(() => {
    return shuffleItems(catalog).slice(0, RECOMMENDED_COUNT);
    // trendingToken reshuffles the draw each time the panel opens (and on load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, trendingToken]);

  const trending = useMemo(() => {
    const reserved = new Set(recommended.map((item) => item.key));
    const pool = catalog.filter((item) => !reserved.has(item.key));
    return shuffleItems(pool).slice(0, TRENDING_COUNT);
    // trendingToken reshuffles the draw each time the panel opens; excludes
    // whatever landed in Recommended for this view so the two never overlap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, recommended, trendingToken]);

  const currentLabel = useMemo(() => {
    const key = itemKey(environmentId, regionId);
    const match = catalog.find((item) => item.key === key);
    if (match) return searchItemLabel(match);
    const app = appLocations.find(
      (location) => location.environmentId === environmentId && location.regionId === regionId,
    );
    if (app) return app.name;
    return getRegion(environmentId, regionId)?.name ?? 'Choose location';
  }, [appLocations, catalog, environmentId, regionId]);

  const trimmedQuery = query.trim();
  const showGeocodeSection = trimmedQuery.length >= 2;

  const filteredItems = useMemo(() => {
    if (!trimmedQuery) return [];
    return catalog.filter((item) => matchesQuery(item.name, item.subtitle, trimmedQuery));
  }, [catalog, trimmedQuery]);

  const selectableItems = useMemo(() => {
    const items: Array<
      | { kind: 'local'; item: SearchItem }
      | { kind: 'geocode'; item: GeocodeResult }
    > = filteredItems.map((item) => ({ kind: 'local' as const, item }));
    if (showGeocodeSection && geocodePhase !== 'loading') {
      for (const result of geocodeResults) {
        items.push({ kind: 'geocode', item: result });
      }
    }
    return items;
  }, [filteredItems, geocodeResults, geocodePhase, showGeocodeSection]);

  const finishClose = useCallback(() => {
    // Invalidate any in-flight generate so its hold beat cannot apply a place
    // after the panel has reset (e.g. Escape, globe open, blocked).
    generateRunIdRef.current += 1;
    setPhase('closed');
    setQuery('');
    setHighlightIndex(-1);
    setGeocodeResults([]);
    setGeocodePhase('idle');
    setGeocodeError(null);
    setGenerating(null);
  }, []);

  const hardResetClosed = useCallback(() => {
    phaseRunIdRef.current += 1;
    if (phaseTimerRef.current !== null) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    finishClose();
  }, [finishClose]);

  const clearPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current !== null) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    // Only mutate phase here; the phase effect owns advance-timer scheduling
    // and cleanup, so we never strand a pending timer when this no-ops.
    setPhase((currentPhase) => {
      if (
        currentPhase === 'closed' ||
        currentPhase === 'closing-drop' ||
        currentPhase === 'closing-shrink'
      ) {
        return currentPhase;
      }
      return 'closing-drop';
    });
  }, []);

  const open = useCallback(() => {
    if (blocked || recessed) return;
    setPhase((currentPhase) => {
      if (
        currentPhase === 'closed' ||
        currentPhase === 'closing-drop' ||
        currentPhase === 'closing-shrink'
      ) {
        return 'opening-width';
      }
      return currentPhase;
    });
    setQuery('');
    setHighlightIndex(-1);
  }, [blocked, recessed]);

  useEffect(() => {
    if (!blocked) return;
    hardResetClosed();
  }, [blocked, hardResetClosed]);

  useEffect(() => {
    if (!recessed) return;
    hardResetClosed();
  }, [hardResetClosed, recessed]);

  useEffect(() => {
    hardResetClosed();
  }, [hardResetClosed, resetToken]);

  useEffect(() => {
    clearPhaseTimer();
    const runId = phaseRunIdRef.current;
    const schedule = (callback: () => void, delayMs: number) => {
      phaseTimerRef.current = window.setTimeout(() => {
        if (phaseRunIdRef.current !== runId) return;
        callback();
      }, delayMs);
    };

    if (phase === 'opening-width') {
      schedule(() => setPhase('opening-rise'), computeRiseStartDelayMs(animationConfig));
    } else if (phase === 'opening-rise') {
      schedule(() => setPhase('open'), computeRisePhaseDurationMs(animationConfig));
    } else if (phase === 'closing-drop') {
      schedule(() => setPhase('closing-shrink'), computeCloseWidthStartDelayMs(animationConfig));
    } else if (phase === 'closing-shrink') {
      schedule(finishClose, computeCloseShrinkPhaseDurationMs(animationConfig));
    }
    return clearPhaseTimer;
  }, [animationConfig, clearPhaseTimer, finishClose, phase]);

  // Single source of truth: the parent's "search open" flag (which drives the
  // bottom bar's `.bottomBarSearchOpen` rule, hiding the Play-audio pill) must
  // always mirror the actual visible phase. Reporting it from a layout effect
  // keyed on `phase` keeps App in sync across globe open/close transitions, so
  // the expanded pill can never desync from App and ghost the Play pill.
  useLayoutEffect(() => {
    // Report the bar's "search open" flag from whether the pill still occupies
    // its full expanded WIDTH (opening through closing-drop), not merely whether
    // the phase is non-closed. This lets the bottom-bar side controls (use-my-
    // location, shuffle, world map, share, Regenerate and the Play pill) begin
    // returning the moment the pill starts its final width-collapse
    // (`closing-shrink`) instead of waiting for the whole close to finish, so
    // they fill back in as the pill shrinks rather than after an awkward gap. By
    // `closing-shrink` the panel has already collapsed to bar height, so the
    // returning controls cannot overlap a still-expanded panel.
    const occupiesExpandedWidth =
      phase === 'opening-width' ||
      phase === 'opening-rise' ||
      phase === 'open' ||
      phase === 'closing-drop';
    onOpenChange?.(occupiesExpandedWidth);
  }, [onOpenChange, phase]);

  const isPresent = phase !== 'closed';
  const isClosed = phase === 'closed';
  const isClosing = phase === 'closing-drop' || phase === 'closing-shrink';
  const isOpen = phase === 'opening-width' || phase === 'opening-rise' || phase === 'open';
  const isWidthExpanded =
    phase === 'opening-width' ||
    phase === 'opening-rise' ||
    phase === 'open' ||
    phase === 'closing-drop';
  const panelPhaseClass =
    phase === 'opening-width'
      ? styles.phaseOpeningWidth
      : phase === 'opening-rise'
        ? styles.phaseOpeningRise
        : phase === 'open'
          ? styles.phaseOpen
          : phase === 'closing-drop'
            ? styles.phaseClosingDrop
            : phase === 'closing-shrink'
              ? styles.phaseClosingShrink
              : '';

  // Measure the collapsed pill's RESTING baseline, immune to the bottom bar's
  // rise transform. The pill lives inside the bottom bar (`nav`), which lifts by
  // `--bottom-bar-rise` (a translateY transform) whenever the search is open and
  // eases back to rest over ~220ms on close. `getBoundingClientRect` reflects
  // that live transform, so a measurement taken at any point before the un-rise
  // finishes would capture a raised baseline. If such a value were committed to
  // the fixed portal anchor it would leave the collapsed pill sitting ~2px too
  // high until a later re-measure snapped it back down. The residual vertical
  // jump at the end of the close. Subtracting the bar's current translateY makes
  // the anchor the resting baseline no matter when (or by which listener) it is
  // measured, so no measurement can ever introduce a vertical jump.
  // Measure the pill's anchor. `subtractGate` strips the landing gate's live
  // rise transform so the anchor describes the RESTING row; passing false keeps
  // the gate's live translateY in the measurement so the portalled pill can
  // TRACK the gate as it rises home (see the page-motion animations below).
  const measureAnchor = useCallback((subtractGate: boolean): PanelAnchor | null => {
    const node = rootRef.current;
    const rect = node?.getBoundingClientRect();
    if (!node || !rect) return null;
    // Strip the live vertical transform of any moving ancestor so the committed
    // anchor is always the RESTING baseline. Two ancestors can lift this row:
    //   1. the bottom bar (`nav`), which rises by `--bottom-bar-rise` while the
    //      search is open; and
    //   2. the landing gate, which RISES from below the viewport (a JS-driven
    //      translateY) when it returns home over the lifting globe. Without this,
    //      the anchor is measured mid-rise and the portalled pill commits to an
    //      offset position, so it settles misaligned with the in-row Enter button
    //      (which lives inside the rising gate and lands at rest).
    let compensateY = 0;
    const bar = node.closest('nav');
    if (bar) compensateY += readTranslateY(bar);
    if (subtractGate) {
      const gate = node.closest('[data-landing-gate]');
      if (gate) compensateY += readTranslateY(gate);
    }
    return {
      // Remove the ancestor lift(s) so the anchor always describes the resting
      // row, never a raised one (the fixed portal does not inherit transforms).
      top: rect.top - compensateY,
      height: rect.height,
      // Anchor the fixed portal on the collapsed pill's measured centre rather
      // than a hardcoded viewport 50%. With a centred cluster the two coincide,
      // but measuring eagerly (see the layout effect below) makes the expanded
      // portal land on the exact same x as the collapsed pill from the very
      // first open, so there is no horizontal jump on that first expansion. The
      // bar rise is purely vertical, so the centre is unaffected by it.
      centerX: rect.left + rect.width / 2,
    };
  }, []);

  // The resting baseline (gate lift removed): used everywhere the anchor must be
  // committed at rest.
  const measureRestingAnchor = useCallback(
    (): PanelAnchor | null => measureAnchor(true),
    [measureAnchor],
  );

  const syncPanelAnchor = useCallback(() => {
    // Only ever commit the anchor while the search is at its resting (closed)
    // state. Combined with the bar-rise compensation in `measureRestingAnchor`,
    // the committed anchor is always the resting baseline, so neither the open
    // nor the close transition can shift the collapsed/expanded pill off the
    // row the round buttons sit on.
    if (phaseRef.current !== 'closed') return;
    // While a page animation carries the pill, keep the anchor we already
    // committed — re-measuring mid-flight would fight the animation. A pill
    // that mounts INTO a transition still needs its first measurement though,
    // otherwise the portal never appears (it has no anchor to render at).
    if (trackingActiveRef.current && panelAnchorRef.current) return;
    const anchor = measureRestingAnchor();
    if (anchor) setPanelAnchor(anchor);
  }, [measureRestingAnchor]);

  useLayoutEffect(() => {
    syncPanelAnchor();
    const frame = window.requestAnimationFrame(syncPanelAnchor);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && rootRef.current
        ? new ResizeObserver(syncPanelAnchor)
        : null;
    if (resizeObserver && rootRef.current) {
      resizeObserver.observe(rootRef.current);
    }
    window.addEventListener('resize', syncPanelAnchor);
    window.addEventListener('scroll', syncPanelAnchor, true);
    // The bar rises/drops via a CSS transform transition when the search opens
    // and closes; transform changes never fire resize/scroll/ResizeObserver, so
    // re-measure once the transition settles to land the anchor on the restored
    // resting baseline.
    window.addEventListener('transitionend', syncPanelAnchor, true);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncPanelAnchor);
      window.removeEventListener('scroll', syncPanelAnchor, true);
      window.removeEventListener('transitionend', syncPanelAnchor, true);
    };
  }, [syncPanelAnchor]);

  // Deterministic re-centre at the very start of every open, including when an
  // open INTERRUPTS an in-flight close (closing-drop/closing-shrink -> opening-
  // width). `syncPanelAnchor` only commits while `closed`, so the anchor used by
  // the expanding portal is normally the last resting measurement. That value is
  // correct in the common path, but committing a fresh, transform-compensated
  // resting measurement as the pill begins to expand makes the open robust to
  // any stale anchor (e.g. a viewport change that occurred while the pill was
  // open, which `syncPanelAnchor` skips, or an interrupted close): every
  // expansion grows from the resting row's true centre, never from a transient
  // mid-animation rect. `measureRestingAnchor` removes the bar's live translateY,
  // so even though the bar is re-rising during opening-width the committed anchor
  // is the resting baseline, so there is no drift on the reopen.
  useLayoutEffect(() => {
    if (phase !== 'opening-width') return;
    const anchor = measureRestingAnchor();
    if (anchor) setPanelAnchor(anchor);
  }, [measureRestingAnchor, phase]);

  useEffect(() => {
    if (blocked) {
      // Clear the stale anchor while the globe is up so we never reposition the
      // portal against a measurement taken during the sheet-stacking transform.
      setPanelAnchor(null);
      return;
    }

    // While a rise-tracking loop owns the anchor (gate home-rise, or the bottom
    // bar rising on a scene reveal), skip this resting-settle loop so the two do
    // not fight over `panelAnchor` each frame.
    if (trackingActive) return;

    // When the globe sheet closes (blocked -> false) the SheetStack outlet is
    // still animating its stacking transform (scale ~0.92 -> 1 about a top
    // origin, which lifts the bottom bar dozens of px) back to identity.
    // Transform changes never fire resize/scroll/ResizeObserver, so a single
    // measurement here captures the mid-animation (raised) position and leaves
    // the fixed portal pill stuck too high. Re-measure every frame across the
    // settle window until the measured top holds steady, so the anchor lands on
    // the restored bottom-row baseline no matter how many times the map is
    // opened and closed.
    //
    // This loop is intentionally keyed on `blocked`/`resetToken` only and NOT on
    // `phase`. When the search itself closes, the bottom bar is still mid
    // un-rise (a `--bottom-bar-rise` transform settling from -3.2px back to 0
    // over ~220ms). Running this loop on the close would measure the in-flow
    // root at that raised position; worse, the un-rise eases out at <0.5px per
    // frame near its start, so the stability heuristic below trips early and
    // freezes the anchor at the raised baseline. The bar-transform `transitionend`
    // (handled by `syncPanelAnchor`) would then snap the portal back down to the
    // resting baseline, producing the residual ~2px vertical drop at the end of
    // the close. The anchor measured while at rest before the search opened is
    // already correct for the closed pill, so we simply leave it untouched across
    // open/close and let `syncPanelAnchor` confirm it on the un-rise transitionend.
    let frame = 0;
    let cancelled = false;
    const start =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const SETTLE_MAX_MS = 700;
    let lastTop: number | null = null;
    let stableFrames = 0;

    const measure = () => {
      if (cancelled) return;
      // Same resting-baseline guard as `syncPanelAnchor`: never store a position
      // measured while the bar is lifted for the open search.
      if (phaseRef.current !== 'closed') return;
      const anchor = measureRestingAnchor();
      if (anchor) {
        setPanelAnchor(anchor);
        if (lastTop !== null && Math.abs(anchor.top - lastTop) < 0.5) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }
        lastTop = anchor.top;
      }
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (stableFrames < 3 && now - start < SETTLE_MAX_MS) {
        frame = window.requestAnimationFrame(measure);
      }
    };

    measure();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [blocked, measureRestingAnchor, resetToken, trackingActive]);

  // `exit-lift` mirrors the host's `translate(-18vh) scale(0.96)`. That scale is
  // about the HOST's own box — the full-viewport landing gate, or the short
  // bottom bar — so resolve the host's transform at the pill's centre and hand
  // the resulting deltas to the keyframes. Scaling about the pill's own box
  // instead would leave it drifting ~14px away from the row it belongs to.
  // Cached per motion so a mid-flight re-render never re-measures a moving host.
  const exitOriginRef = useRef<{ x: number; y: number } | null>(null);
  const pageMotionVars = useMemo<CSSProperties | undefined>(() => {
    if (pageMotion !== 'exit-lift' || !panelAnchor || typeof window === 'undefined') {
      exitOriginRef.current = null;
      return undefined;
    }
    if (!exitOriginRef.current) {
      const node = rootRef.current;
      const host = node?.closest('[data-landing-gate]') ?? node?.closest('nav');
      const rect = host?.getBoundingClientRect();
      exitOriginRef.current = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const origin = exitOriginRef.current;
    const scale = PAGE_EXIT_SCALE;
    const lift = -PAGE_EXIT_LIFT_VH * window.innerHeight;
    const dx = (scale - 1) * (panelAnchor.centerX - origin.x);
    const dy = (scale - 1) * (panelAnchor.top + panelAnchor.height / 2 - origin.y) + lift;
    return {
      '--page-motion-dx': `${dx.toFixed(2)}px`,
      '--page-motion-dy': `${dy.toFixed(2)}px`,
      '--page-motion-scale': scale.toString(),
    } as CSSProperties;
  }, [pageMotion, panelAnchor]);

  const selectLocal = useCallback(
    (item: SearchItem) => {
      onChange(item.environmentId, item.regionId);
      close();
    },
    [close, onChange],
  );

  // Assemble a bespoke procedural soundscape from a geocoded place, carrying the
  // real coordinates through so the app drops a custom globe pin at the searched
  // place (matching the "Use my location" flow) rather than snapping to one of a
  // few curated templates.
  const buildGeneratedSelection = useCallback((result: GeocodeResult) => {
    const soundscape = resolveProceduralSoundscape({
      name: formatWorldLocationLabel({
        name: result.shortName,
        subtitle: result.subtitle || '',
      }),
      lat: result.lat,
      lng: result.lng,
      placeId: result.placeId,
      geocode: {
        type: result.type,
        class: result.class,
        addresstype: result.addresstype,
        displayName: result.displayName,
        countryCode: result.countryCode,
      },
    });
    const customLocation = createCustomWorldLocation({
      lat: result.lat,
      lng: result.lng,
      name: result.shortName,
      subtitle: result.subtitle || result.displayName,
      environmentId: soundscape.environmentId,
      regionId: soundscape.regionId,
      placeId: result.placeId,
    });
    return { soundscape, customLocation };
  }, []);

  // Hold the "generating" moment for a short beat, then hand the generated scene
  // to the caller. `onChange` is the same entry the curated pins and globe use,
  // so the transport rules (landing entry starts audio; a mid-session switch
  // respects the paused/playing transport) are honoured automatically.
  const holdAndApplyGenerated = useCallback(
    async (result: GeocodeResult, runId: number) => {
      const { soundscape, customLocation } = buildGeneratedSelection(result);
      const holdMs = prefersReducedMotion() ? GENERATE_HOLD_REDUCED_MS : GENERATE_HOLD_MS;
      await new Promise((resolve) => window.setTimeout(resolve, holdMs));
      // Bailed out (reset/blocked/Escape) while we held the beat.
      if (generateRunIdRef.current !== runId) return;
      onChange(soundscape.environmentId, soundscape.regionId, customLocation);
      close();
    },
    [buildGeneratedSelection, close, onChange],
  );

  // Selecting a specific worldwide result: we already have its coordinates, so
  // generate straight away behind the animation.
  const generateFor = useCallback(
    (result: GeocodeResult) => {
      const runId = (generateRunIdRef.current += 1);
      setGenerating({ label: geocodeResultLabel(result) });
      void holdAndApplyGenerated(result, runId);
    },
    [holdAndApplyGenerated],
  );

  // Pressing Enter on a typed query with nothing highlighted: geocode the raw
  // query (reusing any results already loaded) and generate for the best match,
  // so searching a real place always lands on a soundscape.
  const generateFromQuery = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      if (query.length < 2) return;
      const runId = (generateRunIdRef.current += 1);
      setGenerating({ label: query });

      let result: GeocodeResult | undefined = geocodeResults[0];
      if (!result) {
        try {
          const results = await fetchGeocodeResults(query);
          if (generateRunIdRef.current !== runId) return;
          result = results[0];
        } catch {
          if (generateRunIdRef.current !== runId) return;
        }
      }

      if (!result) {
        // Genuinely unresolvable query: drop the animation and leave a gentle
        // note rather than a dead end.
        setGenerating(null);
        setGeocodePhase('error');
        setGeocodeError(`Nothing matched \u201c${query}\u201d. Try another place.`);
        return;
      }

      setGenerating({ label: geocodeResultLabel(result) });
      await holdAndApplyGenerated(result, runId);
    },
    [geocodeResults, holdAndApplyGenerated],
  );

  const selectHighlighted = useCallback(() => {
    if (highlightIndex < 0 || highlightIndex >= selectableItems.length) return;
    const entry = selectableItems[highlightIndex];
    if (entry.kind === 'local') {
      selectLocal(entry.item);
    } else {
      generateFor(entry.item);
    }
  }, [generateFor, highlightIndex, selectLocal, selectableItems]);

  useEffect(() => {
    if (phase !== 'open') return;
    const timer = window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(0, 0);
    }, SEARCH_FOCUS_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightIndex((index) => {
          if (selectableItems.length === 0) return -1;
          return index >= selectableItems.length - 1 ? 0 : index + 1;
        });
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIndex((index) => {
          if (selectableItems.length === 0) return -1;
          return index <= 0 ? selectableItems.length - 1 : index - 1;
        });
        return;
      }

      if (event.key === 'Enter') {
        if (generating) {
          event.preventDefault();
          return;
        }
        if (highlightIndex >= 0) {
          event.preventDefault();
          selectHighlighted();
          return;
        }
        // A typed place with nothing highlighted: generate on the fly so any
        // real place always lands on a soundscape.
        if (trimmedQuery.length >= 2) {
          event.preventDefault();
          void generateFromQuery(trimmedQuery);
          return;
        }
        // Empty query with nothing highlighted: hand off to the caller (the
        // landing opens the full-page globe / world map).
        if (onEmptyEnter && trimmedQuery.length === 0) {
          event.preventDefault();
          onEmptyEnter();
          close();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    close,
    generateFromQuery,
    generating,
    highlightIndex,
    isOpen,
    onEmptyEnter,
    selectHighlighted,
    selectableItems.length,
    trimmedQuery,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [close, isOpen]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [trimmedQuery, geocodeResults.length]);

  useEffect(() => {
    if (!showGeocodeSection) {
      setGeocodeResults([]);
      setGeocodePhase('idle');
      setGeocodeError(null);
      setGeocodeQuery('');
      return;
    }

    const controller = new AbortController();
    setGeocodePhase('loading');
    setGeocodeError(null);

    const timer = window.setTimeout(() => {
      void fetchGeocodeResults(trimmedQuery, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return;
          setGeocodeResults(results);
          setGeocodePhase('idle');
          setGeocodeQuery(trimmedQuery);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setGeocodeResults([]);
          setGeocodePhase('error');
          setGeocodeError(error instanceof Error ? error.message : 'Search failed');
          setGeocodeQuery(trimmedQuery);
        });
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [showGeocodeSection, trimmedQuery]);

  const isActive = (index: number) => highlightIndex === index;
  // A lookup has "settled" only once results (or an error) exist for the current
  // query; until then we show the searching state rather than a stale empty note.
  const geocodeSettled = geocodeQuery === trimmedQuery && geocodePhase !== 'loading';
  const geocodeSearching = showGeocodeSection && !geocodeSettled && geocodePhase !== 'error';
  const showGeocodeEmpty =
    geocodeSettled &&
    geocodePhase === 'idle' &&
    geocodeResults.length === 0 &&
    filteredItems.length === 0;
  const showGeocodeSectionNow =
    showGeocodeSection &&
    (geocodeSearching || geocodeResults.length > 0 || geocodePhase === 'error' || showGeocodeEmpty);
  const showBackdrop = isPresent && !blocked;
  const showPromptText = isOpen && !isClosing && trimmedQuery.length === 0;
  const showCurrentLabelText = !isOpen || isClosing;
  const showSearchInput = phase === 'open';

  // Landing recentre: how far the expanded panel must shift so it is centred on
  // the viewport (which is where the landing column is centred) rather than on
  // the collapsed pill, which sits left of centre beside the Enter button. Zero
  // unless opted in, and consumed only in the expanded state via CSS, so the
  // resting pill is never moved.
  const recenterX =
    recenterOnExpand && panelAnchor && typeof window !== 'undefined'
      ? window.innerWidth / 2 - panelAnchor.centerX
      : 0;

  let resultIndex = 0;

  return (
    <div className={styles.root} ref={rootRef} data-size={enlarged ? 'lg' : undefined}>
      {panelAnchor &&
        !blocked &&
        landingPortalAllowed &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`${styles.panelAnchor} ${isWidthExpanded ? styles.panelAnchorExpanded : ''}`}
            data-search-phase={phase}
            data-expand={expandDirection}
            data-size={enlarged ? 'lg' : undefined}
            data-landing-entrance={landingEntranceArmed ? 'in' : undefined}
            data-entrance-deferred={enlarged && landingEntranceArmed ? 'true' : undefined}
            data-pair-immediate={pairEntranceImmediate ? 'true' : undefined}
            data-rising={risingHome ? 'true' : undefined}
            data-page-motion={pageMotion !== 'none' ? pageMotion : undefined}
            data-recessed={recessed ? 'true' : undefined}
            data-theme={theme}
            style={
              {
                top: `${panelAnchor.top}px`,
                left: `${panelAnchor.centerX}px`,
                height: `${panelAnchor.height}px`,
                '--recenter-x': `${recenterX}px`,
                ...pageMotionVars,
              } as CSSProperties
            }
          >
            <div
              ref={panelRef}
              id={listboxId}
              className={`${styles.panel} ${panelPhaseClass} ${isClosed ? styles.panelClosedTrigger : ''}`}
              data-search-phase={phase}
              data-tooltip={isClosed ? 'Search places' : undefined}
              role={isClosed ? 'button' : 'dialog'}
              aria-label="Search locations"
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              aria-controls={isOpen ? `${listboxId}-results` : undefined}
              tabIndex={isClosed ? 0 : -1}
              onClick={isClosed ? open : undefined}
              onKeyDown={
                isClosed
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        open();
                      }
                    }
                  : undefined
              }
            >
              <div className={`${styles.searchRow} ${styles.searchCascadeInput}`}>
                <div
                  className={`${styles.searchPair} ${showPromptText ? styles.searchPairVisible : ''}`}
                  aria-hidden={!showPromptText}
                >
                  <UiIcon icon="magnifying-glass" size="sm" className={styles.searchIcon} />
                  <span className={styles.searchTextPrompt}>Search cities and places...</span>
                </div>
                <div
                  className={`${styles.searchPair} ${styles.searchPairClosed} ${showCurrentLabelText && trimmedQuery.length === 0 ? styles.searchPairVisible : ''}`}
                  aria-hidden={!(showCurrentLabelText && trimmedQuery.length === 0)}
                >
                  <UiIcon icon="magnifying-glass" size="sm" className={styles.searchIcon} />
                  <span className={styles.searchTextLabel}>{idleLabel ?? currentLabel}</span>
                </div>
                <div className={styles.searchInputShell}>
                  {showSearchInput && (
                    <input
                      ref={inputRef}
                      type="search"
                      className={styles.input}
                      placeholder=""
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      aria-label="Search locations"
                      aria-autocomplete="list"
                      aria-controls={`${listboxId}-results`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                </div>
              </div>

              <div id={`${listboxId}-results`} className={styles.results} role="listbox">
                <div className={styles.resultsBody}>
                  {!trimmedQuery && (
                    <>
                      <section className={`${styles.section} ${styles.searchCascadeTrending}`}>
                        <p className={styles.sectionTitle}>Trending</p>
                        <TrendingRow items={trending} onSelect={selectLocal} />
                      </section>

                      {recommended.length > 0 && (
                        <section className={`${styles.section} ${styles.searchCascadeRecommended}`}>
                          <p className={styles.sectionTitle}>Recommended</p>
                          <ul className={styles.resultList}>
                            {recommended.map((item) => (
                              <ResultRow
                                key={item.key}
                                item={item}
                                onSelect={() => selectLocal(item)}
                              />
                            ))}
                          </ul>
                        </section>
                      )}
                    </>
                  )}

                  {trimmedQuery && (
                    <>
                      {filteredItems.length > 0 && (
                        <section className={styles.section}>
                          <p className={styles.sectionTitle}>Soundscapes</p>
                          <ul className={styles.resultList}>
                            {filteredItems.map((item) => {
                              const index = resultIndex++;
                              return (
                                <ResultRow
                                  key={item.key}
                                  item={item}
                                  active={isActive(index)}
                                  onSelect={() => selectLocal(item)}
                                  onHighlight={() => setHighlightIndex(index)}
                                />
                              );
                            })}
                          </ul>
                        </section>
                      )}

                      {showGeocodeSectionNow && (
                          <section className={styles.section}>
                            <p className={styles.sectionTitle}>
                              {filteredItems.length > 0 ? 'More places' : 'Places'}
                            </p>
                            {geocodeSearching && geocodeResults.length === 0 && (
                              <p className={styles.empty} role="status">
                                Searching for &ldquo;{trimmedQuery}&rdquo;…
                              </p>
                            )}
                            {geocodePhase === 'error' && geocodeError && (
                              <p className={styles.empty}>{geocodeError}</p>
                            )}
                            {showGeocodeEmpty && (
                                <p className={styles.empty}>
                                  Nothing matched &ldquo;{trimmedQuery}&rdquo;. Try another place.
                                </p>
                              )}
                            {geocodeResults.length > 0 && (
                              <ul className={styles.resultList}>
                                {geocodeResults.map((result) => {
                                  const index = resultIndex++;
                                  return (
                                    <li key={result.placeId}>
                                      <button
                                        type="button"
                                        className={`${styles.resultButton} ${isActive(index) ? styles.resultActive : ''}`}
                                        role="option"
                                        aria-selected={isActive(index)}
                                        onMouseEnter={() => setHighlightIndex(index)}
                                        onClick={() => generateFor(result)}
                                      >
                                        <ThumbPlaceholder className={styles.geocodeThumb} />
                                        <span className={styles.resultText}>
                                          <span className={styles.resultName}>{geocodeResultLabel(result)}</span>
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </section>
                        )}
                    </>
                  )}
                </div>
              </div>

              {generating && (
                <div className={styles.generating} role="status" aria-live="polite">
                  <span className={styles.generatingOrb} aria-hidden>
                    <span className={styles.generatingRing} />
                    <span className={styles.generatingRing} />
                    <span className={styles.generatingRing} />
                    <span className={styles.generatingCore} />
                  </span>
                  <span className={styles.generatingText}>Generating your soundscape</span>
                  {generating.label && (
                    <span className={styles.generatingPlace}>{generating.label}</span>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {backdrop &&
        isPresent &&
        !blocked &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`${styles.backdrop} ${showBackdrop && !isClosing ? styles.backdropOpen : ''} ${isClosing ? styles.backdropClosing : ''}`}
            data-theme={theme}
            aria-hidden
          />,
          document.body,
        )}
    </div>
  );
}
