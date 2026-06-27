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
import {
  CANVAS_TILE_SIZE,
  DOCK_BASE_SIZE,
  DRAG_THRESHOLD,
} from './components/soundPaletteLayout';
import { SoundPalette, type SoundPaletteHandle } from './components/SoundPalette';
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
import { AboutButton } from './components/AboutButton';
import { ThemeToggle } from './components/ThemeToggle';
import { ProjectInfoSheet } from './components/ProjectInfoSheet';
import { appStackingAnimation } from './components/sheetDepth';
import sheetStack from './components/sheetStack.module.css';
import { worldLocations, createCustomWorldLocation, type WorldLocation } from './data/worldLocations';
import type { SoundDef, SpatialPoint } from './data/types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useSpatialSources } from './hooks/useSpatialSources';
import { buildSceneShareUrl, sceneFromAppState } from './utils/sceneShare';
import { randomizeSceneSounds } from './utils/randomizeSceneSounds';
import { regionSeed, selectSceneVariants } from './utils/soundscapeSelection';
import { enrichSounds } from './utils/soundTypeInference';
import { defaultSpawnVolumeForSound } from './utils/defaultSoundVolume';
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
  to: { x: number; y: number };
};

export default function App() {
  const GLOBE_DUCK_GAIN = 0.1;
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [detailOriginRect, setDetailOriginRect] = useState<OriginRectSnapshot | null>(null);
  const [dockDefaultIds, setDockDefaultIds] = useState<string[]>([]);
  const [environmentId, setEnvironmentId] = useState(environments[0].id);
  const [regionId, setRegionId] = useState(environments[0].regions[0].id);
  const [shuffleSalt, setShuffleSalt] = useState(0);
  const [soundDrag, setSoundDrag] = useState<SoundDrag | null>(null);
  const [returnFlight, setReturnFlight] = useState<ReturnFlight | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [showGlobe, setShowGlobe] = useState(false);
  const [customGlobeLocation, setCustomGlobeLocation] = useState<WorldLocation | null>(null);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [showAddSounds, setShowAddSounds] = useState(false);
  const [addSoundOriginRect, setAddSoundOriginRect] = useState<OriginRectSnapshot | null>(null);
  const [autoPlayOnLoad, setAutoPlayOnLoad] = useState(false);
  const ringVariant: RadarRingVariant = 1;
  const [bottomBarTooltip, setBottomBarTooltip] = useState<BottomBarTooltipAnchor | null>(null);
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [locationSearchResetToken, setLocationSearchResetToken] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<SoundPaletteHandle>(null);
  const wasGlobeOpenRef = useRef(showGlobe);
  const soundDragRef = useRef<SoundDrag | null>(null);
  // Bumped whenever the drag preview is torn down, so an in-flight (awaited)
  // updateDragPreview that resolves afterwards can detect it lost the race and
  // not leave an orphaned, never-cleaned-up preview source playing.
  const dragPreviewGenRef = useRef(0);

  const { engine, unlock, play, togglePlay, isPlaying, isUnlocked } = useAudioEngine();
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
      const { name, subtitle } = customGlobeLocation;
      return subtitle ? `${name}, ${subtitle}` : name;
    }
    return region.name;
  }, [customGlobeLocation, environmentId, regionId, region.name]);

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
      for (const instanceId of engine.getSourceIds()) {
        engine.removeSource(instanceId);
      }
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
    for (const instanceId of engine.getSourceIds()) {
      engine.removeSource(instanceId);
    }
  }, [engine, shuffleSalt]);

  useEffect(() => {
    let cancelled = false;

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
        await play();
        if (cancelled) return;
        setAutoPlayOnLoad(false);
      }
    };

    void sync();
    return () => {
      cancelled = true;
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
    (instanceId: string, iconRect: DOMRect) => {
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

      // The dock only guarantees slots for `dockDefaultIds`, then backfills the
      // rest from the catalogue. A tile that was a backfill (or was added from
      // the library) is not a default, so when it returns a different backfill
      // has already taken its slot and it never reappears. Pin the returned
      // sound to the front of the dock defaults so it is always shown again.
      const nextDockDefaultIds = dockDefaultIds.includes(item.soundId)
        ? dockDefaultIds
        : [item.soundId, ...dockDefaultIds];

      const nextActiveIds = activeSounds
        .filter((entry) => entry.instanceId !== instanceId)
        .map((entry) => entry.soundId);
      const target = paletteRef.current?.getSlotCenter(
        item.soundId,
        nextActiveIds,
        nextDockDefaultIds,
      );

      if (nextDockDefaultIds !== dockDefaultIds) {
        setDockDefaultIds(nextDockDefaultIds);
      }

      if (!target) {
        removeSound(instanceId);
        return;
      }

      setReturningId(instanceId);
      setReturnFlight({
        instanceId,
        soundId: item.soundId,
        name: sound.name,
        from: {
          x: iconRect.left + iconRect.width / 2,
          y: iconRect.top + iconRect.height / 2,
        },
        to: target,
      });
    },
    [activeSounds, detailTarget, dockDefaultIds, removeSound, selectedId, setSelectedId, soundMap],
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
      setDetailTarget({
        instanceId,
        soundId: item.soundId,
        name: sound?.name ?? item.soundId,
        volume: item.volume,
      });
    },
    [activeSounds, soundMap],
  );

  const handleCloseDetail = useCallback(() => {
    setDetailTarget(null);
    setDetailOriginRect(null);
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

  const handleGlobeSelect = useCallback(
    (location: WorldLocation) => {
      if (location.custom) {
        setCustomGlobeLocation(location);
      }
      applyRegion(location.environmentId, location.regionId);
      setAutoPlayOnLoad(true);
      setShowGlobe(false);
    },
    [applyRegion],
  );

  const handleGeoMatch = useCallback(
    (match: GeoMatchResult) => {
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
      setAutoPlayOnLoad(true);
    },
    [applyRegion],
  );

  const handleRandomRegion = useCallback(
    (nextEnvironmentId: string, nextRegionId: string) => {
      applyRegion(nextEnvironmentId, nextRegionId);
      setAutoPlayOnLoad(true);
    },
    [applyRegion],
  );

  const handleLocationSearchChange = useCallback(
    (nextEnvironmentId: string, nextRegionId: string) => {
      setCustomGlobeLocation(null);
      applyRegion(nextEnvironmentId, nextRegionId);
      setAutoPlayOnLoad(true);
    },
    [applyRegion],
  );

  const handleReturnComplete = useCallback(() => {
    if (!returnFlight) return;
    removeSound(returnFlight.instanceId);
    setReturnFlight(null);
    setReturningId(null);
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

  // About / Add Sound keep the iOS-style scale-down + blur of the app layer.
  const scaleDownActive = showProjectInfo || showAddSounds;
  // The sound tile detail modal only blurs the background (no downscale) so
  // tapping a tile never shifts its position.
  const blurOnlyActive = detailTarget !== null && !scaleDownActive;
  const scaleBlurActive = scaleDownActive || blurOnlyActive;

  useEffect(() => {
    engine.setDuckingGain(showGlobe ? GLOBE_DUCK_GAIN : 1);
    return () => {
      engine.setDuckingGain(1);
    };
  }, [engine, showGlobe]);

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
        className={`${sheetStack.outlet} ${
          scaleDownActive
            ? sheetStack.outletScaleBlur
            : blurOnlyActive
              ? sheetStack.outletBlurOnly
              : ''
        }`}
        stackingAnimation={appStackingAnimation}
        asChild
      >
        <div className={styles.app} inert={scaleBlurActive || undefined}>
      {!isUnlocked && (
        <button type="button" className={styles.unlockBanner} onClick={() => void unlock()}>
          Tap to enable audio · press Play when you are ready
        </button>
      )}

      <div className={styles.topFabGroup}>
        <ThemeToggle />
        <AboutButton onClick={() => setShowProjectInfo(true)} />
      </div>

      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Saudade</h1>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.workspace} aria-label="Soundscape">
          <div className={styles.dockOverlay}>
            <SoundPalette
              ref={paletteRef}
              sounds={librarySounds}
              dockDefaultIds={dockDefaultIds}
              activeSoundIds={activeSoundIds}
              draggingSoundId={soundDrag?.source === 'palette' ? soundDrag.sound.id : null}
              draggingActive={soundDrag?.source === 'palette' ? soundDrag.active : false}
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
            onSelect={setSelectedId}
            onRemove={beginReturnToDock}
            onOpenDetail={handleOpenDetail}
            onMove={handlePhysicsMove}
            onSettle={updatePosition}
            onDragBegin={handleCanvasDragBegin}
            dropHighlight={Boolean(soundDrag?.active)}
            regionArt={regionArt}
            ringVariant={ringVariant}
            isPlaying={isPlaying}
          />
        </section>
      </main>

      <nav
        className={`${styles.bottomBar} ${locationSearchOpen ? styles.bottomBarSearchOpen : ''} ${showGlobe || scaleBlurActive ? styles.bottomBarHidden : ''}`}
        aria-label="Main controls"
        onPointerMove={(event) => syncBottomBarTooltip(event.target)}
        onPointerLeave={() => setBottomBarTooltip(null)}
      >
        <div className={styles.bottomBarPlay}>
          <PlayCluster
            engine={engine}
            isPlaying={isPlaying}
            onToggle={() => void togglePlay()}
          />
        </div>
        <div className={styles.bottomBarRow}>
          <div className={styles.leftActionGroup}>
            <UseMyLocationButton onMatch={handleGeoMatch} />
            <RandomizeLocationButton
              appLocations={appLocations}
              worldLocations={worldLocations}
              onPick={handleRandomRegion}
            />
          </div>
          <LocationSearchSpotlight
            appLocations={appLocations}
            worldLocations={worldLocations}
            environmentId={environmentId}
            regionId={regionId}
            onChange={handleLocationSearchChange}
            onOpenChange={setLocationSearchOpen}
            resetToken={locationSearchResetToken}
            blocked={showGlobe || scaleBlurActive}
          />
          <div className={styles.rightActionGroup}>
            <MapButton onClick={() => setShowGlobe(true)} />
            <ShareButton onShare={handleShare} />
          </div>
        </div>
      </nav>
      <BottomBarMagnetTooltip anchor={bottomBarTooltip} />

      {soundDrag && (
        <FlyingSoundTile
          soundId={soundDrag.sound.id}
          name={soundDrag.sound.name}
          x={soundDrag.x}
          y={soundDrag.y}
          size={soundDrag.active ? CANVAS_TILE_SIZE : DOCK_BASE_SIZE}
          showLabel={false}
          regionArt={regionArt}
          elevated
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
          size={CANVAS_TILE_SIZE}
          animateTo={{
            x: returnFlight.to.x,
            y: returnFlight.to.y,
            size: DOCK_BASE_SIZE,
          }}
          onComplete={handleReturnComplete}
          regionArt={regionArt}
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
      />

      <GlobeMapSheet
        open={showGlobe}
        onOpenChange={setShowGlobe}
        locations={globeLocations}
        activeEnvironmentId={environmentId}
        activeRegionId={regionId}
        activeLocationId={customGlobeLocation?.id}
        onSelect={handleGlobeSelect}
      />

      <AddSoundSheet
        open={showAddSounds}
        onOpenChange={setShowAddSounds}
        originRect={addSoundOriginRect}
        sounds={librarySounds}
        activeSoundIds={activeSoundIds}
        regionArt={regionArt}
        regionName={region.name}
        migratoryBirds={region.migratoryBirds}
        defaultSeason={region.defaultSeason}
        draggingSoundId={soundDrag?.source === 'library' ? soundDrag.sound.id : null}
        dragActive={soundDrag?.source === 'library' ? soundDrag.active : false}
        onDragStart={handleLibraryDragStart}
      />

      <ProjectInfoSheet open={showProjectInfo} onOpenChange={setShowProjectInfo} />

      <SearchSpotlightAnimationTuner />
      <PlayingBarEdgeGradientTuner isPlaying={isPlaying} />
    </SheetStack.Root>
  );
}
