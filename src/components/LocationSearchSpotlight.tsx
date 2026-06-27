import { UiIcon } from './UiIcon';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AppLocation } from '../data/environments';
import { getRegion } from '../data/environments';
import { getLocationArtForItem } from '../data/locationArt';
import { resolveProceduralSoundscape } from '../utils/proceduralSoundscape';
import type { WorldLocation } from '../data/worldLocations';
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
  onChange: (environmentId: string, regionId: string) => void;
  onOpenChange?: (open: boolean) => void;
  blocked?: boolean;
  resetToken?: number;
};

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

// Recommended is a fixed, always-on pair.
const RECOMMENDED_KEYS = ['world:auckland', 'world:rio-de-janeiro'] as const;

// Trending is a fresh random draw from the full curated catalog each time the
// panel opens (excluding whatever is already pinned to Recommended).
const TRENDING_COUNT = 6;

function shuffleItems(items: SearchItem[]): SearchItem[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseCatalogKey(catalogKey: string): { kind: 'app' | 'world'; id: string } {
  if (catalogKey.startsWith('app:')) {
    return { kind: 'app', id: catalogKey.slice('app:'.length) };
  }
  if (catalogKey.startsWith('world:')) {
    return { kind: 'world', id: catalogKey.slice('world:'.length) };
  }
  return { kind: 'world', id: catalogKey };
}

function itemKey(environmentId: string, regionId: string) {
  return `${environmentId}:${regionId}`;
}

function dedupeSearchItems(items: SearchItem[]): SearchItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
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

function resolveCatalogKeys(
  keys: readonly string[],
  appLocations: readonly AppLocation[],
  worldLocations: readonly WorldLocation[],
): SearchItem[] {
  const catalog = buildSearchCatalog(appLocations, worldLocations);
  const byKey = new Map(catalog.map((item) => [item.key, item]));

  return dedupeSearchItems(
    keys.flatMap((catalogKey) => {
      const parsed = parseCatalogKey(catalogKey);
      if (parsed.kind === 'app') {
        const app = appLocations.find((location) => location.id === parsed.id);
        if (!app) return [];
        const key = itemKey(app.environmentId, app.regionId);
        return byKey.get(key) ? [byKey.get(key)!] : [];
      }
      const world = worldLocations.find((location) => location.id === parsed.id);
      if (!world) return [];
      const key = itemKey(world.environmentId, world.regionId);
      return byKey.get(key) ? [byKey.get(key)!] : [];
    }),
  );
}

function LocationThumbnail({ item }: { item: SearchItem }) {
  const art = getLocationArtForItem(item);
  const [failed, setFailed] = useState(false);

  if (!art || failed) {
    return <span className={styles.thumbFallback} aria-hidden />;
  }

  return (
    <span className={styles.thumbWrap}>
      <img
        src={art.src}
        alt=""
        className={styles.thumb}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
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
          <span className={styles.trendChipLabel}>{item.name.split(',')[0]}</span>
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
          <span className={styles.resultName}>{item.name}</span>
          {item.subtitle && <span className={styles.resultMeta}>{item.subtitle}</span>}
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
  resetToken = 0,
}: Props) {
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
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodePhase, setGeocodePhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  // Bumped each time the panel opens so Trending draws a fresh random set.
  const [trendingToken, setTrendingToken] = useState(0);

  useEffect(() => {
    if (phase === 'opening-width') setTrendingToken((token) => token + 1);
  }, [phase]);

  const catalog = useMemo(
    () => buildSearchCatalog(appLocations, worldLocations),
    [appLocations, worldLocations],
  );

  const recommended = useMemo(
    () =>
      dedupeSearchItems(resolveCatalogKeys(RECOMMENDED_KEYS, appLocations, worldLocations)),
    [appLocations, worldLocations],
  );

  const trending = useMemo(() => {
    const reserved = new Set(recommended.map((item) => item.key));
    const pool = catalog.filter((item) => !reserved.has(item.key));
    return shuffleItems(pool).slice(0, TRENDING_COUNT);
    // trendingToken reshuffles the draw each time the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, recommended, trendingToken]);

  const currentLabel = useMemo(() => {
    const key = itemKey(environmentId, regionId);
    const match = catalog.find((item) => item.key === key);
    if (match) return match.name;
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
    setPhase('closed');
    setQuery('');
    setHighlightIndex(-1);
    setGeocodeResults([]);
    setGeocodePhase('idle');
    setGeocodeError(null);
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
    if (blocked) return;
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
  }, [blocked]);

  useEffect(() => {
    if (!blocked) return;
    hardResetClosed();
  }, [blocked, hardResetClosed]);

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
  // high until a later re-measure snapped it back down — the residual vertical
  // jump at the end of the close. Subtracting the bar's current translateY makes
  // the anchor the resting baseline no matter when (or by which listener) it is
  // measured, so no measurement can ever introduce a vertical jump.
  const measureRestingAnchor = useCallback((): PanelAnchor | null => {
    const node = rootRef.current;
    const rect = node?.getBoundingClientRect();
    if (!node || !rect) return null;
    let barTranslateY = 0;
    const bar = node.closest('nav');
    if (bar) {
      const transform = window.getComputedStyle(bar).transform;
      if (transform && transform !== 'none') {
        const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
        if (matrix3d) {
          const ty = Number(matrix3d[1].split(',')[13]);
          if (Number.isFinite(ty)) barTranslateY = ty;
        } else {
          const matrix = transform.match(/matrix\(([^)]+)\)/);
          if (matrix) {
            const ty = Number(matrix[1].split(',')[5]);
            if (Number.isFinite(ty)) barTranslateY = ty;
          }
        }
      }
    }
    return {
      // Remove the bar's lift so the anchor always describes the resting row,
      // never the raised one (the fixed portal does not inherit the transform).
      top: rect.top - barTranslateY,
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

  const syncPanelAnchor = useCallback(() => {
    // Only ever commit the anchor while the search is at its resting (closed)
    // state. Combined with the bar-rise compensation in `measureRestingAnchor`,
    // the committed anchor is always the resting baseline, so neither the open
    // nor the close transition can shift the collapsed/expanded pill off the
    // row the round buttons sit on.
    if (phaseRef.current !== 'closed') return;
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
  // is the resting baseline — no horizontal or vertical drift on the reopen.
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
  }, [blocked, measureRestingAnchor, resetToken]);

  const selectLocal = useCallback(
    (item: SearchItem) => {
      onChange(item.environmentId, item.regionId);
      close();
    },
    [close, onChange],
  );

  const selectGeocode = useCallback(
    (result: GeocodeResult) => {
      // Assemble a bespoke procedural soundscape from the place metadata rather
      // than snapping to one of a few curated templates.
      const soundscape = resolveProceduralSoundscape({
        name: result.subtitle ? `${result.shortName}, ${result.subtitle}` : result.shortName,
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
      onChange(soundscape.environmentId, soundscape.regionId);
      close();
    },
    [close, onChange],
  );

  const selectHighlighted = useCallback(() => {
    if (highlightIndex < 0 || highlightIndex >= selectableItems.length) return;
    const entry = selectableItems[highlightIndex];
    if (entry.kind === 'local') {
      selectLocal(entry.item);
    } else {
      selectGeocode(entry.item);
    }
  }, [highlightIndex, selectGeocode, selectLocal, selectableItems]);

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

      if (event.key === 'Enter' && highlightIndex >= 0) {
        event.preventDefault();
        selectHighlighted();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, highlightIndex, isOpen, selectHighlighted, selectableItems.length]);

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
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setGeocodeResults([]);
          setGeocodePhase('error');
          setGeocodeError(error instanceof Error ? error.message : 'Search failed');
        });
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [showGeocodeSection, trimmedQuery]);

  const isActive = (index: number) => highlightIndex === index;
  const showBackdrop = isPresent && !blocked;
  const showPromptText = isOpen && !isClosing && trimmedQuery.length === 0;
  const showCurrentLabelText = !isOpen || isClosing;
  const showSearchInput = phase === 'open';

  let resultIndex = 0;

  return (
    <div className={styles.root} ref={rootRef}>
      {panelAnchor &&
        !blocked &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`${styles.panelAnchor} ${isWidthExpanded ? styles.panelAnchorExpanded : ''}`}
            data-search-phase={phase}
            style={{
              top: `${panelAnchor.top}px`,
              left: `${panelAnchor.centerX}px`,
              height: `${panelAnchor.height}px`,
            }}
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
                  <span className={styles.searchTextLabel}>{currentLabel}</span>
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
                      <section className={styles.section}>
                        <p className={styles.sectionTitle}>Soundscapes</p>
                        {filteredItems.length === 0 ? (
                          <p className={styles.empty}>
                            No soundscapes match &ldquo;{trimmedQuery}&rdquo;
                          </p>
                        ) : (
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
                        )}
                      </section>

                      {showGeocodeSection && (
                        <section className={styles.section}>
                          <p className={styles.sectionTitle}>Search worldwide</p>
                          {geocodePhase === 'loading' && (
                            <p className={styles.empty} role="status">
                              Looking up &ldquo;{trimmedQuery}&rdquo;…
                            </p>
                          )}
                          {geocodePhase === 'error' && geocodeError && (
                            <p className={styles.empty}>{geocodeError}</p>
                          )}
                          {geocodePhase === 'idle' && geocodeResults.length === 0 && (
                            <p className={styles.empty}>No results for &ldquo;{trimmedQuery}&rdquo;</p>
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
                                      onClick={() => selectGeocode(result)}
                                    >
                                      <span
                                        className={`${styles.thumbFallback} ${styles.geocodeThumb}`}
                                        aria-hidden
                                      />
                                      <span className={styles.resultText}>
                                        <span className={styles.resultName}>{result.shortName}</span>
                                        <span className={styles.resultMeta}>
                                          {result.subtitle || result.displayName}
                                        </span>
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
            </div>
          </div>,
          document.body,
        )}

      {isPresent &&
        !blocked &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`${styles.backdrop} ${showBackdrop && !isClosing ? styles.backdropOpen : ''} ${isClosing ? styles.backdropClosing : ''}`}
            aria-hidden
          />,
          document.body,
        )}
    </div>
  );
}
