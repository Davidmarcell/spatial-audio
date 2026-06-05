import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import {
  getGlobeStyle,
  globeStyles,
  readGlobeStyleFromUrl,
  writeGlobeStyleToUrl,
  buildGlobeShareUrl,
  type GlobeStyleId,
} from '../data/globeStyles';
import {
  globeAppearancePresets,
  loadCountryFeatures,
  type CountryFeature,
  type GlobeAppearancePreset,
} from '../data/globeAppearance';
import { resolveSoundscapeForGeocode } from '../data/locationTemplates';
import { createCustomWorldLocation, type WorldLocation } from '../data/worldLocations';
import { findNearestRegion } from '../utils/geo';
import {
  fetchGeocodeResults,
  GEOCODE_DEBOUNCE_MS,
  type GeocodeResult,
} from '../utils/geocode';
import styles from './GlobeExplorer.module.css';

type Props = {
  locations: WorldLocation[];
  activeEnvironmentId: string;
  activeRegionId: string;
  activeLocationId?: string;
  onSelect: (location: WorldLocation) => void;
  onClose: () => void;
};

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

export function GlobeExplorer({
  locations,
  activeEnvironmentId,
  activeRegionId,
  activeLocationId,
  onSelect,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<{
    pointOfView: (pov: { lat?: number; lng?: number; altitude?: number }, ms?: number) => void;
    pointsData: (data: WorldLocation[]) => void;
  } | null>(null);
  const onSelectRef = useRef(onSelect);
  const handleLocationPickRef = useRef<(location: WorldLocation) => void>(() => {});
  const activeRef = useRef({
    environmentId: activeEnvironmentId,
    regionId: activeRegionId,
    locationId: activeLocationId,
  });
  const [styleId, setStyleId] = useState<GlobeStyleId>(() => readGlobeStyleFromUrl());
  const [appearancePreset, setAppearancePreset] = useState<GlobeAppearancePreset>(2);
  const [countryFeatures, setCountryFeatures] = useState<CountryFeature[]>([]);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodePhase, setGeocodePhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [previewPin, setPreviewPin] = useState<WorldLocation | null>(null);
  const [locationPhase, setLocationPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);

  const style = getGlobeStyle(styleId);
  const appearance = globeAppearancePresets[appearancePreset];

  useEffect(() => {
    loadCountryFeatures()
      .then(setCountryFeatures)
      .catch(() => setCountryFeatures([]));
  }, []);

  const filteredLocations = useMemo(
    () => locations.filter((location) => matchesSearch(location, searchQuery)),
    [locations, searchQuery],
  );

  const globePoints = useMemo(() => {
    const curated = filteredLocations.filter((location) => !location.custom);
    if (previewPin && !curated.some((location) => location.id === previewPin.id)) {
      return [...curated, previewPin];
    }
    return curated.length > 0 ? curated : filteredLocations;
  }, [filteredLocations, previewPin]);

  const showGeocodeSection = searchQuery.trim().length >= 2;

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

  const handleStyleChange = useCallback((nextStyleId: GlobeStyleId) => {
    setStyleId(nextStyleId);
    writeGlobeStyleToUrl(nextStyleId);
    setShareHint(null);
  }, []);

  const handleShareStyle = useCallback(async () => {
    const url = buildGlobeShareUrl(styleId);
    try {
      await navigator.clipboard.writeText(url);
      setShareHint('Link copied — paste to share this globe style');
    } catch {
      setShareHint(url);
    }
  }, [styleId]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    activeRef.current = {
      environmentId: activeEnvironmentId,
      regionId: activeRegionId,
      locationId: activeLocationId,
    };
  }, [activeEnvironmentId, activeRegionId, activeLocationId]);

  const handleLocationPick = useCallback((location: WorldLocation) => {
    setPreviewPin(location.custom ? location : null);
    globeRef.current?.pointOfView({ lat: location.lat, lng: location.lng, altitude: 1.55 }, 700);
    onSelectRef.current(location);
  }, []);

  const handleGeocodePick = useCallback((result: GeocodeResult) => {
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
  }, [handleLocationPick]);

  useEffect(() => {
    handleLocationPickRef.current = handleLocationPick;
  }, [handleLocationPick]);

  useEffect(() => {
    globeRef.current?.pointsData(globePoints);
  }, [globePoints]);

  const handleUseMyLocation = useCallback(() => {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationPhase('error');
      setLocationError('Geolocation not supported');
      return;
    }

    setLocationPhase('loading');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const nearest = findNearestRegion(coords, locations);

        globeRef.current?.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.65 }, 900);

        if (nearest) {
          handleLocationPickRef.current(nearest);
        }

        setLocationPhase('idle');
      },
      (error) => {
        setLocationPhase('error');
        setLocationError(
          error.code === 1 ? 'Location denied' : error.code === 3 ? 'Timed out' : 'Location failed',
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }, [locations]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pickLocation = (point: unknown) => {
      handleLocationPick(point as WorldLocation);
    };

    let globe: {
      pointOfView: (pov: { lat?: number; lng?: number; altitude?: number }, ms?: number) => void;
      width: (w: number) => void;
      height: (h: number) => void;
      pointsData: (data: WorldLocation[]) => void;
      controls: () => { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean };
    };

    const outlineStroke = `rgba(30, 28, 26, ${appearance.outlineOpacity})`;

    const factory = Globe()
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor(style.atmosphereColor)
      .atmosphereAltitude(style.atmosphereAltitude)
      .showGraticules(style.graticule)
      .globeImageUrl(style.globeImage)
      .bumpImageUrl(style.bumpImage)
      .polygonsData(appearance.showOutlines ? countryFeatures : [])
      .polygonCapColor(() => 'rgba(0, 0, 0, 0)')
      .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
      .polygonStrokeColor(() => outlineStroke)
      .polygonAltitude(0.005)
      .pointsData(locations)
      .pointLat('lat')
      .pointLng('lng')
      .pointsMerge(false)
      .pointAltitude(0.04)
      .pointRadius(appearance.pointRadius)
      .pointColor((point) => {
        const location = point as WorldLocation;
        const active = isActiveLocation(
          location,
          activeRef.current.environmentId,
          activeRef.current.regionId,
          activeRef.current.locationId,
        );
        return active ? '#111111' : '#ffffff';
      })
      .pointLabel((point) => {
        const location = point as WorldLocation;
        return `${location.name}, ${location.subtitle}`;
      })
      .onPointClick(pickLocation);

    if (style.useLightMaterial) {
      factory.globeMaterial(
        new THREE.MeshPhongMaterial({
          color: style.materialColor ?? '#faf8f4',
          bumpScale: (style.id === 'topo' ? 10 : 16) * appearance.bumpScale,
          specular: '#ffffff',
          shininess: style.id === 'topo' ? 6 : 10,
          opacity: 0.98,
          transparent: true,
        }),
      );
    }

    globe = factory(container);

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.28;
    controls.enableZoom = true;

    globeRef.current = globe;

    const active = locations.find((location) =>
      isActiveLocation(location, activeEnvironmentId, activeRegionId, activeLocationId),
    );
    globe.pointOfView(
      active
        ? { lat: active.lat, lng: active.lng, altitude: 1.85 }
        : { lat: 18, lng: 10, altitude: 2.15 },
      0,
    );

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      globe.width(width);
      globe.height(height);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      container.innerHTML = '';
      globeRef.current = null;
    };
  }, [
    activeEnvironmentId,
    activeRegionId,
    activeLocationId,
    appearance.bumpScale,
    appearance.outlineOpacity,
    appearance.pointRadius,
    appearance.showOutlines,
    countryFeatures,
    handleLocationPick,
    locations,
    style.atmosphereAltitude,
    style.atmosphereColor,
    style.bumpImage,
    style.globeImage,
    style.graticule,
    style.id,
    style.materialColor,
    style.useLightMaterial,
  ]);

  return (
    <div className={styles.root} aria-labelledby="globe-explorer-title">
      <header className={styles.header}>
        <div>
          <h2 id="globe-explorer-title" className={styles.title}>
            Explore the world
          </h2>
          <p className={styles.subtitle}>Click a dot to fly there and start the soundscape</p>
        </div>
        <button type="button" className={styles.close} aria-label="Close map" onClick={onClose}>
          ×
        </button>
      </header>

      <div className={styles.styleBar}>
        <span className={styles.styleLabel}>Globe style</span>
        <div className={styles.styleOptions} role="tablist" aria-label="Globe style">
          {globeStyles.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={styleId === option.id}
              className={`${styles.styleOption} ${styleId === option.id ? styles.styleOptionActive : ''}`}
              onClick={() => handleStyleChange(option.id)}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.shareButton} onClick={() => void handleShareStyle()}>
          Copy share link
        </button>
        {shareHint && <p className={styles.shareHint}>{shareHint}</p>}
      </div>

      <div className={styles.appearanceBar}>
        <span className={styles.styleLabel}>Appearance</span>
        <div className={styles.appearanceOptions} role="group" aria-label="Globe appearance">
          {([1, 2, 3, 4] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              className={`${styles.appearanceOption} ${appearancePreset === preset ? styles.appearanceOptionActive : ''}`}
              aria-pressed={appearancePreset === preset}
              onClick={() => setAppearancePreset(preset)}
              title={
                preset === 1
                  ? 'Soft outlines'
                  : preset === 2
                    ? 'Balanced'
                    : preset === 3
                      ? 'Bold outlines & dots'
                      : 'Minimal — no outlines'
              }
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        <div
          className={styles.globeHost}
          style={{ background: style.hostBackground }}
        >
          <div ref={containerRef} className={styles.globeCanvas} />
        </div>

        <aside className={styles.list}>
          <div className={styles.listHeader}>
            <p className={styles.listTitle}>Places</p>
            <button
              type="button"
              className={styles.locationButton}
              onClick={handleUseMyLocation}
              disabled={locationPhase === 'loading'}
              aria-busy={locationPhase === 'loading'}
            >
              <span className={styles.locationDot} aria-hidden />
              <span className={styles.locationText}>
                <span className={styles.locationName}>
                  {locationPhase === 'loading' ? 'Finding location…' : 'Use my location'}
                </span>
                {locationError ? (
                  <span className={styles.locationMeta}>{locationError}</span>
                ) : (
                  <span className={styles.locationMeta}>Pin nearest soundscape</span>
                )}
              </span>
            </button>
          </div>
          <label className={styles.searchLabel}>
            <span className={styles.searchLabelText}>Search places</span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="City, region, country…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search places"
            />
          </label>
          <ul className={styles.locations}>
            {filteredLocations.map((location) => {
              const active = isActiveLocation(
                location,
                activeEnvironmentId,
                activeRegionId,
                activeLocationId,
              );
              return (
                <li key={location.id}>
                  <button
                    type="button"
                    className={`${styles.locationButton} ${active ? styles.locationActive : ''}`}
                    onClick={() => handleLocationPick(location)}
                  >
                    <span className={styles.locationDot} aria-hidden />
                    <span className={styles.locationText}>
                      <span className={styles.locationName}>{location.name}</span>
                      <span className={styles.locationMeta}>{location.subtitle}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {filteredLocations.length === 0 && !showGeocodeSection && (
              <li className={styles.noResults}>No places match &ldquo;{searchQuery}&rdquo;</li>
            )}
          </ul>
          {showGeocodeSection && (
            <div className={styles.geocodeSection}>
              <p className={styles.geocodeTitle}>Search worldwide</p>
              {geocodePhase === 'loading' && (
                <p className={styles.geocodeStatus} role="status">
                  Looking up &ldquo;{searchQuery.trim()}&rdquo;…
                </p>
              )}
              {geocodePhase === 'error' && geocodeError && (
                <p className={styles.geocodeStatus}>{geocodeError}</p>
              )}
              {geocodePhase === 'idle' && geocodeResults.length === 0 && (
                <p className={styles.geocodeStatus}>No results for &ldquo;{searchQuery.trim()}&rdquo;</p>
              )}
              {geocodeResults.length > 0 && (
                <ul className={styles.geocodeResults}>
                  {geocodeResults.map((result) => (
                    <li key={result.placeId}>
                      <button
                        type="button"
                        className={styles.locationButton}
                        onClick={() => handleGeocodePick(result)}
                      >
                        <span className={`${styles.locationDot} ${styles.geocodeDot}`} aria-hidden />
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
        </aside>
      </div>
    </div>
  );
}
