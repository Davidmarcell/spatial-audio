import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SheetStack } from '@silk-hq/components';
import { canvasToNormalized } from './audio/spatialMath';
import { LocationSearchSpotlight } from './components/LocationSearchSpotlight';
import { UseMyLocationButton } from './components/UseMyLocationButton';
import { RandomizeLocationButton } from './components/RandomizeLocationButton';
import { InfoButton } from './components/InfoButton';
import {
  anchorFromTooltipTarget,
  BottomBarMagnetTooltip,
  type BottomBarTooltipAnchor,
} from './components/BottomBarMagnetTooltip';
import { MapButton } from './components/MapButton';
import { FlyingSoundTile } from './components/FlyingSoundTile';
import { PlayBar } from './components/PlayBar';
import { SoundArtDetailSheet, type DetailTarget } from './components/SoundArtDetailSheet';
import {
  CANVAS_TILE_SIZE,
  DOCK_BASE_SIZE,
  DRAG_THRESHOLD,
} from './components/soundPaletteLayout';
import { SoundPalette, type SoundPaletteHandle } from './components/SoundPalette';
import { SpatialCanvas, type RadarRingVariant } from './components/SpatialCanvas';
import { appLocations, environments, getRegion, getSoundDef } from './data/environments';
import { GlobeMapSheet } from './components/GlobeMapSheet';
import { AttributionsSheet } from './components/AttributionsSheet';
import { appStackingAnimation } from './components/sheetDepth';
import sheetStack from './components/sheetStack.module.css';
import { worldLocations, type WorldLocation } from './data/worldLocations';
import type { SoundDef } from './data/types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useSpatialSources } from './hooks/useSpatialSources';
import styles from './App.module.css';

type PaletteDrag = {
  sound: SoundDef;
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  active: boolean;
};

type ReturnFlight = {
  instanceId: string;
  soundId: string;
  name: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export default function App() {
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [environmentId, setEnvironmentId] = useState(environments[0].id);
  const [regionId, setRegionId] = useState(environments[0].regions[0].id);
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);
  const [returnFlight, setReturnFlight] = useState<ReturnFlight | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [showGlobe, setShowGlobe] = useState(false);
  const [customGlobeLocation, setCustomGlobeLocation] = useState<WorldLocation | null>(null);
  const [showAttributions, setShowAttributions] = useState(false);
  const [autoPlayOnLoad, setAutoPlayOnLoad] = useState(false);
  const [ringVariant, setRingVariant] = useState<RadarRingVariant>(1);
  const [bottomBarTooltip, setBottomBarTooltip] = useState<BottomBarTooltipAnchor | null>(null);
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<SoundPaletteHandle>(null);

  const { engine, preloadSounds, unlock, play, togglePlay, isPlaying, isUnlocked } = useAudioEngine();
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

  const bedSounds = useMemo(() => region.bedSounds ?? [], [region]);

  const soundMap = useMemo(
    () => new Map(region.sounds.map((sound) => [sound.id, sound])),
    [region.sounds],
  );

  const regionArt = useMemo(
    () => ({
      id: regionId,
      soundIds: region.sounds.map((sound) => sound.id),
    }),
    [regionId, region.sounds],
  );

  const activeSoundIds = useMemo(
    () => activeSounds.map((item) => item.soundId),
    [activeSounds],
  );

  useEffect(() => {
    void preloadSounds(region.sounds);
  }, [preloadSounds, region.sounds]);

  const applyRegion = useCallback(
    (nextEnvironmentId: string, nextRegionId: string) => {
      const nextRegion = getRegion(nextEnvironmentId, nextRegionId);
      if (!nextRegion) return;

      setEnvironmentId(nextEnvironmentId);
      setRegionId(nextRegionId);
      loadDefaults(nextRegion.bedSounds ?? []);
      for (const instanceId of engine.getSourceIds()) {
        engine.removeSource(instanceId);
      }
      setDetailTarget(null);
    },
    [engine, loadDefaults],
  );

  useEffect(() => {
    loadDefaults(bedSounds);
    // Initial bed sounds only; region switches call applyRegion.
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

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const activeIds = new Set(activeSounds.map((item) => item.instanceId));

      for (const instanceId of engine.getSourceIds()) {
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
          await engine.addSource(item.instanceId, sound, item.position, item.volume);
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
  }, [activeSounds, autoPlayOnLoad, environmentId, play, regionId, engine, returningId, unlock]);

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

      const nextActiveIds = activeSounds
        .filter((entry) => entry.instanceId !== instanceId)
        .map((entry) => entry.soundId);
      const target = paletteRef.current?.getSlotCenter(item.soundId, nextActiveIds);

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
    [activeSounds, detailTarget, removeSound, selectedId, setSelectedId, soundMap],
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
    if (!paletteDrag) return;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== paletteDrag.pointerId) return;

      const distance = Math.hypot(
        event.clientX - paletteDrag.startX,
        event.clientY - paletteDrag.startY,
      );

      setPaletteDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              active: current.active || distance > DRAG_THRESHOLD,
            }
          : current,
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== paletteDrag.pointerId) return;

      if (paletteDrag.active) {
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
            addSound(paletteDrag.sound, position);
          }
        }
      }

      setPaletteDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [addSound, paletteDrag]);

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
    (instanceId: string) => {
      const item = activeSounds.find((entry) => entry.instanceId === instanceId);
      if (!item) return;
      const sound = soundMap.get(item.soundId);
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
      setPaletteDrag({
        sound,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
      });
    },
    [],
  );

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
    (nextEnvironmentId: string, nextRegionId: string) => {
      applyRegion(nextEnvironmentId, nextRegionId);
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

  const handleReturnComplete = useCallback(() => {
    if (!returnFlight) return;
    removeSound(returnFlight.instanceId);
    setReturnFlight(null);
    setReturningId(null);
  }, [removeSound, returnFlight]);

  const syncBottomBarTooltip = useCallback((target: EventTarget | null) => {
    setBottomBarTooltip(anchorFromTooltipTarget(target));
  }, []);

  return (
    <SheetStack.Root className={sheetStack.root}>
      <SheetStack.Outlet
        className={sheetStack.outlet}
        stackingAnimation={appStackingAnimation}
        asChild
      >
        <div className={styles.app}>
      {!isUnlocked && (
        <button type="button" className={styles.unlockBanner} onClick={() => void unlock()}>
          Tap to enable audio · press Play when you are ready
        </button>
      )}

      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Spatial Audio</h1>
          <p className={styles.subtitle}>{headerLocationLabel} · drag sounds through space</p>
          <div className={styles.ringPicker} aria-label="Radar ring animation variant">
            {([1, 2, 3, 4] as const).map((variant) => (
              <button
                key={variant}
                type="button"
                className={`${styles.ringPickerBtn} ${ringVariant === variant ? styles.ringPickerBtnActive : ''}`}
                aria-pressed={ringVariant === variant}
                onClick={() => setRingVariant(variant)}
              >
                {variant}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section
          className={`${styles.workspace} ${detailTarget ? styles.workspaceDetailOpen : ''}`}
          aria-label="Soundscape"
        >
          <div className={styles.dockOverlay}>
            <SoundPalette
              ref={paletteRef}
              sounds={region.sounds}
              activeSoundIds={activeSoundIds}
              draggingSoundId={paletteDrag?.sound.id ?? null}
              draggingActive={paletteDrag?.active ?? false}
              regionArt={regionArt}
              onDragStart={handlePaletteDragStart}
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
            dropHighlight={Boolean(paletteDrag?.active)}
            regionArt={regionArt}
            ringVariant={ringVariant}
          />
        </section>
      </main>

      <nav
        className={`${styles.bottomBar} ${locationSearchOpen ? styles.bottomBarSearchOpen : ''}`}
        aria-label="Main controls"
        onPointerMove={(event) => syncBottomBarTooltip(event.target)}
        onPointerLeave={() => setBottomBarTooltip(null)}
      >
        <div className={styles.locationGroup}>
          <UseMyLocationButton locations={worldLocations} onMatch={handleGeoMatch} />
          <RandomizeLocationButton
            appLocations={appLocations}
            worldLocations={worldLocations}
            onPick={handleRandomRegion}
          />
          <LocationSearchSpotlight
            appLocations={appLocations}
            worldLocations={worldLocations}
            environmentId={environmentId}
            regionId={regionId}
            onChange={applyRegion}
            onOpenChange={setLocationSearchOpen}
          />
        </div>
        <MapButton onClick={() => setShowGlobe(true)} />
        <PlayBar isPlaying={isPlaying} onToggle={() => void togglePlay()} />
      </nav>
      <BottomBarMagnetTooltip anchor={bottomBarTooltip} />

      <InfoButton
        className={styles.attributionsFab}
        onClick={() => setShowAttributions(true)}
        onPointerEnter={(event) => syncBottomBarTooltip(event.currentTarget)}
        onPointerLeave={() => setBottomBarTooltip(null)}
        onFocus={(event) => syncBottomBarTooltip(event.currentTarget)}
        onBlur={() => setBottomBarTooltip(null)}
      />

      {paletteDrag && (
        <FlyingSoundTile
          soundId={paletteDrag.sound.id}
          name={paletteDrag.sound.name}
          x={paletteDrag.x}
          y={paletteDrag.y}
          size={paletteDrag.active ? CANVAS_TILE_SIZE : DOCK_BASE_SIZE}
          showLabel={false}
          regionArt={regionArt}
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
        target={detailTarget}
        sound={detailTarget ? soundMap.get(detailTarget.soundId) : undefined}
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

      <AttributionsSheet open={showAttributions} onOpenChange={setShowAttributions} />
    </SheetStack.Root>
  );
}
