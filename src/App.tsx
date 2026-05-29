import { useCallback, useEffect, useMemo, useState } from 'react';
import { AmbientBed } from './components/AmbientBed';
import { EnvironmentPicker } from './components/EnvironmentPicker';
import { PlayBar } from './components/PlayBar';
import { RegionPicker } from './components/RegionPicker';
import { SoundPalette } from './components/SoundPalette';
import { SpatialCanvas } from './components/SpatialCanvas';
import { environments, getRegion, getSoundDef } from './data/environments';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useSpatialSources } from './hooks/useSpatialSources';
import { Attributions } from './pages/Attributions';
import styles from './App.module.css';

type View = 'mixer' | 'attributions';

export default function App() {
  const [view, setView] = useState<View>('mixer');
  const [environmentId, setEnvironmentId] = useState(environments[0].id);
  const [regionId, setRegionId] = useState(environments[0].regions[0].id);

  const { engine, preloadSounds, play, togglePlay, isPlaying, isUnlocked } = useAudioEngine();
  const {
    activeSounds,
    selectedId,
    setSelectedId,
    loadDefaults,
    addSound,
    removeSound,
    updatePosition,
    updateVolume,
    updateVolumeBySoundId,
    nudgeSelected,
    maxReached,
  } = useSpatialSources();

  const environment = useMemo(
    () => environments.find((item) => item.id === environmentId)!,
    [environmentId],
  );
  const region = useMemo(
    () => getRegion(environmentId, regionId)!,
    [environmentId, regionId],
  );

  const bedSounds = useMemo(() => region.bedSounds ?? [], [region]);

  const soundMap = useMemo(
    () => new Map(region.sounds.map((sound) => [sound.id, sound])),
    [region.sounds],
  );

  useEffect(() => {
    void preloadSounds(region.sounds);
  }, [preloadSounds, region.sounds]);

  useEffect(() => {
    loadDefaults(bedSounds);
    for (const instanceId of engine.getSourceIds()) {
      engine.removeSource(instanceId);
    }
  }, [bedSounds, engine, environmentId, loadDefaults, regionId]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await preloadSounds(region.sounds);
      if (!cancelled) {
        await play();
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [environmentId, regionId, play, preloadSounds, region.sounds]);

  useEffect(() => {
    if (isUnlocked) return;

    const unlock = () => {
      void play();
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [isUnlocked, play]);

  useEffect(() => {
    const sync = async () => {
      const activeIds = new Set(activeSounds.map((item) => item.instanceId));

      for (const instanceId of engine.getSourceIds()) {
        if (!activeIds.has(instanceId)) {
          engine.removeSource(instanceId);
        }
      }

      for (const item of activeSounds) {
        const sound = getSoundDef(environmentId, regionId, item.soundId);
        if (!sound) continue;

        if (!engine.hasSource(item.instanceId)) {
          await engine.addSource(item.instanceId, sound, item.position, item.volume);
        } else {
          engine.updatePosition(item.instanceId, item.position);
          engine.updateVolume(item.instanceId, item.volume);
        }
      }
    };

    void sync();
  }, [activeSounds, environmentId, regionId, engine]);

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
        case 'Delete':
          event.preventDefault();
          removeSound(selectedId);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nudgeSelected, removeSound, selectedId]);

  const handleEnvironmentChange = useCallback((nextEnvironmentId: string) => {
    const nextEnvironment = environments.find((item) => item.id === nextEnvironmentId);
    if (!nextEnvironment) return;

    setEnvironmentId(nextEnvironmentId);
    const matchingRegion = nextEnvironment.regions.find((item) => item.id === regionId);
    setRegionId(matchingRegion?.id ?? nextEnvironment.regions[0].id);
  }, [regionId]);

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

  const handleBedVolumeChange = useCallback(
    (soundId: string, volume: number) => {
      updateVolumeBySoundId(soundId, volume);
      const instance = activeSounds.find((item) => item.soundId === soundId);
      if (instance && engine.hasSource(instance.instanceId)) {
        engine.updateVolume(instance.instanceId, volume);
      }
    },
    [activeSounds, engine, updateVolumeBySoundId],
  );

  if (view === 'attributions') {
    return (
      <div className={styles.app}>
        <header className={styles.header}>
          <button type="button" className={styles.linkButton} onClick={() => setView('mixer')}>
            Back to mixer
          </button>
        </header>
        <Attributions />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      {!isUnlocked && (
        <button type="button" className={styles.unlockBanner} onClick={() => void play()}>
          Tap anywhere to start audio
        </button>
      )}

      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Spatial Audio</h1>
          <p className={styles.subtitle}>Build a soundscape, drag it through space</p>
        </div>
        <div className={styles.controls}>
          <EnvironmentPicker
            environments={environments}
            value={environmentId}
            onChange={handleEnvironmentChange}
          />
          <RegionPicker
            regions={environment.regions}
            value={regionId}
            onChange={setRegionId}
          />
          <PlayBar isPlaying={isPlaying} onToggle={() => void togglePlay()} />
        </div>
      </header>

      <main className={styles.main}>
        <SoundPalette
          sounds={region.sounds}
          activeSoundIds={activeSounds.map((item) => item.soundId)}
          maxReached={maxReached}
          onAdd={addSound}
        />
        <SpatialCanvas
          activeSounds={activeSounds}
          soundMap={soundMap}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={removeSound}
          onMove={handlePhysicsMove}
          onSettle={updatePosition}
          onVolumeChange={handleVolumeChange}
        />
      </main>

      <AmbientBed
        bedSounds={bedSounds}
        activeSounds={activeSounds}
        soundMap={soundMap}
        onVolumeChange={handleBedVolumeChange}
      />

      <footer className={styles.footer}>
        <button type="button" className={styles.linkButton} onClick={() => setView('attributions')}>
          Audio attributions
        </button>
      </footer>
    </div>
  );
}
