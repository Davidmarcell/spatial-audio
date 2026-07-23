import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SheetStack } from '@silk-hq/components';
import { canvasToNormalized } from './audio/spatialMath';
import { DRAG_PREVIEW_INSTANCE_ID, isDragPreviewInstance } from './audio/dragPreview';
import type { PlaybackRecipe } from './audio/AudioEngine';
import { LocationSearchSpotlight } from './components/LocationSearchSpotlight';
import { UseMyLocationButton } from './components/UseMyLocationButton';
import type { GeoMatchResult } from './components/UseMyLocationButton';
import { RandomizeLocationButton } from './components/RandomizeLocationButton';
import {
  anchorFromTooltipTarget,
  BottomBarMagnetTooltip,
  type BottomBarTooltipAnchor,
} from './components/BottomBarMagnetTooltip';
import { MapButton } from './components/MapButton';
import { FlyingSoundTile } from './components/FlyingSoundTile';
import { PlayingBarEdgeGradientTuner } from './components/PlayingBarEdgeGradientTuner';
import { PlayCluster } from './components/PlayCluster';
import { SearchSpotlightAnimationTuner } from './components/SearchSpotlightAnimationTuner';
import { ShareButton } from './components/ShareButton';
import { SoundArtDetailSheet, type DetailTarget } from './components/SoundArtDetailSheet';
import { SoundTileDesignTuner } from './components/SoundTileDesignTuner';
import {
  CANVAS_TILE_SIZE,
  DOCK_BASE_SIZE,
  DRAG_THRESHOLD,
  reorderDockDefaultIds,
} from './components/soundPaletteLayout';
import { SoundPalette, type DockMagnetDrag, type SoundPaletteHandle } from './components/SoundPalette';
import { SpatialCanvas, type RadarRingVariant } from './components/SpatialCanvas';
import {
  appLocations,
  environments,
  getRegion,
  getRegionSoundCatalog,
  getSoundDef,
} from './data/environments';
import { GlobeMapSheet } from './components/GlobeMapSheet';
import { AddSoundSheet } from './components/AddSoundSheet';
import { LandingGate } from './components/LandingGate';
import { EnterTransition } from './components/EnterTransition';
import { SHEET_SCENE_REVEAL_MS, SCENE_AUTOPLAY_AFTER_MS, prefersReducedMotion } from './components/sheetRise';
import { loadLandingFanConfig, type FanConfig } from './components/landingFan';
import { LandingFanTuner } from './components/LandingFanTuner';
import { LandingEntranceTuner } from './components/LandingEntranceTuner';
import {
  applyLandingEntranceAnimation,
  loadLandingEntranceConfig,
  type LandingEntranceConfig,
} from './utils/landingEntranceAnimation';
import { AboutButton } from './components/AboutButton';
import { MobileControlsMenu } from './components/MobileControlsMenu';
import { ThemeToggle } from './components/ThemeToggle';
import { ProjectInfoSheet } from './components/ProjectInfoSheet';
import { appStackingAnimation } from './components/sheetDepth';
import sheetStack from './components/sheetStack.module.css';
import { worldLocations, createCustomWorldLocation, formatWorldLocationLabel, type WorldLocation } from './data/worldLocations';
import type { SoundDef, SpatialPoint } from './data/types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useSpatialSources } from './hooks/useSpatialSources';
import { buildSceneShareUrl, sceneFromAppState } from './utils/sceneShare';
import { randomizeSceneSounds } from './utils/randomizeSceneSounds';
import { regionSeed, selectSceneVariants } from './utils/soundscapeSelection';
import { enrichSounds } from './utils/soundTypeInference';
import { defaultSpawnVolumeForSound } from './utils/defaultSoundVolume';
import { displaySoundName } from './utils/soundCatalog';
import { isLandingGateEnabled, persistLandingGateEnabled } from './utils/landingGate';
import {
  snapshotOriginRect,
  type OriginRectSnapshot,
} from './utils/overlayOriginAnimation';
import styles from './App.module.css';

type SoundDrag = {
  sound: SoundDef;
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  active: boolean;
  source: 'palette' | 'library';
};

type ReturnFlight = {
  instanceId: string;
  soundId: string;
  name: string;
  from: { x: number; y: number };
  fromSize: number;
  to: { x: number; y: number };
};

/** Airy enter whoosh aligned with SHEET_RISE_DURATION_MS (~1300ms). */
const ENTER_WHOOSH_SRC = '/audio/ui/enter-whoosh.mp3';
/** Half the previous one-shot level so the whoosh sits under the reveal. */
const ENTER_WHOOSH_VOLUME = 0.275;
/** Quiet wind bed while browsing the globe from the landing. */
const GLOBE_AMBIENT_SRC = '/audio/ui/globe-ambient.mp3';
const GLOBE_AMBIENT_ID = 'ui:globe-ambient';
const GLOBE_AMBIENT_VOLUME = 0.16;

export default function App() {
  const GLOBE_DUCK_GAIN = 0.1;
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [detailOriginRect, setDetailOriginRect] = useState<OriginRectSnapshot | null>(null);
  /** Keeps the source canvas tile hidden through the card-expand close flight. */
  const [detailExpandInstanceId, setDetailExpandInstanceId] = useState<string | null>(null);
  const [dockDefaultIds, setDockDefaultIds] = useState<string[]>([]);
  const [environmentId, setEnvironmentId] = useState(environments[0].id);
  const [regionId, setRegionId] = useState(environments[0].regions[0].id);
  const [shuffleSalt, setShuffleSalt] = useState(0);
  const [soundDrag, setSoundDrag] = useState<SoundDrag | null>(null);
  const [returnFlight, setReturnFlight] = useState<ReturnFlight | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returningSoundId, setReturningSoundId] = useState<string | null>(null);
  const [dockMagnetDrag, setDockMagnetDrag] = useState<DockMagnetDrag | null>(null);
  const [showGlobe, setShowGlobe] = useState(false);
  // True while the full-screen globe was opened from the landing to *browse the
  // world* (Enter / empty-query Enter), as opposed to opening the map from
  // within a location. In this state the visitor has not yet entered a specific
  // place: no soundscape is mounted and no audio plays, so closing the globe (X)
  // returns to the landing, while picking a place enters that location.
  const [browsingFromLanding, setBrowsingFromLanding] = useState(false);
  // Shared stacked-sheet cover panel (see EnterTransition), used only for
  // navigations where the incoming page cannot be z-stacked above the outgoing
  // one (globe close, globe -> location, landing -> location, home). It rises up
  // over the lifting outgoing page and reveals the destination beneath.
  // `coverActive` mounts it; `coverKey` is bumped on every trigger so it always
  // remounts and replays cleanly, even mid-rise. Purely visual: it never gates
  // audio-unlock or `browsingFromLanding`. (Opening the globe uses no panel: the
  // globe itself rises as the incoming sheet, approach A.)
  const [coverActive, setCoverActive] = useState(false);
  const [coverKey, setCoverKey] = useState(0);
  // When a scene arrives behind the rising cover panel, the canvas holds its
  // tile radiate-in by this many ms so the tiles push out just as/after the
  // panel finishes rising and reveals the canvas rather than under it. 0 at boot
  // (no transition), then set to the reveal point for every covered entry.
  const [sceneEntranceDelayMs, setSceneEntranceDelayMs] = useState(0);
  // Token for the random-location-only tile transition: current tiles collapse
  // into the listener, then the new scene loads and reuses the normal radiate-in.
  const [randomizeTransitionToken, setRandomizeTransitionToken] = useState(0);
  // Bumped on every covered scene entry so the workspace assets (the canvas of
  // sound tiles and the bottom control bar) rise up into place as the cover
  // panel reveals them, matching the entrance parallax of the other sheets. This
  // same rise is also reused when closing the globe back into an existing
  // soundscape, so the tiles/UI push up from below rather than just fading in. 0
  // at boot means no rise on the very first paint.
  const [sceneRiseToken, setSceneRiseToken] = useState(0);
  // True for the scene-rise window so the bottom bar's portalled search pill
  // tracks the rising bar instead of staying pinned to its resting anchor while
  // the bar rises around it. Cleared once the rise animation settles.
  const [sceneRising, setSceneRising] = useState(false);
  // True only while the globe is opening over an already-entered soundscape. The
  // workspace stays mounted and lifts beneath the rising globe so the transition
  // reads as stacked sheets rather than the map simply appearing over a static
  // background. Cleared once the globe has fully arrived.
  const [workspaceGlobeOpening, setWorkspaceGlobeOpening] = useState(false);
  // Tracks that the currently-open globe was launched from an existing
  // soundscape, so the bottom chrome can stay mounted beneath it instead of
  // hiding/fading out as if there were no workspace under the globe.
  const [globeOverWorkspace, setGlobeOverWorkspace] = useState(false);
  // True while the landing is the OUTGOING page (Enter -> globe, or landing ->
  // location). It STAYS mounted and visible and is gently lifted + dimmed
  // beneath the incoming sheet (the rising globe, or the rising cover panel) so
  // the Enter reads as the old page staying and being pushed up while the new one
  // rises on top, rather than a hard cut. It unmounts only once the incoming
  // sheet has fully arrived (`onEntered`/`onCovered` clear this).
  const [landingExiting, setLandingExiting] = useState(false);
  // True while the full-screen globe is the OUTGOING page (globe close, or globe
  // -> location entry). It is kept mounted so it stays visible and lifts + dims
  // beneath the rising cover panel, and only unmounts once the panel has fully
  // risen (`onCovered` clears this).
  const [globeExiting, setGlobeExiting] = useState(false);
  // True while the landing is the INCOMING page returning home (map close ->
  // landing, or the wordmark home). The landing gate itself RISES up over the
  // lifting outgoing page (the globe, or the workspace) with the shared curved
  // top edge, so home arrives as a true stacked-sheet rise rather than a cover
  // panel that cross-fades out. Cleared by the gate's `onEntered` once it has
  // fully risen, which is also when the outgoing globe is unmounted.
  const [landingEntering, setLandingEntering] = useState(false);
  const [customGlobeLocation, setCustomGlobeLocation] = useState<WorldLocation | null>(null);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [showAddSounds, setShowAddSounds] = useState(false);
  const [addSoundOriginRect, setAddSoundOriginRect] = useState<OriginRectSnapshot | null>(null);
  const [autoPlayOnLoad, setAutoPlayOnLoad] = useState(false);
  const ringVariant: RadarRingVariant = 1;
  const [bottomBarTooltip, setBottomBarTooltip] = useState<BottomBarTooltipAnchor | null>(null);
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  // The landing search reports its own open state so the wordmark and fan tiles
  // recede to ~40% opacity (kept visible) while the search is expanded.
  const [landingSearchOpen, setLandingSearchOpen] = useState(false);
  const [locationSearchResetToken, setLocationSearchResetToken] = useState(0);
  // The landing gate doubles as the audio-unlock gesture: when enabled, the app
  // starts on the intro moment and the first entry (a location image or a
  // search) enters the workspace with audio playing. The gate is a dev-only
  // toggle (Radiance panel) that defaults OFF, so by default the app boots
  // straight into the workspace and the first-gesture unlock() fallback handles
  // audio.
  const [landingEnabled, setLandingEnabled] = useState(() => isLandingGateEnabled());
  const [hasEntered, setHasEntered] = useState(() => !isLandingGateEnabled());
  // Live fan layout for the landing card row, adjustable via the dev-only fan
  // controls panel and persisted (localStorage) as the landing default.
  const [fanConfig, setFanConfig] = useState<FanConfig>(() => loadLandingFanConfig());
  // Live entrance/loading animation timings for the landing gate, adjustable via
  // the dev-only entrance tuner and persisted (localStorage) as the default.
  // Written onto the document root as CSS custom properties the landing keyframes
  // read (see applyLandingEntranceAnimation).
  const [landingEntranceConfig, setLandingEntranceConfig] = useState<LandingEntranceConfig>(
    () => loadLandingEntranceConfig(),
  );
  // Bumped to replay the landing entrance in place: it is used as the LandingGate
  // `key`, so incrementing it remounts the gate (and its portalled search pill),
  // re-arming every one-shot entrance latch (wordmark/fan/tagline/search/Enter)
  // without a page refresh.
  const [landingReplayKey, setLandingReplayKey] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const bottomBarRef = useRef<HTMLElement>(null);
  const paletteRef = useRef<SoundPaletteHandle>(null);
  const wasGlobeOpenRef = useRef(showGlobe);
  const soundDragRef = useRef<SoundDrag | null>(null);
  // Bumped whenever the drag preview is torn down, so an in-flight (awaited)
  // updateDragPreview that resolves afterwards can detect it lost the race and
  // not leave an orphaned, never-cleaned-up preview source playing.
  const dragPreviewGenRef = useRef(0);
  const randomizeTransitionSeqRef = useRef(0);
  const pendingRandomRegionRef = useRef<{
    environmentId: string;
    regionId: string;
    token: number;
  } | null>(null);

  const {
    engine,
    unlock,
    play,
    pause,
    playOneShot,
    playLoop,
    stopLoop,
    togglePlay,
    isPlaying,
    isUnlocked,
  } = useAudioEngine();
  const {
    activeSounds,
    selectedId,
    setSelectedId,
    loadDefaults,
    addSound,
    removeSound,
    updatePosition,
    updateVolume,
    nudgeSelected,
  } = useSpatialSources();

  const region = useMemo(
    () => getRegion(environmentId, regionId)!,
    [environmentId, regionId],
  );

  const headerLocationLabel = useMemo(() => {
    if (
      customGlobeLocation
      && customGlobeLocation.environmentId === environmentId
      && customGlobeLocation.regionId === regionId
    ) {
      return formatWorldLocationLabel(customGlobeLocation);
    }
    return region.name;
  }, [customGlobeLocation, environmentId, regionId, region.name]);

  // Workspace chrome (bottom search, play, etc.) must wait until the landing
  // exit cover has finished — otherwise "Search places" flashes under the
  // rising sheet the moment a fan tile is clicked.
  const showWorkspaceChrome = hasEntered && !landingExiting && !landingEntering;

  const globeLocations = useMemo(() => {
    const curated = worldLocations.filter((location) => !location.custom);
    if (customGlobeLocation) return [...curated, customGlobeLocation];
    return curated;
  }, [customGlobeLocation]);

  const librarySounds = useMemo(
    () => enrichSounds(getRegionSoundCatalog(region.sounds, region.tags), region.tags),
    [region.sounds, region.tags],
  );

  const soundMap = useMemo(
    () => new Map(librarySounds.map((sound) => [sound.id, sound])),
    [librarySounds],
  );

  // Location-seeded variant selection: deterministically maps each sound id to a
  // concrete clip from its pool, so the same place is consistent across reloads,
  // different places differ, and `shuffleSalt` reseeds for a fresh take.
  const variantSelection = useMemo(
    () =>
      selectSceneVariants(librarySounds, {
        seed: region.seed ?? regionSeed(environmentId, regionId),
        salt: shuffleSalt,
        sceneTags: region.tags,
      }),
    [librarySounds, region.seed, region.tags, environmentId, regionId, shuffleSalt],
  );

  const regionArt = useMemo(
    () => ({
      id: regionId,
      soundIds: librarySounds.map((sound) => sound.id),
      tags: region.tags,
    }),
    [regionId, librarySounds, region.tags],
  );

  const activeSoundIds = useMemo(
    () => activeSounds.map((item) => item.soundId),
    [activeSounds],
  );

  const recipeForSound = useCallback(
    (soundId: string): PlaybackRecipe | undefined => {
      const variant = variantSelection.get(soundId);
      if (!variant) return undefined;
      return {
        src: variant.src,
        secondarySrc: variant.secondarySrc,
        sustained: variant.sustained,
        detuneCents: variant.detuneCents,
        loopOffset: variant.loopOffset,
      };
    },
    [variantSelection],
  );

  const ensureScenePlaying = useCallback(async () => {
    await unlock();
    if (!engine.isPlaying) {
      await play();
    }
  }, [engine, play, unlock]);

  const removeDragPreview = useCallback(() => {
    // Invalidate any in-flight updateDragPreview so it can't re-add the source
    // after we've removed it (async race → stuck, audible preview).
    dragPreviewGenRef.current += 1;
    if (engine.hasSource(DRAG_PREVIEW_INSTANCE_ID)) {
      engine.removeSource(DRAG_PREVIEW_INSTANCE_ID);
    }
  }, [engine]);

  const updateDragPreview = useCallback(
    async (sound: SoundDef, position: SpatialPoint) => {
      const gen = dragPreviewGenRef.current;
      await unlock();
      // The drag may have ended (removeDragPreview) while we awaited.
      if (dragPreviewGenRef.current !== gen) return;
      const volume = defaultSpawnVolumeForSound(sound);
      const recipe = recipeForSound(sound.id);

      if (!engine.hasSource(DRAG_PREVIEW_INSTANCE_ID)) {
        await engine.addSource(
          DRAG_PREVIEW_INSTANCE_ID,
          sound,
          position,
          volume,
          recipe,
        );
        // Lost the race: tear the just-created preview back down.
        if (dragPreviewGenRef.current !== gen) {
          engine.removeSource(DRAG_PREVIEW_INSTANCE_ID);
          return;
        }
      } else {
        engine.updatePosition(DRAG_PREVIEW_INSTANCE_ID, position);
        engine.updateVolume(DRAG_PREVIEW_INSTANCE_ID, volume);
      }

      if (!engine.isPlaying) {
        await play();
      }
    },
    [engine, play, recipeForSound, unlock],
  );

  // Warm enter whoosh + globe ambient so first Enter is not cold-fetch delayed.
  useEffect(() => {
    void engine.preloadVariants([ENTER_WHOOSH_SRC, GLOBE_AMBIENT_SRC]);
  }, [engine]);

  // Soft ambient while browsing the world map from the landing. Stop when the
  // globe closes or a place is picked (hasEntered / browsing ends).
  useEffect(() => {
    const shouldPlay = showGlobe && browsingFromLanding && !prefersReducedMotion();
    if (shouldPlay) {
      void playLoop(GLOBE_AMBIENT_ID, GLOBE_AMBIENT_SRC, {
        volume: GLOBE_AMBIENT_VOLUME,
        fadeInSeconds: 1.1,
      });
    } else {
      stopLoop(GLOBE_AMBIENT_ID);
    }
    return () => stopLoop(GLOBE_AMBIENT_ID);
  }, [browsingFromLanding, playLoop, showGlobe, stopLoop]);

  // Lazy-load: only fetch the variants the current scene actually plays, not
  // the whole catalog. Palette additions load on demand inside addSource.
  useEffect(() => {
    const srcs: string[] = [];
    for (const item of activeSounds) {
      const variant = variantSelection.get(item.soundId);
      if (variant) {
        srcs.push(variant.src);
        if (variant.secondarySrc) srcs.push(variant.secondarySrc);
      } else {
        const sound = soundMap.get(item.soundId);
        if (sound?.src) srcs.push(sound.src);
      }
    }
    if (srcs.length > 0) void engine.preloadVariants(srcs);
  }, [activeSounds, engine, soundMap, variantSelection]);

  const applyRegion = useCallback(
    (nextEnvironmentId: string, nextRegionId: string) => {
      const nextRegion = getRegion(nextEnvironmentId, nextRegionId);
      if (!nextRegion) return;

      const { canvasBedSounds, dockSoundIds } = randomizeSceneSounds(
        nextRegion.sounds,
        nextRegion.bedSounds ?? [],
      );

      setEnvironmentId(nextEnvironmentId);
      setRegionId(nextRegionId);
      setShuffleSalt(0);
      setDockDefaultIds(dockSoundIds);
      loadDefaults(canvasBedSounds);
      // Deterministically stop and disconnect every source from the outgoing
      // location and bump the engine load epoch, so an in-flight buffer load
      // (e.g. a long rain bed) for the old scene can never start on top of the
      // new one. All entry routes (search, globe pick, geolocation, random)
      // funnel through here.
      engine.beginSoundscapeTransition();
      setDetailTarget(null);
    },
    [engine, loadDefaults],
  );

  useEffect(() => {
    const { canvasBedSounds, dockSoundIds } = randomizeSceneSounds(
      region.sounds,
      region.bedSounds ?? [],
    );
    setDockDefaultIds(dockSoundIds);
    loadDefaults(canvasBedSounds);
    // Initial randomized scene only; region switches call applyRegion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDefaults]);

  useEffect(() => {
    if (isUnlocked) return;

    const enableAudio = () => {
      void unlock();
    };

    window.addEventListener('pointerdown', enableAudio, { once: true });
    window.addEventListener('keydown', enableAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
  }, [isUnlocked, unlock]);

  // Reshuffle: drop existing engine sources so the sync effect re-adds them
  // with the freshly reseeded variants. Runs only when the salt actually moves.
  const previousSaltRef = useRef(shuffleSalt);
  useEffect(() => {
    if (previousSaltRef.current === shuffleSalt) return;
    previousSaltRef.current = shuffleSalt;
    engine.beginSoundscapeTransition();
  }, [engine, shuffleSalt]);

  useEffect(() => {
    let cancelled = false;
    let autoPlayTimer: number | null = null;

    const sync = async () => {
      const activeIds = new Set(activeSounds.map((item) => item.instanceId));

      for (const instanceId of engine.getSourceIds()) {
        if (isDragPreviewInstance(instanceId)) continue;
        if (!activeIds.has(instanceId)) {
          engine.removeSource(instanceId);
        }
      }

      for (const item of activeSounds) {
        if (cancelled) return;
        if (item.instanceId === returningId) continue;
        const sound = getSoundDef(environmentId, regionId, item.soundId);
        if (!sound) continue;

        if (!engine.hasSource(item.instanceId)) {
          const variant = variantSelection.get(item.soundId);
          const recipe = variant
            ? {
                src: variant.src,
                secondarySrc: variant.secondarySrc,
                sustained: variant.sustained,
                detuneCents: variant.detuneCents,
                loopOffset: variant.loopOffset,
              }
            : undefined;
          await engine.addSource(item.instanceId, sound, item.position, item.volume, recipe);
          if (cancelled) {
            engine.removeSource(item.instanceId);
            return;
          }
        } else {
          engine.updatePosition(item.instanceId, item.position);
          engine.updateVolume(item.instanceId, item.volume);
        }
      }

      if (cancelled) return;

      if (autoPlayOnLoad) {
        await unlock();
        if (cancelled) return;
        // Wait until the entry cover dissolves and canvas tiles finish radiating
        // before starting the soundscape, so audio does not lead the visuals.
        const delayMs = prefersReducedMotion() ? 0 : SCENE_AUTOPLAY_AFTER_MS;
        if (delayMs > 0) {
          await new Promise<void>((resolve) => {
            autoPlayTimer = window.setTimeout(resolve, delayMs);
          });
          autoPlayTimer = null;
        }
        if (cancelled) return;
        await play();
        if (cancelled) return;
        setAutoPlayOnLoad(false);
      }
    };

    void sync();
    return () => {
      cancelled = true;
      if (autoPlayTimer != null) {
        window.clearTimeout(autoPlayTimer);
        autoPlayTimer = null;
      }
    };
  }, [
    activeSounds,
    autoPlayOnLoad,
    environmentId,
    play,
    regionId,
    engine,
    returningId,
    unlock,
    variantSelection,
  ]);

  const beginReturnToDock = useCallback(
    (instanceId: string, iconRect: DOMRect, dropPoint?: { x: number; y: number }) => {
      const item = activeSounds.find((entry) => entry.instanceId === instanceId);
      if (!item) return;

      const sound = soundMap.get(item.soundId);
      if (!sound) return;

      if (detailTarget?.instanceId === instanceId) {
        setDetailTarget(null);
      }
      if (selectedId === instanceId) {
        setSelectedId(null);
      }

      setDockMagnetDrag(null);

      const nextActiveIds = activeSounds
        .filter((entry) => entry.instanceId !== instanceId)
        .map((entry) => entry.soundId);

      const insertionIndex = dropPoint
        ? paletteRef.current?.getInsertionIndex(dropPoint.x, dropPoint.y) ?? 0
        : 0;

      const nextDockDefaultIds = reorderDockDefaultIds(
        dockDefaultIds,
        nextActiveIds,
        librarySounds,
        item.soundId,
        insertionIndex,
      );

      const target = paletteRef.current?.getSlotCenter(
        item.soundId,
        nextActiveIds,
        nextDockDefaultIds,
        item.soundId,
      );

      if (
        nextDockDefaultIds.length !== dockDefaultIds.length
        || nextDockDefaultIds.some((id, index) => id !== dockDefaultIds[index])
      ) {
        setDockDefaultIds(nextDockDefaultIds);
      }

      if (!target) {
        removeSound(instanceId);
        return;
      }

      setReturningId(instanceId);
      setReturningSoundId(item.soundId);
      // Start the return flight from the tile's exact on-screen box at release,
      // the same rect the drag mirror was showing, so the hand-off is seamless:
      // no size pop (it keeps its current size and only shrinks to the dock slot)
      // and no positional jump to the pointer, which can lag the tile mid-drag.
      setReturnFlight({
        instanceId,
        soundId: item.soundId,
        name: displaySoundName(sound),
        from: {
          x: iconRect.left + iconRect.width / 2,
          y: iconRect.top + iconRect.height / 2,
        },
        fromSize: iconRect.width,
        to: target,
      });
    },
    [
      activeSounds,
      detailTarget,
      dockDefaultIds,
      librarySounds,
      removeSound,
      selectedId,
      setSelectedId,
      soundMap,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedId) return;
      const step = event.shiftKey ? 0.1 : 0.04;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          nudgeSelected(-step, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          nudgeSelected(step, 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          nudgeSelected(0, step);
          break;
        case 'ArrowDown':
          event.preventDefault();
          nudgeSelected(0, -step);
          break;
        case 'Backspace':
        case 'Delete': {
          event.preventDefault();
          const icon = document.querySelector(
            `[data-instance-id="${selectedId}"] [data-sound-icon]`,
          ) as HTMLButtonElement | null;
          if (icon) {
            beginReturnToDock(selectedId, icon.getBoundingClientRect());
          } else {
            removeSound(selectedId);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [beginReturnToDock, nudgeSelected, removeSound, selectedId]);

  useEffect(() => {
    soundDragRef.current = soundDrag;
  }, [soundDrag]);

  useEffect(() => {
    if (!soundDrag) return;

    const onPointerMove = (event: PointerEvent) => {
      const drag = soundDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const distance = Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      );
      const active = drag.active || distance > DRAG_THRESHOLD;

      soundDragRef.current = {
        ...drag,
        x: event.clientX,
        y: event.clientY,
        active,
      };
      setSoundDrag(soundDragRef.current);

      if (!active) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (inside) {
        const position = canvasToNormalized(event.clientX, event.clientY, rect);
        void updateDragPreview(drag.sound, position);
      } else {
        removeDragPreview();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = soundDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      removeDragPreview();

      if (!drag.active) {
        if (drag.source === 'library') {
          addSound(drag.sound);
          void ensureScenePlaying();
          setShowAddSounds(false);
        }
        setSoundDrag(null);
        soundDragRef.current = null;
        return;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;

        if (inside) {
          const position = canvasToNormalized(event.clientX, event.clientY, rect);
          addSound(drag.sound, position);
          void ensureScenePlaying();
          if (drag.source === 'library') {
            setShowAddSounds(false);
          }
        }
      }

      setSoundDrag(null);
      soundDragRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      removeDragPreview();
    };
  }, [addSound, ensureScenePlaying, removeDragPreview, soundDrag, updateDragPreview]);

  const handlePhysicsMove = useCallback(
    (instanceId: string, position: { x: number; y: number }) => {
      if (engine.hasSource(instanceId)) {
        engine.updatePosition(instanceId, position);
      }
    },
    [engine],
  );

  const handleVolumeChange = useCallback(
    (instanceId: string, volume: number) => {
      updateVolume(instanceId, volume);
      if (engine.hasSource(instanceId)) {
        engine.updateVolume(instanceId, volume);
      }
    },
    [engine, updateVolume],
  );

  const handleOpenDetail = useCallback(
    (instanceId: string, originRect: DOMRect | null) => {
      const item = activeSounds.find((entry) => entry.instanceId === instanceId);
      if (!item) return;
      const sound = soundMap.get(item.soundId);
      setDetailOriginRect(snapshotOriginRect(originRect));
      setLocationSearchOpen(false);
      setDetailExpandInstanceId(instanceId);
      setDetailTarget({
        instanceId,
        soundId: item.soundId,
        name: sound ? displaySoundName(sound) : item.soundId,
        volume: item.volume,
      });
    },
    [activeSounds, soundMap],
  );

  const handleCloseDetail = useCallback(() => {
    setDetailTarget(null);
    setDetailOriginRect(null);
  }, []);

  const handleDetailExpandExited = useCallback(() => {
    setDetailExpandInstanceId(null);
  }, []);

  const handleDetailVolumeChange = useCallback(
    (instanceId: string, volume: number) => {
      handleVolumeChange(instanceId, volume);
      setDetailTarget((current) =>
        current?.instanceId === instanceId ? { ...current, volume } : current,
      );
    },
    [handleVolumeChange],
  );

  const handlePaletteDragStart = useCallback(
    (sound: SoundDef, event: React.PointerEvent<HTMLButtonElement>) => {
      void unlock();
      const drag: SoundDrag = {
        sound,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        source: 'palette',
      };
      soundDragRef.current = drag;
      setSoundDrag(drag);
    },
    [unlock],
  );

  const handleLibraryDragStart = useCallback(
    (sound: SoundDef, event: React.PointerEvent<HTMLButtonElement>) => {
      void unlock();
      const drag: SoundDrag = {
        sound,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        source: 'library',
      };
      soundDragRef.current = drag;
      setSoundDrag(drag);
    },
    [unlock],
  );

  const handleCanvasDragBegin = useCallback(() => {
    void ensureScenePlaying();
  }, [ensureScenePlaying]);

  // Fire the shared cover panel (for navigations where the incoming page cannot
  // be stacked above the outgoing one). Bumping the key remounts EnterTransition
  // so the rise always replays from a clean state, even if a previous one is
  // still mid-flight, which keeps repeated navigations reliable.
  const playCover = useCallback(() => {
    setCoverKey((key) => key + 1);
    setCoverActive(true);
  }, []);

  // A location is loading into the canvas (globe pick, search, pin, geolocation,
  // random): rise the cover panel over the outgoing page and arm the canvas to
  // hold its tile radiate-in until the panel finishes rising and reveals the
  // canvas, so it reads as "sheet rises up to reveal, then the tiles push out".
  const playSceneRevealRise = useCallback(() => {
    setSceneRising(true);
    setSceneRiseToken((token) => token + 1);
  }, []);

  const playSceneEntryCover = useCallback(() => {
    setSceneEntranceDelayMs(SHEET_SCENE_REVEAL_MS);
    playSceneRevealRise();
    playCover();
  }, [playCover, playSceneRevealRise]);

  // Rise the revealed soundscape assets. When a scene enters behind the cover
  // panel, the canvas (sound tiles, rings, listener) and the bottom control bar
  // are held one short step below their resting spot and then glide up as the
  // cover sweeps away, so the reveal and the assets settling read as one
  // continuous upward motion (the same feel as the sheet rises). The animation
  // is delayed to the reveal moment (SHEET_SCENE_REVEAL_MS) with no fill, so the
  // assets sit naturally until the cover fully covers them and the brief
  // downward offset it starts from is hidden behind the cover. Reduced motion
  // skips the rise entirely (the tiles also skip their radiate-in).
  useEffect(() => {
    if (sceneRiseToken === 0) return undefined;
    if (prefersReducedMotion()) {
      setSceneRising(false);
      return undefined;
    }
    const targets = [mainRef.current, bottomBarRef.current].filter(
      (el): el is HTMLElement => el !== null,
    );
    if (targets.length === 0) {
      setSceneRising(false);
      return undefined;
    }
    let cancelled = false;
    const animations = targets.map((el) =>
      el.animate(
        [
          { transform: 'translate3d(0, 44px, 0)' },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        {
          duration: 620,
          delay: SHEET_SCENE_REVEAL_MS,
          easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
          fill: 'none',
        },
      ),
    );
    // Keep the bottom bar's search pill tracking the rising bar until the rise
    // settles, then release it back to the resting anchor.
    void Promise.all(
      animations.map((animation) => animation.finished.catch(() => undefined)),
    ).then(() => {
      if (!cancelled) setSceneRising(false);
    });
    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
    };
  }, [sceneRiseToken]);

  const handleGlobeSelect = useCallback(
    (location: WorldLocation) => {
      void unlock();
      setWorkspaceGlobeOpening(false);
      playSceneEntryCover();
      if (location.custom) {
        setCustomGlobeLocation(location);
      }
      applyRegion(location.environmentId, location.regionId);
      // Picking a place while browsing from the landing is the entry gesture, so
      // it starts that location's soundscape (matching the search entry). A
      // mid-session pick keeps the transport untouched: beginSoundscapeTransition
      // leaves `playing` alone and addSource only starts sources when already
      // playing, so a paused user stays silent and a playing user keeps playing.
      if (!hasEntered) {
        setAutoPlayOnLoad(true);
      }
      setShowGlobe(false);
      // Keep the outgoing globe mounted so it stays visible and lifts + dims
      // beneath the rising cover panel; the incoming soundscape canvas is
      // revealed on top when the panel finishes rising. `onCovered` unmounts it.
      setGlobeExiting(true);
      // We have now entered a concrete location, so the landing-browse state is
      // spent and the globe close no longer returns to the landing.
      setBrowsingFromLanding(false);
      // Selecting from the globe is also an entry gesture, so it dismisses the
      // landing gate (a no-op once already inside the workspace).
      setHasEntered(true);
    },
    [applyRegion, hasEntered, playSceneEntryCover, unlock],
  );

  // Entry from the landing gate. Unlocking the AudioContext inside this click
  // handler (the user gesture) satisfies the browser autoplay policy, then
  // `applyRegion` + `autoPlayOnLoad` starts the chosen soundscape as we dismiss
  // the gate, the same path the globe uses to enter a place.
  const handleEnterLocation = useCallback(
    (location: WorldLocation) => {
      void unlock();
      playSceneEntryCover();
      // Keep the landing mounted and lifting beneath the rising cover panel even
      // though `hasEntered` flips true, so the old page stays and pushes up while
      // the soundscape rises on top; it unmounts once the panel has fully risen
      // (see `onCovered`).
      setLandingExiting(true);
      if (location.custom) {
        setCustomGlobeLocation(location);
      }
      applyRegion(location.environmentId, location.regionId);
      setAutoPlayOnLoad(true);
      setHasEntered(true);
    },
    [applyRegion, playSceneEntryCover, unlock],
  );

  // Entry via the Enter button or an empty-query Enter in the landing search:
  // open the full-screen world map DIRECTLY over the landing so the visitor
  // lands in the map of all soundscapes with no flash of the workspace beneath.
  // We deliberately do NOT leave the landing gate (`hasEntered` stays false) and
  // do NOT start a soundscape: the landing stays mounted behind the globe (so
  // the soundscape canvas is never revealed) and no scene plays, so there is
  // nothing to flash or hear. We still resume the AudioContext on this click so
  // the gesture satisfies the browser autoplay gate for when a place is picked.
  // Closing the globe (X) returns to the landing; picking a place enters it.
  const handleEnterExperience = useCallback(() => {
    void unlock();
    // Calm airy whoosh swells with the ~860ms sheet rise. Skip under reduced
    // motion so audio does not outlast the near-instant visual (~140ms).
    if (!prefersReducedMotion()) {
      void playOneShot(ENTER_WHOOSH_SRC, { volume: ENTER_WHOOSH_VOLUME });
    }
    // Approach A: the globe is naturally above the landing, so it rises as its
    // real self ON TOP of the landing (no cover panel). Lift the landing and keep
    // it mounted + visible beneath the rising globe so the two read as stacked
    // sheets; `onEntered` from the globe settles the landing back to rest once the
    // globe has fully arrived. It stays mounted (hasEntered false while browsing)
    // and simply returns to rest when the globe is later closed back to it.
    setLandingExiting(true);
    setBrowsingFromLanding(true);
    setShowGlobe(true);
  }, [playOneShot, unlock]);

  // Close handler for the full-screen globe. Opening always just shows it; the
  // interesting case is closing. When the globe was opened from the landing to
  // browse (and no place was picked), closing returns to the landing rather
  // than into an empty workspace. A normal in-session map close (already inside
  // a location) simply hides the globe and returns to that location.
  const handleGlobeOpenChange = useCallback((open: boolean) => {
    if (open) {
      // Opening the map: the globe rises as its real self (approach A) on top of
      // the workspace beneath it, so no cover panel is needed. When opening from
      // an already-entered soundscape, keep that workspace mounted and lifting so
      // the globe visibly pushes it upward like the other stacked-sheet moves.
      // This is not a location entry, so no radiate-in.
      const openingFromWorkspace = hasEntered && !browsingFromLanding;
      setWorkspaceGlobeOpening(openingFromWorkspace);
      setGlobeOverWorkspace(openingFromWorkspace);
      setShowGlobe(true);
      return;
    }
    // Closing the map: the outgoing globe lifts up (parallax) and stays visible
    // beneath the incoming page rising over it.
    setWorkspaceGlobeOpening(false);
    setShowGlobe(false);
    setGlobeExiting(true);
    if (browsingFromLanding) {
      // Returning home to the landing (map -> home): the landing gate is itself
      // a full-page opaque sheet, so it RISES up over the lifting globe with the
      // shared curved edge (a true stacked-sheet rise, no cover panel and no
      // cross-fade). Remount it (replay key) so it re-arms its entrance, and its
      // `onEntered` unmounts the globe once it has fully risen. hasEntered stays
      // false, so it renders and settles at rest.
      setBrowsingFromLanding(false);
      setLandingExiting(false);
      setLandingEntering(true);
      setLandingReplayKey((key) => key + 1);
    } else {
      // Returning to the workspace: the soundscape canvas is stacked BELOW the
      // globe and cannot be raised above it, so the shared cover panel rises up
      // over the lifting globe and reveals it. Reuse the existing scene-rise so
      // the canvas + bottom UI rise from below as the reveal lands, rather than
      // fading back in flat. The panel (z-index 500) sits above the globe page
      // (z-index 400); `onCovered` unmounts the globe once the panel has fully
      // risen.
      playSceneRevealRise();
      playCover();
    }
  }, [browsingFromLanding, hasEntered, playCover, playSceneRevealRise]);

  // The header wordmark doubles as a "home" control: always return to the
  // landing gate (enabling it if the DEV toggle had it off), with the outgoing
  // page pushing up in parallax while landing rises over it.
  const handleGoHome = useCallback(() => {
    setWorkspaceGlobeOpening(false);
    setGlobeOverWorkspace(false);
    if (showGlobe) setGlobeExiting(true);
    setShowGlobe(false);
    setDetailTarget(null);
    setDetailOriginRect(null);
    setAutoPlayOnLoad(false);
    pause();
    if (!landingEnabled) {
      setLandingEnabled(true);
      persistLandingGateEnabled(true);
    }
    // Landing is a full-page opaque sheet: it rises over the lifting outgoing
    // page (globe or workspace) with the shared curved edge.
    setBrowsingFromLanding(false);
    setLandingExiting(false);
    setHasEntered(false);
    setLandingEntering(true);
    setLandingReplayKey((key) => key + 1);
  }, [landingEnabled, pause, showGlobe]);

  // The incoming landing has finished rising home over the outgoing page, so
  // settle the rise (drop the raised stacking) and unmount the lifted globe
  // beneath it now that it is fully covered.
  const handleLandingEntered = useCallback(() => {
    setLandingEntering(false);
    setWorkspaceGlobeOpening(false);
    setGlobeOverWorkspace(false);
    setGlobeExiting(false);
  }, []);

  // Dev toggle (Landing switch): persist the preference and reflect it live.
  // Turning it on drops back to the landing gate, turning it off enters the
  // workspace straight away (the first-gesture unlock fallback still applies).
  const handleLandingEnabledChange = useCallback((enabled: boolean) => {
    setLandingEnabled(enabled);
    persistLandingGateEnabled(enabled);
    setHasEntered(!enabled);
  }, []);

  // Push the live entrance timings to the document root so the landing keyframes
  // pick them up (runs on mount for the saved/default config and on every edit).
  useEffect(() => {
    applyLandingEntranceAnimation(landingEntranceConfig);
  }, [landingEntranceConfig]);

  // Replay the landing entrance in place (dev tuner Test button): make sure the
  // gate is visible, settle any exit lift, then remount it via the replay key so
  // the whole choreographed entrance re-arms and plays again with no refresh.
  const handleReplayLandingEntrance = useCallback(() => {
    if (!landingEnabled) handleLandingEnabledChange(true);
    setLandingExiting(false);
    setHasEntered(false);
    setLandingReplayKey((key) => key + 1);
  }, [handleLandingEnabledChange, landingEnabled]);

  const handleGeoMatch = useCallback(
    (match: GeoMatchResult) => {
      playSceneEntryCover();
      setCustomGlobeLocation(
        createCustomWorldLocation({
          lat: match.lat,
          lng: match.lng,
          name: match.name,
          subtitle: match.subtitle,
          environmentId: match.environmentId,
          regionId: match.regionId,
        }),
      );
      applyRegion(match.environmentId, match.regionId);
      // Mid-session switch: respect the transport rather than forcing playback.
    },
    [applyRegion, playSceneEntryCover],
  );

  const handleRandomRegion = useCallback(
    (nextEnvironmentId: string, nextRegionId: string) => {
      setSceneEntranceDelayMs(0);
      setSceneRising(false);
      if (prefersReducedMotion() || activeSounds.length === 0) {
        pendingRandomRegionRef.current = null;
        applyRegion(nextEnvironmentId, nextRegionId);
        return;
      }
      randomizeTransitionSeqRef.current += 1;
      const token = randomizeTransitionSeqRef.current;
      pendingRandomRegionRef.current = {
        environmentId: nextEnvironmentId,
        regionId: nextRegionId,
        token,
      };
      setRandomizeTransitionToken(token);
      // Mid-session switch: respect the transport rather than forcing playback.
    },
    [activeSounds.length, applyRegion],
  );

  const handleRandomizeTransitionComplete = useCallback(
    (token: number) => {
      const pending = pendingRandomRegionRef.current;
      if (!pending || pending.token !== token) return;
      pendingRandomRegionRef.current = null;
      applyRegion(pending.environmentId, pending.regionId);
    },
    [applyRegion],
  );

  const handleLocationSearchChange = useCallback(
    (
      nextEnvironmentId: string,
      nextRegionId: string,
      customLocation?: WorldLocation,
    ) => {
      // A geocoded worldwide result carries a custom location so it drops a pin
      // on the globe at the searched coordinates; a curated soundscape clears
      // any existing custom pin.
      void unlock();
      playSceneEntryCover();
      setCustomGlobeLocation(customLocation ?? null);
      applyRegion(nextEnvironmentId, nextRegionId);
      // Only the landing search (before entering) is an entry gesture that
      // forces playback. Once inside the workspace a search is a mid-session
      // switch, so it respects the transport: the engine keeps playing if we
      // were playing and stays silent if the user has paused.
      if (!hasEntered) {
        setAutoPlayOnLoad(true);
        // Landing-origin entry: lift the landing and keep it beneath the rising
        // cover panel while the workspace is revealed on top.
        setLandingExiting(true);
      }
      // Searching is the alternate entry gesture, so it also leaves the gate.
      setHasEntered(true);
    },
    [applyRegion, hasEntered, playSceneEntryCover, unlock],
  );

  const handleReturnComplete = useCallback(() => {
    if (!returnFlight) return;
    removeSound(returnFlight.instanceId);
    setReturnFlight(null);
    setReturningId(null);
    setReturningSoundId(null);
  }, [removeSound, returnFlight]);

  const syncBottomBarTooltip = useCallback((target: EventTarget | null) => {
    setBottomBarTooltip(anchorFromTooltipTarget(target));
  }, []);

  const handleShare = useCallback(async () => {
    const scene = sceneFromAppState({
      environmentId,
      regionId,
      locationName: headerLocationLabel,
      customGlobeLocation,
      activeSounds,
    });
    if (!scene) return null;
    return buildSceneShareUrl(scene);
  }, [activeSounds, customGlobeLocation, environmentId, headerLocationLabel, regionId]);

  useEffect(() => {
    // Duck in-scene beds when opening the map from a location. Skip ducking
    // while browsing from the landing: there is no soundscape yet, and the
    // enter whoosh + globe ambient ride the unducked master bus.
    const duck = showGlobe && !browsingFromLanding ? GLOBE_DUCK_GAIN : 1;
    engine.setDuckingGain(duck);
    return () => {
      engine.setDuckingGain(1);
    };
  }, [browsingFromLanding, engine, showGlobe]);

  useEffect(() => {
    if (showGlobe) {
      setBottomBarTooltip(null);
      setLocationSearchOpen(false);
    } else if (wasGlobeOpenRef.current) {
      // Force all search/bottom-bar dependent transforms back to baseline
      // after the globe sheet closes, even if spotlight timers were mid-phase.
      setBottomBarTooltip(null);
      setLocationSearchOpen(false);
      setLocationSearchResetToken((token) => token + 1);
    }
    wasGlobeOpenRef.current = showGlobe;
  }, [showGlobe]);

  return (
    <SheetStack.Root className={sheetStack.root}>
      <SheetStack.Outlet
        className={sheetStack.outlet}
        stackingAnimation={appStackingAnimation}
        asChild
      >
        <div className={styles.app}>
      {(!hasEntered || landingExiting || landingEntering) && (
        <LandingGate
          key={landingReplayKey}
          onSelect={handleEnterLocation}
          fanConfig={fanConfig}
          onEnter={handleEnterExperience}
          searchOpen={landingSearchOpen}
          exiting={landingExiting}
          entering={landingEntering}
          onEntered={handleLandingEntered}
          search={
            <LocationSearchSpotlight
              appLocations={appLocations}
              worldLocations={worldLocations}
              environmentId={environmentId}
              regionId={regionId}
              onChange={handleLocationSearchChange}
              onOpenChange={setLandingSearchOpen}
              onEmptyEnter={handleEnterExperience}
              resetToken={locationSearchResetToken}
              idleLabel="Search or create your own"
              expandDirection="down"
              theme="light"
              backdrop={false}
              enlarged
              recenterOnExpand
              // Hide while browsing the globe, but keep the landing pill paired
              // with the outgoing sheet while the landing exits to a place.
              blocked={showGlobe && !landingEntering}
              riseWithGate={landingEntering || landingExiting}
            />
          }
        />
      )}

      {hasEntered && !isUnlocked && (
        <button type="button" className={styles.unlockBanner} onClick={() => void unlock()}>
          Tap to enable audio · press Play when you are ready
        </button>
      )}

      <div className={styles.topFabGroup}>
        <ThemeToggle />
        <AboutButton onClick={() => setShowProjectInfo(true)} />
      </div>

      <div className={styles.mobileTopLeft}>
        <MobileControlsMenu
          actions={
            hasEntered ? (
              <>
                <UseMyLocationButton onMatch={handleGeoMatch} />
                <RandomizeLocationButton
                  appLocations={appLocations}
                  worldLocations={worldLocations}
                  onPick={handleRandomRegion}
                />
                <MapButton onClick={() => handleGlobeOpenChange(true)} />
                <ShareButton onShare={handleShare} />
              </>
            ) : null
          }
          extras={
            <>
              <ThemeToggle />
              <AboutButton
                onClick={() => {
                  setShowProjectInfo(true);
                }}
              />
            </>
          }
        />
      </div>

      <header
        className={`${styles.header} ${showGlobe || globeExiting ? styles.headerAboveGlobe : ''}`}
      >
        <div className={styles.brand}>
          <h1 className={styles.title}>
            <button
              type="button"
              className={styles.brandHome}
              onClick={handleGoHome}
              aria-label="Saudade, go home"
            >
              Saudade
            </button>
          </h1>
        </div>
      </header>

      <main
        className={`${styles.main} ${
          (coverActive || landingEntering || workspaceGlobeOpening) && !globeExiting
            ? styles.pageExitLift
            : ''
        }`}
        ref={mainRef}
      >
        <section className={styles.workspace} aria-label="Soundscape">
          <div className={styles.dockOverlay}>
            <SoundPalette
              ref={paletteRef}
              sounds={librarySounds}
              dockDefaultIds={dockDefaultIds}
              activeSoundIds={activeSoundIds}
              returningSoundId={returningSoundId}
              draggingSoundId={soundDrag?.source === 'palette' ? soundDrag.sound.id : null}
              draggingActive={soundDrag?.source === 'palette' ? soundDrag.active : false}
              magnetDrag={dockMagnetDrag}
              regionArt={regionArt}
              onDragStart={handlePaletteDragStart}
              onAddClick={(originRect) => {
                setAddSoundOriginRect(snapshotOriginRect(originRect));
                setShowAddSounds(true);
              }}
            />
          </div>
          <SpatialCanvas
            canvasRef={canvasRef}
            activeSounds={activeSounds}
            soundMap={soundMap}
            selectedId={selectedId}
            returningId={returningId}
            detailExpandInstanceId={detailExpandInstanceId}
            onSelect={setSelectedId}
            onRemove={beginReturnToDock}
            onOpenDetail={handleOpenDetail}
            onMove={handlePhysicsMove}
            onSettle={updatePosition}
            onDragBegin={handleCanvasDragBegin}
            onDockDragHover={setDockMagnetDrag}
            dropHighlight={Boolean(soundDrag?.active)}
            dockHitTest={(x, y) => paletteRef.current?.hitTest(x, y) ?? false}
            regionArt={regionArt}
            ringVariant={ringVariant}
            isPlaying={isPlaying}
            entranceHoldMs={sceneEntranceDelayMs}
            randomizeTransitionToken={randomizeTransitionToken}
            onRandomizeTransitionComplete={handleRandomizeTransitionComplete}
          />
        </section>
      </main>

      <nav
        ref={bottomBarRef}
        className={`${styles.bottomBar} ${locationSearchOpen ? styles.bottomBarSearchOpen : ''} ${showGlobe && !globeOverWorkspace ? styles.bottomBarHidden : ''} ${(coverActive || landingEntering || workspaceGlobeOpening) && !globeExiting ? styles.pageExitLift : ''} ${detailTarget ? styles.bottomBarRecessed : ''}`}
        aria-label="Main controls"
        onPointerMove={(event) => syncBottomBarTooltip(event.target)}
        onPointerLeave={() => setBottomBarTooltip(null)}
      >
        {showWorkspaceChrome && (
          <div className={styles.bottomBarPlay}>
            <PlayCluster
              engine={engine}
              isPlaying={isPlaying}
              onToggle={() => void togglePlay()}
            />
          </div>
        )}
        <div className={styles.bottomBarRow}>
          {showWorkspaceChrome && (
            <div className={styles.leftActionGroup}>
              <UseMyLocationButton onMatch={handleGeoMatch} />
              <RandomizeLocationButton
                appLocations={appLocations}
                worldLocations={worldLocations}
                onPick={handleRandomRegion}
              />
            </div>
          )}
          {showWorkspaceChrome && (
            <LocationSearchSpotlight
              appLocations={appLocations}
              worldLocations={worldLocations}
              environmentId={environmentId}
              regionId={regionId}
              onChange={handleLocationSearchChange}
              onOpenChange={setLocationSearchOpen}
              resetToken={locationSearchResetToken}
              blocked={showGlobe}
              recessed={detailTarget !== null}
              riseWithBar={sceneRising}
            />
          )}
          {showWorkspaceChrome && (
            <div className={styles.rightActionGroup}>
              <MapButton onClick={() => handleGlobeOpenChange(true)} />
              <ShareButton onShare={handleShare} />
            </div>
          )}
        </div>
      </nav>
      <BottomBarMagnetTooltip anchor={bottomBarTooltip} />

      {soundDrag && (
        <FlyingSoundTile
          soundId={soundDrag.sound.id}
          name={displaySoundName(soundDrag.sound)}
          x={soundDrag.x}
          y={soundDrag.y}
          size={soundDrag.active ? CANVAS_TILE_SIZE : DOCK_BASE_SIZE}
          showLabel={false}
          regionArt={regionArt}
          elevated={soundDrag.source === 'palette'}
          overlayElevated={soundDrag.source === 'library'}
          pickedUp={soundDrag.source === 'library'}
          dragPhysics={soundDrag.active}
        />
      )}

      {returnFlight && (
        <FlyingSoundTile
          soundId={returnFlight.soundId}
          name={returnFlight.name}
          instanceId={returnFlight.instanceId}
          x={returnFlight.from.x}
          y={returnFlight.from.y}
          size={returnFlight.fromSize}
          animateTo={{
            x: returnFlight.to.x,
            y: returnFlight.to.y,
            size: DOCK_BASE_SIZE,
          }}
          onComplete={handleReturnComplete}
          regionArt={regionArt}
          elevated
        />
      )}
        </div>
      </SheetStack.Outlet>

      <SoundArtDetailSheet
        open={detailTarget !== null}
        onOpenChange={(open) => {
          if (!open) handleCloseDetail();
        }}
        originRect={detailOriginRect}
        target={detailTarget}
        onVolumeChange={handleDetailVolumeChange}
        regionArt={regionArt}
        onExpandExited={handleDetailExpandExited}
      />

      <GlobeMapSheet
        open={showGlobe}
        exiting={globeExiting}
        onEntered={() => {
          // The globe (approach-A incoming) has finished rising into place, so
          // settle the outgoing landing beneath it back to rest (it stays mounted
          // while browsing, now fully covered by the globe).
          setWorkspaceGlobeOpening(false);
          setLandingExiting(false);
        }}
        onOpenChange={handleGlobeOpenChange}
        locations={globeLocations}
        activeEnvironmentId={environmentId}
        activeRegionId={regionId}
        activeLocationId={customGlobeLocation?.id}
        onSelect={handleGlobeSelect}
      />

      <EnterTransition
        key={coverKey}
        active={coverActive}
        onCovered={() => {
          // The cover panel now fully covers the viewport: unmount the lifted
          // outgoing page(s) so the following cross-fade reveals the true
          // destination beneath, not the outgoing layer.
          setWorkspaceGlobeOpening(false);
          setGlobeOverWorkspace(false);
          setGlobeExiting(false);
          setLandingExiting(false);
        }}
        onDone={() => setCoverActive(false)}
      />

      <AddSoundSheet
        open={showAddSounds}
        onOpenChange={setShowAddSounds}
        originRect={addSoundOriginRect}
        sounds={librarySounds}
        activeSoundIds={activeSoundIds}
        regionArt={regionArt}
        migratoryBirds={region.migratoryBirds}
        defaultSeason={region.defaultSeason}
        draggingSoundId={soundDrag?.source === 'library' ? soundDrag.sound.id : null}
        dragActive={soundDrag?.source === 'library' ? soundDrag.active : false}
        onDragStart={handleLibraryDragStart}
      />

      <ProjectInfoSheet open={showProjectInfo} onOpenChange={setShowProjectInfo} />

      <SearchSpotlightAnimationTuner />
      <PlayingBarEdgeGradientTuner isPlaying={isPlaying} />
      <LandingFanTuner
        config={fanConfig}
        onChange={setFanConfig}
        landingEnabled={landingEnabled}
        onLandingEnabledChange={handleLandingEnabledChange}
      />
      <LandingEntranceTuner
        config={landingEntranceConfig}
        onChange={setLandingEntranceConfig}
        onReplay={handleReplayLandingEntrance}
      />
      <SoundTileDesignTuner regionArt={regionArt} sampleTarget={detailTarget} />
    </SheetStack.Root>
  );
}
