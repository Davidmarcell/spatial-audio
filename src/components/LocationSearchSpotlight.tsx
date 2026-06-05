import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AppLocation } from '../data/environments';
import { getLocationArtForItem } from '../data/locationArt';
import { resolveSoundscapeForGeocode } from '../data/locationTemplates';
import type { WorldLocation } from '../data/worldLocations';
import {
  fetchGeocodeResults,
  GEOCODE_DEBOUNCE_MS,
  type GeocodeResult,
} from '../utils/geocode';
import styles from './LocationSearchSpotlight.module.css';

type Props = {
  appLocations: readonly AppLocation[];
  worldLocations: readonly WorldLocation[];
  environmentId: string;
  regionId: string;
  onChange: (environmentId: string, regionId: string) => void;
  onOpenChange?: (open: boolean) => void;
};

type SearchItem = {
  key: string;
  name: string;
  subtitle: string;
  environmentId: string;
  regionId: string;
};

const TRENDING_KEYS = [
  'world:auckland',
  'app:urban-europe:london',
  'world:bed-stuy',
  'world:chiang-mai',
  'world:rio-de-janeiro',
  'world:dolomites',
] as const;

const RECOMMENDED_KEYS = [
  'world:nz-forest-general',
  'world:costa-rica-pacific',
  'app:nz-forest:auckland',
  'app:alpine-europe:dolomites',
  'app:costa-rica-rainforest:pacific-slope',
  'app:brazil-coast:rio-de-janeiro',
] as const;

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

function resolveCatalogKeys(
  keys: readonly string[],
  appLocations: readonly AppLocation[],
  worldLocations: readonly WorldLocation[],
): SearchItem[] {
  const catalog = buildSearchCatalog(appLocations, worldLocations);
  const byKey = new Map(catalog.map((item) => [item.key, item]));

  return keys.flatMap((catalogKey) => {
    const [, id] = catalogKey.split(':');
    if (catalogKey.startsWith('app:')) {
      const appId = catalogKey.slice('app:'.length);
      const app = appLocations.find((location) => location.id === appId);
      if (!app) return [];
      const key = itemKey(app.environmentId, app.regionId);
      return byKey.get(key) ? [byKey.get(key)!] : [];
    }
    const world = worldLocations.find((location) => location.id === id);
    if (!world) return [];
    const key = itemKey(world.environmentId, world.regionId);
    return byKey.get(key) ? [byKey.get(key)!] : [];
  });
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.searchIcon}>
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 16 20.5 20.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function LocationThumbnail({ item }: { item: SearchItem }) {
  const art = getLocationArtForItem(item);
  if (!art) {
    return <span className={styles.thumbFallback} aria-hidden />;
  }

  return (
    <img
      src={art.src}
      alt=""
      className={styles.thumb}
      loading="lazy"
      decoding="async"
    />
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
}: Props) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPresent, setIsPresent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodePhase, setGeocodePhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const catalog = useMemo(
    () => buildSearchCatalog(appLocations, worldLocations),
    [appLocations, worldLocations],
  );

  const trending = useMemo(
    () => resolveCatalogKeys(TRENDING_KEYS, appLocations, worldLocations),
    [appLocations, worldLocations],
  );

  const recommended = useMemo(() => {
    const trendingKeys = new Set(trending.map((item) => item.key));
    return resolveCatalogKeys(RECOMMENDED_KEYS, appLocations, worldLocations).filter(
      (item) => !trendingKeys.has(item.key),
    );
  }, [appLocations, trending, worldLocations]);

  const currentLabel = useMemo(() => {
    const key = itemKey(environmentId, regionId);
    const match = catalog.find((item) => item.key === key);
    if (match) return match.name;
    const app = appLocations.find(
      (location) => location.environmentId === environmentId && location.regionId === regionId,
    );
    return app?.name ?? 'Choose location';
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
    setIsPresent(false);
    setIsClosing(false);
    setQuery('');
    setHighlightIndex(-1);
    setGeocodeResults([]);
    setGeocodePhase('idle');
    setGeocodeError(null);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
    setIsClosing(true);
  }, [onOpenChange]);

  const open = useCallback(() => {
    setIsPresent(true);
    setIsClosing(false);
    setIsAnimating(false);
    setIsOpen(true);
    onOpenChange?.(true);
    setQuery('');
    setHighlightIndex(-1);
  }, [onOpenChange]);

  useEffect(() => {
    if (!isPresent || !isOpen || isClosing) {
      setIsAnimating(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsAnimating(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isClosing, isOpen, isPresent]);

  const selectLocal = useCallback(
    (item: SearchItem) => {
      onChange(item.environmentId, item.regionId);
      close();
    },
    [close, onChange],
  );

  const selectGeocode = useCallback(
    (result: GeocodeResult) => {
      const soundscape = resolveSoundscapeForGeocode(
        { lat: result.lat, lng: result.lng },
        result,
      );
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
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

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

  let resultIndex = 0;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
        onClick={() => (isOpen ? close() : open())}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isPresent ? listboxId : undefined}
        data-tooltip="Search locations"
      >
        <span className={styles.triggerLabel}>{currentLabel}</span>
        <SearchIcon />
      </button>

      {isPresent && (
        <>
          <div
            className={`${styles.backdrop} ${isAnimating && !isClosing ? styles.backdropOpen : ''} ${isClosing ? styles.backdropClosing : ''}`}
            aria-hidden
            onClick={close}
          />
          <div
            id={listboxId}
            className={`${styles.panel} ${isAnimating && !isClosing ? styles.panelOpen : ''} ${isClosing ? styles.panelClosing : ''}`}
            role="dialog"
            aria-label="Search locations"
            onTransitionEnd={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.propertyName !== 'transform' || !isClosing) return;
              finishClose();
            }}
          >
            <div className={styles.searchRow}>
              <SearchIcon />
              <input
                ref={inputRef}
                type="search"
                className={styles.input}
                placeholder="Search cities and places…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search locations"
                aria-autocomplete="list"
                aria-controls={`${listboxId}-results`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div id={`${listboxId}-results`} className={styles.results} role="listbox">
              {!trimmedQuery && (
                <>
                  <section className={styles.section}>
                    <p className={styles.sectionTitle}>Trending</p>
                    <div className={styles.trendingScroller}>
                      {trending.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className={styles.trendChip}
                          onClick={() => selectLocal(item)}
                        >
                          <LocationThumbnail item={item} />
                          <span className={styles.trendChipLabel}>{item.name.split(',')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {recommended.length > 0 && (
                    <section className={styles.section}>
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
                      <p className={styles.empty}>No soundscapes match &ldquo;{trimmedQuery}&rdquo;</p>
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
                                  <span className={`${styles.thumbFallback} ${styles.geocodeThumb}`} aria-hidden />
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
        </>
      )}
    </div>
  );
}
