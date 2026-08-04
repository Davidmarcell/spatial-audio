import { UiIcon } from './UiIcon';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import createGlobe, { type Marker } from 'cobe';
import { resolveProceduralSoundscape } from '../utils/proceduralSoundscape';
import { createCustomWorldLocation, formatWorldLocationLabel, type WorldLocation } from '../data/worldLocations';
import {
  fetchGeocodeResults,
  GEOCODE_DEBOUNCE_MS,
  type GeocodeResult,
} from '../utils/geocode';
import { getLocationArtForItem } from '../data/locationArt';
import { publicUrl } from '../utils/publicUrl';
import { getResolvedTheme, type ResolvedTheme } from '../utils/theme';
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
const SCALE_MIN = 0.85;
// Max zoom is bounded by what still fits the modal: the whole globe grows via a
// CSS transform on the zoom layer (see the frame loop), and the modal is much
// wider than it is tall, so the globe's diameter is capped by the modal height.
// The base (unzoomed) diameter in the CSS was enlarged by +60px; to keep the
// fully-zoomed sphere (plus its anchored polaroid pins) from spilling past the
// modal's top/bottom edges, this cap was lowered from 1.4 → 1.22 so the max-zoom
// footprint stays essentially unchanged from before the enlargement (measured:
// ~587px vs the previously-safe ~590px at the reference 1400×900 window, leaving
// the same ~22px of clearance on each edge). Nothing is clipped at any edge.
const SCALE_MAX = 1.22;
const SCALE_DEFAULT = 1;
const WHEEL_ZOOM_SENSITIVITY = 0.0022;
/** Pixels of horizontal / vertical drag per radian of rotation (pointer). */
const DRAG_PHI_DIVISOR = 300;
const DRAG_THETA_DIVISOR = 500;
/** Touch drags rotate twice as far per pixel as a mouse drag. */
const TOUCH_DRAG_GAIN = 2;
const MARKER_SIZE = 0.015;
const MARKER_SIZE_ACTIVE = 0.024;
const FOCUS_HOLD_MS = 4000;

// ── Themed cobe palettes ─────────────────────────────────────────────────────
// The globe recolours with the app theme (read from `data-theme` on <html> via
// the shared theme util). These fields map 1:1 onto cobe's colour uniforms and
// are applied both at init and every frame (see the frame loop), so toggling
// the theme while the map is open updates the sphere live. `activeMarkerColor`
// is the on-sphere dot colour for the currently-selected location.
type CobePalette = {
  dark: number;
  baseColor: [number, number, number];
  markerColor: [number, number, number];
  glowColor: [number, number, number];
  activeMarkerColor: [number, number, number];
  mapBrightness: number;
  diffuse: number;
  opacity: number;
};

const GLOBE_PALETTES: Record<ResolvedTheme, CobePalette> = {
  // Light — the original "polaroids" preset: white sphere, soft white glow, a
  // legible blue marker and a near-black active dot that reads on the white land.
  light: {
    dark: 0,
    baseColor: [1, 1, 1],
    markerColor: [0.3, 0.45, 0.85],
    glowColor: [1, 1, 1],
    activeMarkerColor: [0.1, 0.12, 0.16],
    mapBrightness: 6,
    diffuse: 1.2,
    opacity: 0.92,
  },
  // Dark — deep blue-grey ocean, brighter markers and a subtle cool glow so the
  // sphere sits comfortably on the dark modal surface. The active dot flips to
  // near-white so it stays visible on the dark land.
  dark: {
    dark: 1,
    baseColor: [0.2, 0.23, 0.3],
    markerColor: [0.46, 0.68, 1],
    glowColor: [0.16, 0.22, 0.35],
    activeMarkerColor: [0.96, 0.98, 1],
    mapBrightness: 5.2,
    diffuse: 1.25,
    opacity: 0.95,
  },
};

// Expanded-polaroid footprint in *screen* pixels (pins keep a constant screen
// size regardless of zoom, so zooming in genuinely spreads them apart and lets
// more cards expand without overlapping — the "reveal on zoom" behaviour). The
// full card is ~62px wide; collision uses the smaller CORE_W/CORE_H below.
const CARD_H = 82;
const CARD_STEM = 9; // gap between the marker point and the card's lower edge
// Radius of the sphere in cobe's projection (`ee` + markerElevation); pin
// screen positions are derived with this so cards sit exactly on their marker.
const GLOBE_RADIUS = 0.8 + 0.01;
// Pins closer to the limb than this (view-space depth, 0 = limb, ~0.81 = dead
// centre) never auto-expand — they stay dots and fade — so cards cluster around
// the front of the globe where the user is looking. Hover/focus/selection still
// force any pin to expand regardless of depth.
const FRONT_DEPTH_MIN = 0.32;
// Limb fade band (view-space depth: 0 = limb/edge, ~0.81 = dead centre). Pins are
// fully hidden at/below LIMB_FADE_HIDE_DEPTH and fully opaque at/above
// LIMB_FADE_SHOW_DEPTH, fading linearly between the two for a smooth (non-popping)
// cutoff. Raising these tightens the cutoff so pins fade sooner as they rotate
// toward the rim, keeping only comfortably front-facing pins visible and reducing
// edge clutter. (Previously 0.04 / 0.20 — pins only vanished right at the edge.)
const LIMB_FADE_HIDE_DEPTH = 0.2;
const LIMB_FADE_SHOW_DEPTH = 0.4;

// ── Cluster stacking (declutter) ─────────────────────────────────────────────
// When several pins fall close together (e.g. the central-Europe cluster —
// Venice, Swiss Alps, Dolomites, Paris) we keep them ALL expanded as cards but
// nudge each card by the SMALLEST amount needed to a nearby free slot so they
// sit as a tight little group anchored on their pins — no leader lines, no
// flinging cards far out. The first (highest-scoring) card stays exactly on its
// marker and the rest tuck in around it, preferring to stay close over spreading
// apart. A 2-pin pairing therefore reads as two cards nestled side by side.
//
// Collision uses a reduced "legible core" (the image + caption area) rather than
// the full frosted card, so neighbouring cards may overlap lightly at their
// frosted borders while each core stays clear — the "all visible, tightly
// grouped, slight overlap is fine" look. Slots are searched outward from the
// marker so the displacement stays as small as possible.
const CORE_W = 38; // legible-core width used for stacking collision (< full card)
const CORE_H = 46; // legible-core height used for stacking collision (< CARD_H)
const STACK_STEP_X = 18; // small horizontal nudge increment between grouped cards
const STACK_STEP_Y = 20; // small vertical nudge increment between grouped cards
const STACK_MAX_LEVEL = 3; // furthest ring of candidate slots (keeps cards close)
// How many pins may auto-expand into cards. Raised well above the old budget of
// 4 so a small cluster can all be cards at once; still scales up a little with
// zoom. Front-central pins win first (see the score sort), so a focused cluster
// claims these slots before scattered limb pins.
const EXPAND_BUDGET_BASE = 10;
const EXPAND_BUDGET_ZOOM = 10;
// Hysteresis bonus added to the expansion score of a pin that was already a card
// last frame. This keeps membership sticky so a pin hovering right at the budget
// or front-depth boundary does not flicker in/out (and reshuffle the cluster) as
// rotation nudges its score by a hair. Small enough that a genuinely better pin
// still wins its slot.
const EXPAND_HYSTERESIS = 0.05;
// Collision positions are snapped to this pixel grid before slot assignment so
// sub-pixel wobble during rotation cannot tip a card across an overlap boundary
// and flip its chosen slot. Cards are still drawn at their exact marker position
// (only the declutter decision is quantised), so tracking stays smooth.
const COLLISION_SNAP = 4;
// Depth hysteresis for the auto-expand (front-depth) gate. A pin that was already
// a card is allowed to stay one until it falls this much below FRONT_DEPTH_MIN,
// so a pin drifting right on the boundary as the globe rotates does not rapidly
// toggle between dot and card (which would also reshuffle its whole cluster).
const FRONT_DEPTH_HYSTERESIS = 0.06;
// Limb visibility hysteresis (view-space depth). A pin only (re)appears once it is
// this far in front of the limb and only disappears once it slips this far behind
// it, so a pin sitting exactly on the limb (depth ≈ 0) cannot flip visible on/off
// every frame as rotation nudges its depth by a hair.
const LIMB_VISIBLE_SHOW_DEPTH = 0.02;
const LIMB_VISIBLE_HIDE_DEPTH = -0.02;
// The declutter slot layout for a cluster is frozen while the globe moves slowly
// and only re-solved once some card's marker has drifted more than this many
// screen pixels since the last solve (or the set of expanded cards changes). This
// stops the per-frame re-solve that made tightly-packed clusters (the NZ pair,
// Brooklyn) jitter: cards still track their markers exactly every frame, but the
// *relative* slot arrangement stays put until a real change is needed.
const RELAYOUT_MOVE_PX = 8;

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

/**
 * A single globe pin. Rendered as a zero-size anchor point that the frame loop
 * positions imperatively (via `transform: translate(...)`) so pins follow the
 * globe under rotation and zoom without re-rendering React. Each pin has two
 * visual tiers that the declutter pass toggles by adding/removing
 * `styles.pinExpanded`:
 *   • collapsed — an invisible hit target over cobe's on-sphere marker dot, so
 *     dense clusters read as clean dots instead of a pile of cards; and
 *   • expanded — the full frosted polaroid card + caption, shown for the
 *     hovered/focused/selected pin and the least-crowded pins near the centre.
 */
const Pin = memo(function Pin({
  location,
  image,
  rotate,
  active,
  onPick,
  registerPin,
  setHover,
  setFocus,
}: {
  location: WorldLocation;
  image: string | null;
  rotate: number;
  active: boolean;
  onPick: (location: WorldLocation) => void;
  registerPin: (id: string, el: HTMLButtonElement | null) => void;
  setHover: (id: string | null) => void;
  setFocus: (id: string | null) => void;
}) {
  return (
    <button
      ref={(el) => registerPin(location.id, el)}
      type="button"
      className={`${styles.pin} ${active ? styles.pinActive : ''}`}
      style={{ '--polaroid-rotate': `${rotate}deg` } as CSSProperties}
      onClick={() => onPick(location)}
      onPointerEnter={() => setHover(location.id)}
      onPointerLeave={() => setHover(null)}
      onFocus={() => setFocus(location.id)}
      onBlur={() => setFocus(null)}
      aria-label={`Go to ${formatWorldLocationLabel(location)}`}
    >
      <span className={styles.pinHit} aria-hidden />
      <span className={styles.pinCard}>
        {image ? (
          <img className={styles.pinImage} src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.pinFallback} aria-hidden>
            {location.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className={styles.pinCaption}>{formatWorldLocationLabel(location)}</span>
      </span>
    </button>
  );
});

function LocationThumb({ location }: { location: WorldLocation }) {
  const art = getLocationArtForItem(location);
  const rawSrc = art?.globeSrc ?? art?.src ?? null;
  const src = rawSrc ? publicUrl(rawSrc) : null;
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
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const pinLayerRef = useRef<HTMLDivElement>(null);
  // Live handles into each pin's DOM node + the currently hovered/focused pin,
  // read by the frame loop to position pins and decide which ones expand. Kept
  // in refs so pointer/focus interaction never triggers a React re-render.
  const pinElsRef = useRef(new Map<string, HTMLButtonElement>());
  const interactRef = useRef<{ hover: string | null; focus: string | null }>({
    hover: null,
    focus: null,
  });
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
  // Current cobe palette, read by the frame loop each frame so a theme toggle
  // recolours the running globe without tearing it down. Seeded from the live
  // theme so the first paint already matches (avoids a light→dark flash).
  const paletteRef = useRef<CobePalette>(GLOBE_PALETTES[getResolvedTheme()]);

  const [searchQuery, setSearchQuery] = useState('');
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodePhase, setGeocodePhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [previewPin, setPreviewPin] = useState<WorldLocation | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [theme, setTheme] = useState<ResolvedTheme>(() => getResolvedTheme());
  const searchHostRef = useRef<HTMLDivElement>(null);
  const spotlightOpenRef = useRef(false);

  const filteredLocations = useMemo(
    () => locations.filter((location) => matchesSearch(location, searchQuery)),
    [locations, searchQuery],
  );
  const curatedLocationCount = useMemo(
    () => locations.filter((location) => !location.custom).length,
    [locations],
  );
  const globeHeaderCopy = useMemo(() => {
    if (curatedLocationCount <= 0) {
      return 'Pick from places around the world to listen to different sounds and memories.';
    }
    return `Pick from ${curatedLocationCount} ${curatedLocationCount === 1 ? 'place' : 'places'} around the world to listen to different sounds and memories.`;
  }, [curatedLocationCount]);

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
          image: (() => {
            const raw = art?.globeSrc ?? art?.src ?? null;
            return raw ? publicUrl(raw) : null;
          })(),
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

  const registerPin = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) pinElsRef.current.set(id, el);
    else pinElsRef.current.delete(id);
  }, []);

  const setPinHover = useCallback((id: string | null) => {
    interactRef.current.hover = id;
  }, []);

  const setPinFocus = useCallback((id: string | null) => {
    interactRef.current.focus = id;
  }, []);

  const handleLocationPick = useCallback((location: WorldLocation) => {
    setPreviewPin(location.custom ? location : null);
    globeRef.current?.focus(location.lat, location.lng);
    onSelectRef.current(location);
  }, []);

  const handleGeocodePick = useCallback(
    (result: GeocodeResult) => {
      // Build a bespoke procedural soundscape for the geocoded coordinates
      // (identical to the "Use my location" flow) rather than snapping the
      // place onto one of a few curated templates. This ensures e.g. Berlin
      // gets a Berlin-derived scene at Berlin's coordinates instead of
      // resolving to a hardcoded European-urban template (London).
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

  // Track the app theme the same way ThemeToggle / useScenePlayingBarColors do:
  // observe `data-theme` on <html> and follow system changes when in auto mode.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(getResolvedTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = () => setTheme(getResolvedTheme());
    media.addEventListener('change', onSystemThemeChange);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', onSystemThemeChange);
    };
  }, []);

  // Point the frame loop at the new palette and rebuild markers so the active
  // dot's colour flips with the theme (globe base/glow update live each frame).
  useEffect(() => {
    paletteRef.current = GLOBE_PALETTES[theme];
    globeRef.current?.setMarkers(globePoints);
  }, [theme, globePoints]);

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
          color: active ? paletteRef.current.activeMarkerColor : undefined,
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
    const zoom = {
      scale: SCALE_DEFAULT,
      targetScale: SCALE_DEFAULT,
      offset: [0, 0] as [number, number],
      targetOffset: [0, 0] as [number, number],
    };
    let focusUntil = 0;

    // Zoom is applied as a CSS transform (`translate(offset) scale(scale)`) on
    // the wrapping layer, so the offset lives in screen pixels. Clamp panning so
    // the globe cannot be dragged entirely out of view (its edge may reach the
    // centre at most).
    const clampOffset = (scale: number, offset: [number, number]): [number, number] => {
      if (scale <= 1) return [0, 0];
      const maxX = (width * (scale - 1)) / 2;
      const maxY = (height * (scale - 1)) / 2;
      return [clamp(offset[0], -maxX, maxX), clamp(offset[1], -maxY, maxY)];
    };

    const applyZoom = (factor: number, anchorX: number, anchorY: number) => {
      const oldScale = zoom.targetScale;
      const newScale = clamp(oldScale * factor, SCALE_MIN, SCALE_MAX);
      if (Math.abs(newScale - oldScale) < 1e-6) return;

      const anchorOffsetX = anchorX - width / 2;
      const anchorOffsetY = anchorY - height / 2;
      const scaleRatio = newScale / oldScale;

      if (newScale <= 1.001) {
        zoom.targetScale = SCALE_DEFAULT;
        zoom.targetOffset = [0, 0];
      } else {
        zoom.targetScale = newScale;
        zoom.targetOffset = clampOffset(newScale, [
          anchorOffsetX - (anchorOffsetX - zoom.targetOffset[0]) * scaleRatio,
          anchorOffsetY - (anchorOffsetY - zoom.targetOffset[1]) * scaleRatio,
        ]);
      }

      focusUntil = performance.now() + FOCUS_HOLD_MS;
    };

    let width = 1;
    let height = 1;
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.8 : 2);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const side = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
      width = side;
      height = side;
    };
    resize();

    const initialPalette = paletteRef.current;
    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width,
      height,
      phi: rotation.phi,
      theta: rotation.theta,
      dark: initialPalette.dark,
      diffuse: initialPalette.diffuse,
      mapSamples: 16_000,
      mapBrightness: initialPalette.mapBrightness,
      baseColor: initialPalette.baseColor,
      markerColor: initialPalette.markerColor,
      glowColor: initialPalette.glowColor,
      markerElevation: 0.01,
      opacity: initialPalette.opacity,
      scale: zoom.scale,
      offset: zoom.offset,
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

    // ── Pointer drag (rotate) + pinch zoom ──────────────────────────────────
    const pointer = { id: -1, x: 0, y: 0, active: false, moved: false };
    const activePointers = new Map<number, { x: number; y: number }>();
    const pinch = { active: false, distance: 0, scale: SCALE_DEFAULT, midX: width / 2, midY: height / 2 };
    let blockClickUntil = 0;

    const pointerCanvasPoint = (event: { clientX: number; clientY: number }) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * width,
        y: ((event.clientY - rect.top) / rect.height) * height,
      };
    };

    const syncPinch = () => {
      if (activePointers.size !== 2) {
        pinch.active = false;
        return;
      }
      const [first, second] = Array.from(activePointers.values());
      pinch.active = true;
      pinch.distance = Math.hypot(second.x - first.x, second.y - first.y);
      pinch.scale = zoom.targetScale;
      pinch.midX = (first.x + second.x) / 2;
      pinch.midY = (first.y + second.y) / 2;
    };

    const onPointerDown = (event: PointerEvent) => {
      const point = pointerCanvasPoint(event);
      activePointers.set(event.pointerId, point);
      if (activePointers.size === 2) {
        pointer.active = false;
        syncPinch();
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
        focusUntil = performance.now() + FOCUS_HOLD_MS;
        return;
      }

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
      if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, pointerCanvasPoint(event));
      }

      if (activePointers.size === 2 && pinch.active) {
        const [first, second] = Array.from(activePointers.values());
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        if (pinch.distance > 0) {
          applyZoom(distance / pinch.distance, (first.x + second.x) / 2, (first.y + second.y) / 2);
          pinch.distance = distance;
        }
        focusUntil = performance.now() + FOCUS_HOLD_MS;
        return;
      }

      if (!pointer.active || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.moved && Math.hypot(dx, dy) > 3) pointer.moved = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      // A finger drags a much shorter distance than a mouse, so touch spins the
      // globe twice as far per pixel.
      const gain = event.pointerType === 'touch' ? TOUCH_DRAG_GAIN : 1;
      target.phi += (dx * gain) / DRAG_PHI_DIVISOR;
      target.theta = clamp(
        target.theta + (dy * gain) / DRAG_THETA_DIVISOR,
        -THETA_LIMIT,
        THETA_LIMIT,
      );
      focusUntil = performance.now() + FOCUS_HOLD_MS;
    };

    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) pinch.active = false;

      if (!pointer.active || event.pointerId !== pointer.id) {
        if (activePointers.size === 0) canvas.style.cursor = 'grab';
        return;
      }
      if (pointer.moved) blockClickUntil = performance.now() + 200;
      pointer.active = false;
      canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = pointerCanvasPoint(event);
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
      applyZoom(factor, point.x, point.y);
    };

    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Click-to-pick the nearest visible marker (polaroids handle their own clicks).
    // Work in canvas fractions (0..1): a uniform scale + translate transform on
    // the wrapping layer preserves fractional positions within the canvas rect,
    // so this stays correct at any zoom without knowing the transform.
    const onClick = (event: MouseEvent) => {
      if (performance.now() < blockClickUntil) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const fx = (event.clientX - rect.left) / rect.width;
      const fy = (event.clientY - rect.top) / rect.height;
      const threshold = Math.max(16, Math.min(28, width * 0.05)) / width;
      let best: { location: WorldLocation; distance: number } | null = null;
      for (const location of renderedPoints) {
        const projected = projectMarker(location.lat, location.lng);
        if (!projected.visible) continue;
        const distance = Math.hypot(projected.x - fx, projected.y - fy);
        if (distance > threshold) continue;
        if (!best || distance < best.distance) best = { location, distance };
      }
      if (best) handleLocationPickRef.current(best.location);
    };

    // Mirror of cobe's internal lat/lng → screen projection (see `O`/`W` in
    // cobe's source). Returns the marker's position as a fraction of the canvas
    // (0..1), whether it faces the camera, and its view-space depth (0 at the
    // limb, →1 dead centre) which drives z-ordering and edge fade. The unit
    // sphere direction is scaled by GLOBE_RADIUS so the fraction lands exactly
    // on the drawn marker (cobe draws markers at radius 0.8 + markerElevation).
    const projectMarker = (lat: number, lng: number) => {
      const latRad = (lat * Math.PI) / 180;
      const lngRad = (lng * Math.PI) / 180 - Math.PI;
      const cosLat = Math.cos(latRad);
      const vx = -cosLat * Math.cos(lngRad) * GLOBE_RADIUS;
      const vy = Math.sin(latRad) * GLOBE_RADIUS;
      const vz = cosLat * Math.sin(lngRad) * GLOBE_RADIUS;
      const cr = Math.cos(rotation.theta);
      const sr = Math.sin(rotation.theta);
      const ca = Math.cos(rotation.phi);
      const sa = Math.sin(rotation.phi);
      const x = ca * vx + sa * vz;
      const y = sr * sa * vx + cr * vy - sr * ca * vz;
      const z = -sa * cr * vx + sr * vy + ca * cr * vz;
      const aspect = width / height;
      // cobe now renders at base scale/offset (zoom is a CSS transform on the
      // layer), so project to base canvas fractions.
      return {
        x: (x / aspect + 1) / 2,
        y: (-y + 1) / 2,
        depth: z,
        visible: z >= 0,
      };
    };

    canvas.addEventListener('click', onClick);

    // ── Declutter + placement pass (runs each frame) ─────────────────────────
    // Positions every pin over its marker and picks which pins get to show
    // their full polaroid card. Everything is derived from live screen geometry
    // so it stays correct under rotation, zoom and pan.
    const boxesOverlap = (
      a: { l: number; r: number; t: number; b: number },
      b: { l: number; r: number; t: number; b: number },
    ) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

    // Candidate card slots, ordered by increasing displacement from the marker so
    // each card is nudged only as far as needed to clear its neighbours and the
    // group stays tight around the pins. Slots spread in all directions (there
    // are no leader lines to keep tidy) but downward slots carry a small penalty
    // so cards prefer to tuck up/sideways over covering the pin below them.
    const stackSlots: Array<[number, number]> = [];
    for (let uy = -STACK_MAX_LEVEL; uy <= STACK_MAX_LEVEL; uy += 1) {
      for (let ux = -STACK_MAX_LEVEL; ux <= STACK_MAX_LEVEL; ux += 1) {
        stackSlots.push([ux * STACK_STEP_X, uy * STACK_STEP_Y]);
      }
    }
    const slotCost = ([dx, dy]: [number, number]) =>
      Math.abs(dx) + Math.abs(dy) + (dy > 0 ? STACK_STEP_Y : 0);
    stackSlots.sort((a, b) => slotCost(a) - slotCost(b));

    // Legible-core box (image + caption region) for a card anchored at marker
    // (mx, my) and shifted by slot offset (dx, dy). Collision uses this smaller
    // box so neighbouring cards may overlap lightly at their frosted borders
    // while each core stays clear — "lightly stacked, minimal overlap".
    const coreBox = (mx: number, my: number, dx: number, dy: number) => {
      const cx = mx + dx;
      const cardCentreY = my - CARD_STEM + dy - CARD_H / 2;
      return {
        l: cx - CORE_W / 2,
        r: cx + CORE_W / 2,
        t: cardCentreY - CORE_H / 2,
        b: cardCentreY + CORE_H / 2,
      };
    };

    type PinPlacement = {
      id: string;
      el: HTMLButtonElement;
      x: number;
      y: number;
      depth: number;
      forced: boolean;
      score: number;
      // Stable geographic identity (does NOT change as the globe rotates) used to
      // order slot assignment deterministically, so which pin anchors a cluster
      // and which slot each card takes stays fixed frame to frame.
      lat: number;
      lng: number;
      expand: boolean;
    };

    const prevVisible = new Map<string, boolean>();
    const prevExpanded = new Map<string, boolean>();
    // Committed cluster layout, persisted across frames so slot offsets only move
    // when something genuinely changes (see RELAYOUT_MOVE_PX). `committedAnchor`
    // records each card's marker position at the moment its slot was last solved
    // so we can measure drift; `committedKey` is the membership signature.
    const committedSlots = new Map<string, [number, number]>();
    const committedAnchor = new Map<string, { x: number; y: number }>();
    let committedKey = '';

    const layoutPins = () => {
      const overlay = pinLayerRef.current;
      if (!overlay) return;
      const canvasRect = canvas.getBoundingClientRect();
      if (canvasRect.width === 0 || canvasRect.height === 0) return;
      const overlayRect = overlay.getBoundingClientRect();
      const { hover, focus } = interactRef.current;

      const candidates: PinPlacement[] = [];
      for (const location of renderedPoints) {
        const el = pinElsRef.current.get(location.id);
        if (!el) continue;
        const projected = projectMarker(location.lat, location.lng);
        // Hysteretic limb visibility: a pin must come a hair in front of the limb
        // to (re)appear and slip a hair behind it to vanish, so a pin sitting on
        // the limb cannot toggle on/off (and reshuffle its cluster) every frame.
        const wasVisible = prevVisible.get(location.id) === true;
        const isVisible =
          projected.depth > (wasVisible ? LIMB_VISIBLE_HIDE_DEPTH : LIMB_VISIBLE_SHOW_DEPTH);
        if (!isVisible) {
          // Back of the globe — hide entirely and drop from the tab order.
          if (prevVisible.get(location.id) !== false) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            el.tabIndex = -1;
            el.classList.remove(styles.pinExpanded);
            prevVisible.set(location.id, false);
            prevExpanded.set(location.id, false);
          }
          continue;
        }

        const px = canvasRect.left - overlayRect.left + projected.x * canvasRect.width;
        const py = canvasRect.top - overlayRect.top + projected.y * canvasRect.height;
        const active = isActiveLocation(
          location,
          activeRef.current.environmentId,
          activeRef.current.regionId,
          activeRef.current.locationId,
        );
        const forced = active || hover === location.id || focus === location.id;
        // Prefer pins near the centre and toward the front of the globe. A small
        // hysteresis bonus keeps a pin that was already a card in the running so
        // membership does not flicker as rotation nudges the raw score.
        const centreDist = Math.hypot(projected.x - 0.5, projected.y - 0.5);
        const score =
          projected.depth * 0.6 -
          centreDist +
          (prevExpanded.get(location.id) ? EXPAND_HYSTERESIS : 0);

        el.style.transform = `translate(${px}px, ${py}px)`;
        const edgeFade = clamp(
          (projected.depth - LIMB_FADE_HIDE_DEPTH) / (LIMB_FADE_SHOW_DEPTH - LIMB_FADE_HIDE_DEPTH),
          0,
          1,
        );
        el.style.opacity = String(forced ? Math.max(0.92, edgeFade) : edgeFade);
        el.style.pointerEvents = 'auto';
        if (prevVisible.get(location.id) === false) {
          el.tabIndex = 0;
          prevVisible.set(location.id, true);
        }

        candidates.push({
          id: location.id,
          el,
          x: px,
          y: py,
          depth: projected.depth,
          forced,
          score,
          lat: location.lat,
          lng: location.lng,
          expand: false,
        });
      }

      // ── Pass 1: membership (WHICH pins become cards) ──────────────────────
      // Score order picks the front-central pins first; forced pins always win.
      // The hysteresis baked into `score` keeps the chosen set stable so cards
      // do not blink in/out at the budget boundary during rotation.
      candidates.sort((a, b) => b.score - a.score);
      const autoBudget =
        EXPAND_BUDGET_BASE + Math.round((zoom.scale - 1) * EXPAND_BUDGET_ZOOM);
      let autoUsed = 0;
      for (const pin of candidates) {
        pin.expand = pin.forced;
        // A pin that was already a card keeps a slightly lower depth bar so it
        // does not flip between dot and card as rotation nudges it across the
        // front-depth boundary (which would also reshuffle its whole cluster).
        const frontMin = prevExpanded.get(pin.id)
          ? FRONT_DEPTH_MIN - FRONT_DEPTH_HYSTERESIS
          : FRONT_DEPTH_MIN;
        if (!pin.expand && pin.depth >= frontMin && autoUsed < autoBudget) {
          pin.expand = true;
          autoUsed += 1;
        }
      }

      // ── Pass 2: slot assignment (WHERE each card sits) ────────────────────
      // Assign stack slots walking the expanding pins in a STABLE geographic
      // order (west→east, then north→south, then id) rather than in the volatile
      // score order. Because this key never changes as the globe rotates, the
      // same pin always anchors the cluster and each card keeps the same slot,
      // so tiny per-frame position changes no longer reshuffle the group and make
      // cards jump. Collision positions are snapped to a small grid for the same
      // reason (sub-pixel wobble can't tip a card across an overlap boundary).
      const expanding = candidates
        .filter((pin) => pin.expand)
        .sort((a, b) => a.lng - b.lng || a.lat - b.lat || (a.id < b.id ? -1 : 1));
      const snap = (value: number) => Math.round(value / COLLISION_SNAP) * COLLISION_SNAP;

      // Gate the (potentially reshuffling) slot solve so it only runs when it can
      // actually change something: the set of cards changed, or some card's marker
      // has drifted more than RELAYOUT_MOVE_PX since the last solve. Between solves
      // the committed offsets are reused verbatim, so a slowly-rotating cluster's
      // cards stay in a fixed arrangement (each still tracks its own marker exactly
      // via the per-frame translate) instead of re-solving — and jittering — every
      // frame.
      const membershipKey = expanding.map((pin) => pin.id).join('|');
      let needsRelayout = membershipKey !== committedKey;
      if (!needsRelayout) {
        for (const pin of expanding) {
          const anchor = committedAnchor.get(pin.id);
          if (
            !anchor ||
            !committedSlots.has(pin.id) ||
            Math.abs(pin.x - anchor.x) > RELAYOUT_MOVE_PX ||
            Math.abs(pin.y - anchor.y) > RELAYOUT_MOVE_PX
          ) {
            needsRelayout = true;
            break;
          }
        }
      }

      if (needsRelayout) {
        const placedCores: { l: number; r: number; t: number; b: number }[] = [];
        const nextSlots = new Map<string, [number, number]>();
        for (const pin of expanding) {
          const sx = snap(pin.x);
          const sy = snap(pin.y);
          // Stickiness: keep the card's previously committed slot if it still
          // clears the cards already placed this solve, so re-solves nudge only
          // the cards that genuinely conflict rather than rebuilding the cluster.
          const prevSlot = committedSlots.get(pin.id);
          let chosen: [number, number] | null = null;
          if (prevSlot) {
            const core = coreBox(sx, sy, prevSlot[0], prevSlot[1]);
            if (!placedCores.some((other) => boxesOverlap(core, other))) chosen = prevSlot;
          }
          // Otherwise find the nearest slot whose core clears every card already
          // placed. Falls back to the furthest slot if the neighbourhood is packed,
          // so the card still shows (goal: all cluster members visible).
          if (!chosen) {
            chosen = stackSlots[stackSlots.length - 1];
            for (const slot of stackSlots) {
              const core = coreBox(sx, sy, slot[0], slot[1]);
              if (!placedCores.some((other) => boxesOverlap(core, other))) {
                chosen = slot;
                break;
              }
            }
          }
          placedCores.push(coreBox(sx, sy, chosen[0], chosen[1]));
          nextSlots.set(pin.id, chosen);
        }
        // Commit the fresh solve and snapshot the anchors it was solved against so
        // drift is measured from here on. Rebuilding the maps also evicts stale
        // ids that are no longer expanded.
        committedSlots.clear();
        committedAnchor.clear();
        for (const pin of expanding) {
          committedSlots.set(pin.id, nextSlots.get(pin.id) ?? [0, 0]);
          committedAnchor.set(pin.id, { x: pin.x, y: pin.y });
        }
        committedKey = membershipKey;
      }

      // ── Pass 3: apply to the DOM ──────────────────────────────────────────
      for (const pin of candidates) {
        const [dx, dy] = pin.expand ? (committedSlots.get(pin.id) ?? [0, 0]) : [0, 0];
        // Offset the card to its slot (CSS var consumed by .pinCard) — just a
        // small nudge that keeps the card near its true marker, no leader line.
        pin.el.style.setProperty('--card-dx', `${dx}px`);
        pin.el.style.setProperty('--card-dy', `${dy}px`);

        // Front pins above back pins; expanded above collapsed; forced on top.
        const z =
          100 + Math.round(pin.depth * 200) + (pin.expand ? 400 : 0) + (pin.forced ? 1000 : 0);
        pin.el.style.zIndex = String(z);
        if (prevExpanded.get(pin.id) !== pin.expand) {
          pin.el.classList.toggle(styles.pinExpanded, pin.expand);
          prevExpanded.set(pin.id, pin.expand);
        }
      }
    };

    // Respect reduced-motion: the idle auto-spin is decorative movement, so hold
    // the globe still (users can still drag/zoom) when the OS asks for less
    // motion. Pin fades/expansions are disabled via CSS in the same query.
    const reducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let rafId = 0;
    // Becomes true only once cobe has actually drawn a frame at a real size, which
    // is the cue for the loading shimmer to cross-fade out and the globe to scale
    // up into view (see the CSS reveal). Guarded so the state flips exactly once.
    let firstFrameDrawn = false;
    const frame = () => {
      const now = performance.now();
      if (
        !pointer.active &&
        activePointers.size === 0 &&
        now > focusUntil &&
        !(reducedMotion?.matches ?? false)
      )
        target.phi += AUTO_SPIN;
      rotation.phi += (target.phi - rotation.phi) * LERP;
      rotation.theta += (target.theta - rotation.theta) * LERP;
      zoom.scale += (zoom.targetScale - zoom.scale) * LERP;
      zoom.offset[0] += (zoom.targetOffset[0] - zoom.offset[0]) * LERP;
      zoom.offset[1] += (zoom.targetOffset[1] - zoom.offset[1]) * LERP;
      if (zoom.scale <= 1.001) {
        zoom.scale = SCALE_DEFAULT;
        zoom.targetScale = SCALE_DEFAULT;
        zoom.offset = [0, 0];
        zoom.targetOffset = [0, 0];
      }
      // Apply zoom/pan as a CSS transform on the wrapping layer rather than via
      // cobe's internal `scale`. cobe's scale enlarges the sphere *inside* the
      // fixed canvas buffer, so past ~1.25x the sphere is clipped to the square
      // canvas (the hard flat-edge cut). Transforming the layer (which contains
      // both the canvas and the anchored polaroids) scales the whole globe as a
      // circle with nothing cut off, and the pins follow via CSS anchors.
      const layer = zoomLayerRef.current;
      if (layer) {
        layer.style.transform =
          zoom.scale <= 1.001
            ? 'translate(0px, 0px) scale(1)'
            : `translate(${zoom.offset[0]}px, ${zoom.offset[1]}px) scale(${zoom.scale})`;
      }
      // Colours are pushed every frame from the palette ref so a theme toggle
      // while the map is open recolours the sphere live (cobe's update() diffs
      // and re-uploads only the changed uniforms).
      const palette = paletteRef.current;
      globe.update({
        width,
        height,
        phi: rotation.phi,
        theta: rotation.theta,
        scale: SCALE_DEFAULT,
        offset: [0, 0],
        markers,
        dark: palette.dark,
        baseColor: palette.baseColor,
        markerColor: palette.markerColor,
        glowColor: palette.glowColor,
        mapBrightness: palette.mapBrightness,
        diffuse: palette.diffuse,
        opacity: palette.opacity,
      });
      // Position + declutter the HTML pins after the layer transform is applied
      // this frame, so the canvas rect we read already reflects zoom/pan.
      layoutPins();
      // The globe has now painted a real frame — trigger the loading→reveal swap.
      if (!firstFrameDrawn && width > 48) {
        firstFrameDrawn = true;
        setGlobeReady(true);
      }
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
      canvas.removeEventListener('wheel', onWheel);
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
      {/* Page-level, so the close sits in the sheet's own top-right corner on the
          same inset as the header content rather than beside the globe. */}
      {showCloseButton && (
        <div className={styles.topControls}>
          <button type="button" className={styles.close} aria-label="Close map" onClick={onClose}>
            <UiIcon icon="xmark" size="md" className={styles.controlIcon} />
          </button>
        </div>
      )}
      <div className={styles.body}>
        <header className={styles.pageHeader}>
          <h2 id="globe-explorer-title" className={styles.pageTitle}>
            Globe
          </h2>
          <p className={styles.pageCopy}>{globeHeaderCopy}</p>
        </header>
        <div className={styles.globeColumn}>
          <div className={styles.globeHost}>
            <div ref={zoomLayerRef} className={styles.zoomLayer}>
              <div
                ref={containerRef}
                className={`${styles.globeViewport} ${globeReady ? styles.globeViewportReady : ''}`}
              />
            </div>
            {/* Loading shimmer shown where the globe will appear until cobe paints
                its first frame; then it cross-fades out as the globe scales in. */}
            <div
              className={`${styles.globeLoader} ${globeReady ? styles.globeLoaderHidden : ''}`}
              aria-hidden
            >
              <span className={styles.globeLoaderDisc} />
              <span className={styles.globeLoaderRing} />
              <span className={styles.globeLoaderRing} />
            </div>
            {/* Pins live outside the zoom layer so they keep a constant screen
                size while the globe scales — this is what lets zooming reveal
                more cards. The frame loop positions each pin over its marker. */}
            <div
              ref={pinLayerRef}
              className={`${styles.pinLayer} ${globeReady ? styles.pinLayerReady : ''}`}
              aria-hidden={!globeReady}
            >
              {polaroids.map((card) => (
                <Pin
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
                  registerPin={registerPin}
                  setHover={setPinHover}
                  setFocus={setPinFocus}
                />
              ))}
            </div>
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
                      {filteredLocations.map((location, index) => (
                        <li
                          key={location.id}
                          style={{ '--row-index': index } as CSSProperties}
                        >
                          <button
                            type="button"
                            className={styles.spotlightRow}
                            onClick={() => handleSpotlightLocation(location)}
                          >
                            <LocationThumb location={location} />
                            <span className={styles.locationText}>
                              <span className={styles.locationName}>
                                {formatWorldLocationLabel(location)}
                              </span>
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
                        {geocodeResults.map((result, index) => (
                          <li
                            key={result.placeId}
                            style={{ '--row-index': index } as CSSProperties}
                          >
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
                                <span className={styles.locationName}>
                                  {formatWorldLocationLabel({
                                    name: result.shortName,
                                    subtitle: result.subtitle || '',
                                  })}
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
