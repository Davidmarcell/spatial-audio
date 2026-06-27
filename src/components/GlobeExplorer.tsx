import { UiIcon } from './UiIcon';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import createGlobe, { type Marker } from 'cobe';
import { resolveSoundscapeForGeocode } from '../data/locationTemplates';
import { createCustomWorldLocation, type WorldLocation } from '../data/worldLocations';
import {
  fetchGeocodeResults,
  GEOCODE_DEBOUNCE_MS,
  type GeocodeResult,
} from '../utils/geocode';
import { getLocationArtForItem } from '../data/locationArt';
import styles from './GlobeExplorer.module.css';

type Props = {
  locations: WorldLocation[];
  activeEnvironmentId: string;
  activeRegionId: string;
  activeLocationId?: string;
  onSelect: (location: WorldLocation) => void;
  onClose: () => void;
  showCloseButton?: boolean;
};

// ── Globe appearance (matches the cobe "polaroids" showcase preset) ──────────
const BASE_THETA = 0.2;
const THETA_LIMIT = 0.55;
const AUTO_SPIN = 0.0018;
const LERP = 0.12;
const MARKER_SIZE = 0.015;
const MARKER_SIZE_ACTIVE = 0.024;
const FOCUS_HOLD_MS = 4000;

function isActiveLocation(
  location: WorldLocation,
  environmentId: string,
  regionId: string,
  activeLocationId?: string,
) {
  if (activeLocationId) return location.id === activeLocationId;
  return location.environmentId === environmentId && location.regionId === regionId;
}

function matchesSearch(location: WorldLocation, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    location.name.toLowerCase().includes(normalized) ||
    location.subtitle.toLowerCase().includes(normalized)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stringHash(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * cobe rotates the globe around the vertical axis with `phi`. This returns the
 * `phi` that brings a given longitude to face the camera (derived from cobe's
 * own marker projection in src/index.js).
 */
function focusPhiForLng(lng: number) {
  return -Math.PI / 2 - (lng * Math.PI) / 180;
}

/** Shift `target` to the rotation of `phi` nearest to `current` (avoids long spins). */
function nearestAngle(target: number, current: number) {
  const twoPi = Math.PI * 2;
  let delta = (target - current) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  return current + delta;
}

const PolaroidCard = memo(function PolaroidCard({
  location,
  image,
  rotate,
  active,
  onPick,
}: {
  location: WorldLocation;
  image: string | null;
  rotate: number;
  active: boolean;
  onPick: (location: WorldLocation) => void;
}) {
  // CSS Anchor Positioning: cobe exposes `--cobe-{id}` as the marker's anchor
  // and `--cobe-visible-{id}` (set to an invalid value when facing the camera,
  // undefined when hidden) so opacity/blur fall back via var() defaults.
  const style = {
    positionAnchor: `--cobe-${location.id}`,
    opacity: `var(--cobe-visible-${location.id}, 0)`,
    filter: `blur(calc((1 - var(--cobe-visible-${location.id}, 0)) * 6px))`,
    '--polaroid-rotate': `${rotate}deg`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`${styles.polaroid} ${active ? styles.polaroidActive : ''}`}
      style={style}
      onClick={() => onPick(location)}
      aria-label={`Go to ${location.name}`}
    >
      {image ? (
        <img className={styles.polaroidImage} src={image} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className={styles.polaroidFallback} aria-hidden>
          {location.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className={styles.polaroidCaption}>{location.name}</span>
    </button>
  );
});

function LocationThumb({ location }: { location: WorldLocation }) {
  const art = getLocationArtForItem(location);
  const src = art?.globeSrc ?? art?.src ?? null;
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className={styles.rowThumbFallback} aria-hidden>
        {location.name.slice(0, 1)}
      </span>
    );
  }

  return (
    <span className={styles.rowThumbWrap}>
      <img
        className={styles.rowThumb}
        src={src}
        alt=""
        width={34}
        height={34}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export function GlobeExplorer({
  locations,
  activeEnvironmentId,
  activeRegionId,
  activeLocationId,
  onSelect,
  onClose,
  showCloseButton = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const handleLocationPickRef = useRef<(location: WorldLocation) => void>(() => {});
  const activeRef = useRef({
    environmentId: activeEnvironmentId,
    regionId: activeRegionId,
    locationId: activeLocationId,
  });
  // Imperative handle into the running globe (set up inside the effect).
  const globeRef = useRef<{
    focus: (lat: number, lng: number) => void;
    setMarkers: (data: WorldLocation[]) => void;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodePhase, setGeocodePhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [previewPin, setPreviewPin] = useState<WorldLocation | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const searchHostRef = useRef<HTMLDivElement>(null);
  const spotlightOpenRef = useRef(false);

  const filteredLocations = useMemo(
    () => locations.filter((location) => matchesSearch(location, searchQuery)),
    [locations, searchQuery],
  );

  // The Places list always shows the full curated set; searching now happens in
  // the spotlight below the globe rather than filtering this column.
  // Curated (non-custom) pins get a marker + polaroid on the globe.
  const globePoints = useMemo(() => {
    const curated = locations.filter((location) => !location.custom);
    if (previewPin && !curated.some((location) => location.id === previewPin.id)) {
      return [...curated, previewPin];
    }
    return curated;
  }, [locations, previewPin]);

  const polaroids = useMemo(
    () =>
      globePoints.map((location) => {
        const art = getLocationArtForItem(location);
        return {
          location,
          image: art?.globeSrc ?? art?.src ?? null,
          rotate: (stringHash(location.id) % 13) - 6,
        };
      }),
    [globePoints],
  );

  const trimmedQuery = searchQuery.trim();
  const showGeocodeSection = trimmedQuery.length >= 2;
  const showSpotlight = spotlightOpen && trimmedQuery.length > 0;

  useEffect(() => {
    spotlightOpenRef.current = showSpotlight;
  }, [showSpotlight]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    activeRef.current = {
      environmentId: activeEnvironmentId,
      regionId: activeRegionId,
      locationId: activeLocationId,
    };
    // Re-color/scale markers when the active selection changes.
    globeRef.current?.setMarkers(globePoints);
  }, [activeEnvironmentId, activeRegionId, activeLocationId, globePoints]);

  const handleLocationPick = useCallback((location: WorldLocation) => {
    setPreviewPin(location.custom ? location : null);
    globeRef.current?.focus(location.lat, location.lng);
    onSelectRef.current(location);
  }, []);

  const handleGeocodePick = useCallback(
    (result: GeocodeResult) => {
      const soundscape = resolveSoundscapeForGeocode(
        { lat: result.lat, lng: result.lng },
        result,
      );
      const location = createCustomWorldLocation({
        lat: result.lat,
        lng: result.lng,
        name: result.shortName,
        subtitle: result.subtitle || result.displayName,
        environmentId: soundscape.environmentId,
        regionId: soundscape.regionId,
        placeId: result.placeId,
      });
      handleLocationPick(location);
    },
    [handleLocationPick],
  );

  const handleSpotlightLocation = useCallback(
    (location: WorldLocation) => {
      handleLocationPick(location);
      setSearchQuery('');
      setSpotlightOpen(false);
    },
    [handleLocationPick],
  );

  const handleSpotlightGeocode = useCallback(
    (result: GeocodeResult) => {
      handleGeocodePick(result);
      setSearchQuery('');
      setSpotlightOpen(false);
    },
    [handleGeocodePick],
  );

  useEffect(() => {
    handleLocationPickRef.current = handleLocationPick;
  }, [handleLocationPick]);

  // Close the spotlight when clicking outside the search field/results.
  useEffect(() => {
    if (!showSpotlight) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchHostRef.current?.contains(target)) return;
      setSpotlightOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [showSpotlight]);

  useEffect(() => {
    globeRef.current?.setMarkers(globePoints);
  }, [globePoints]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setGeocodeResults([]);
      setGeocodePhase('idle');
      setGeocodeError(null);
      return;
    }

    const controller = new AbortController();
    setGeocodePhase('loading');
    setGeocodeError(null);

    const timer = window.setTimeout(() => {
      void fetchGeocodeResults(query, controller.signal)
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
  }, [searchQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (spotlightOpenRef.current) {
        event.stopPropagation();
        setSpotlightOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // ── Globe lifecycle (faithful to the cobe reference) ──────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.className = styles.cobeCanvas;
    container.append(canvas);

    // Markers are read from a ref each frame so rotation never re-renders React.
    let renderedPoints = globePoints;
    const buildMarkers = (): Marker[] =>
      renderedPoints.map((location) => {
        const active = isActiveLocation(
          location,
          activeRef.current.environmentId,
          activeRef.current.regionId,
          activeRef.current.locationId,
        );
        return {
          location: [location.lat, location.lng],
          size: active ? MARKER_SIZE_ACTIVE : MARKER_SIZE,
          id: location.id,
          color: active ? [0.1, 0.12, 0.16] : undefined,
        };
      });
    let markers = buildMarkers();

    const activeAtMount = locations.find((location) =>
      isActiveLocation(location, activeEnvironmentId, activeRegionId, activeLocationId),
    );

    const rotation = {
      phi: activeAtMount ? focusPhiForLng(activeAtMount.lng) : focusPhiForLng(10),
      theta: BASE_THETA,
    };
    const target = { ...rotation };
    let focusUntil = 0;

    let width = 1;
    let height = 1;
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.8 : 2);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const side = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
      width = side;
      height = side;
      if (side > 48) setGlobeReady(true);
    };
    resize();

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width,
      height,
      phi: rotation.phi,
      theta: rotation.theta,
      dark: 0,
      diffuse: 1.2,
      mapSamples: 16_000,
      mapBrightness: 6,
      baseColor: [1, 1, 1],
      markerColor: [0.3, 0.45, 0.85],
      glowColor: [1, 1, 1],
      markerElevation: 0.01,
      opacity: 0.92,
      markers,
    });

    globeRef.current = {
      focus(lat, lng) {
        target.phi = nearestAngle(focusPhiForLng(lng), rotation.phi);
        target.theta = clamp((lat * Math.PI) / 180 * 0.45 + BASE_THETA * 0.5, -THETA_LIMIT, THETA_LIMIT);
        focusUntil = performance.now() + FOCUS_HOLD_MS;
      },
      setMarkers(data) {
        renderedPoints = data;
        markers = buildMarkers();
      },
    };

    // The viewport is a CSS square, but use the smaller dimension defensively so
    // subpixel rounding can never make the canvas non-square (which would distort
    // the globe). cobe multiplies width/height by the devicePixelRatio internally,
    // keeping the buffer crisp at the displayed CSS size.
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    // ResizeObserver covers modal/layout changes; the window listener is a belt-
    // and-braces guard so the globe always re-fits on viewport resizes.
    window.addEventListener('resize', resize);

    // ── Pointer drag (rotate the globe) ─────────────────────────────────────
    const pointer = { id: -1, x: 0, y: 0, active: false, moved: false };
    let blockClickUntil = 0;

    const onPointerDown = (event: PointerEvent) => {
      pointer.id = event.pointerId;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      pointer.moved = false;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
      focusUntil = performance.now() + FOCUS_HOLD_MS;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointer.active || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.moved && Math.hypot(dx, dy) > 3) pointer.moved = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      target.phi += dx / 300;
      target.theta = clamp(target.theta + dy / 500, -THETA_LIMIT, THETA_LIMIT);
      focusUntil = performance.now() + FOCUS_HOLD_MS;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointer.active || event.pointerId !== pointer.id) return;
      if (pointer.moved) blockClickUntil = performance.now() + 200;
      pointer.active = false;
      canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
    };

    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    // Click-to-pick the nearest visible marker (polaroids handle their own clicks).
    const onClick = (event: MouseEvent) => {
      if (performance.now() < blockClickUntil) return;
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const threshold = Math.max(16, Math.min(28, width * 0.05));
      let best: { location: WorldLocation; distance: number } | null = null;
      for (const location of renderedPoints) {
        const projected = projectMarker(location.lat, location.lng);
        if (!projected.visible) continue;
        const distance = Math.hypot(projected.x * width - px, projected.y * height - py);
        if (distance > threshold) continue;
        if (!best || distance < best.distance) best = { location, distance };
      }
      if (best) handleLocationPickRef.current(best.location);
    };

    // Mirror of cobe's internal lat/lng → screen projection for hit-testing.
    const projectMarker = (lat: number, lng: number) => {
      const latRad = (lat * Math.PI) / 180;
      const lngRad = (lng * Math.PI) / 180 - Math.PI;
      const cosLat = Math.cos(latRad);
      const v: [number, number, number] = [
        -cosLat * Math.cos(lngRad),
        Math.sin(latRad),
        cosLat * Math.sin(lngRad),
      ];
      const cr = Math.cos(rotation.theta);
      const sr = Math.sin(rotation.theta);
      const ca = Math.cos(rotation.phi);
      const sa = Math.sin(rotation.phi);
      const x = ca * v[0] + sa * v[2];
      const y = sr * sa * v[0] + cr * v[1] - sr * ca * v[2];
      const z = -sa * cr * v[0] + sr * v[1] + ca * cr * v[2];
      const aspect = width / height;
      return {
        x: (x / aspect + 1) / 2,
        y: (-y + 1) / 2,
        visible: z >= 0 && x * x + y * y < 0.64,
      };
    };

    canvas.addEventListener('click', onClick);

    let rafId = 0;
    const frame = () => {
      const now = performance.now();
      if (!pointer.active && now > focusUntil) target.phi += AUTO_SPIN;
      rotation.phi += (target.phi - rotation.phi) * LERP;
      rotation.theta += (target.theta - rotation.theta) * LERP;
      globe.update({
        width,
        height,
        phi: rotation.phi,
        theta: rotation.theta,
        markers,
      });
      rafId = window.requestAnimationFrame(frame);
    };
    frame();

    return () => {
      window.cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
      observer.disconnect();
      globe.destroy();
      container.innerHTML = '';
      globeRef.current = null;
    };
    // Globe is created once; data/active changes flow through globeRef methods.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.root} aria-labelledby="globe-explorer-title">
      <h2 id="globe-explorer-title" className={styles.srOnly}>
        Explore the world
      </h2>

      <div className={styles.body}>
        <div className={styles.globeColumn}>
          <div className={styles.globeHost}>
            <div
              ref={containerRef}
              className={`${styles.globeViewport} ${globeReady ? styles.globeViewportReady : ''}`}
            />
            {showCloseButton && (
              <div className={styles.topControls}>
                <button type="button" className={styles.close} aria-label="Close map" onClick={onClose}>
                  <UiIcon icon="xmark" size="sm" className={styles.controlIcon} />
                </button>
              </div>
            )}
            {polaroids.map((card) => (
              <PolaroidCard
                key={card.location.id}
                location={card.location}
                image={card.image}
                rotate={card.rotate}
                active={isActiveLocation(
                  card.location,
                  activeEnvironmentId,
                  activeRegionId,
                  activeLocationId,
                )}
                onPick={handleLocationPick}
              />
            ))}
          </div>

          <div className={styles.searchHost} ref={searchHostRef}>
            {showSpotlight && (
              <div className={styles.spotlightPanel} role="dialog" aria-label="Search results">
                <div className={styles.spotlightSection}>
                  <p className={styles.spotlightTitle}>Places</p>
                  {filteredLocations.length === 0 ? (
                    <p className={styles.spotlightStatus}>
                      No places match &ldquo;{trimmedQuery}&rdquo;
                    </p>
                  ) : (
                    <ul className={styles.spotlightResults}>
                      {filteredLocations.map((location) => (
                        <li key={location.id}>
                          <button
                            type="button"
                            className={styles.spotlightRow}
                            onClick={() => handleSpotlightLocation(location)}
                          >
                            <LocationThumb location={location} />
                            <span className={styles.locationText}>
                              <span className={styles.locationName}>{location.name}</span>
                              <span className={styles.locationMeta}>{location.subtitle}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {showGeocodeSection && (
                  <div className={styles.spotlightSection}>
                    <p className={styles.spotlightTitle}>Search worldwide</p>
                    {geocodePhase === 'loading' && (
                      <p className={styles.spotlightStatus} role="status">
                        Looking up &ldquo;{trimmedQuery}&rdquo;…
                      </p>
                    )}
                    {geocodePhase === 'error' && geocodeError && (
                      <p className={styles.spotlightStatus}>{geocodeError}</p>
                    )}
                    {geocodePhase === 'idle' && geocodeResults.length === 0 && (
                      <p className={styles.spotlightStatus}>No results for &ldquo;{trimmedQuery}&rdquo;</p>
                    )}
                    {geocodeResults.length > 0 && (
                      <ul className={styles.spotlightResults}>
                        {geocodeResults.map((result) => (
                          <li key={result.placeId}>
                            <button
                              type="button"
                              className={styles.spotlightRow}
                              onClick={() => handleSpotlightGeocode(result)}
                            >
                              <span
                                className={`${styles.rowThumbFallback} ${styles.geocodeThumb}`}
                                aria-hidden
                              />
                              <span className={styles.locationText}>
                                <span className={styles.locationName}>{result.shortName}</span>
                                <span className={styles.locationMeta}>
                                  {result.subtitle || result.displayName}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className={`${styles.searchField} ${showSpotlight ? styles.searchFieldActive : ''}`}>
              <UiIcon icon="magnifying-glass" size="sm" className={styles.searchFieldIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search places — city, region, country…"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSpotlightOpen(true);
                }}
                onFocus={() => setSpotlightOpen(true)}
                aria-label="Search places"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
