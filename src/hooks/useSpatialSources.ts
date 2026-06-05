import { useCallback, useState } from 'react';
import { defaultSpawnPosition } from '../audio/spatialMath';
import { createDefaultActiveSounds } from '../data/environments';
import type { ActiveSound, BedSound, SoundDef, SpatialPoint } from '../data/types';

function createInstanceId(soundId: string) {
  return `${soundId}-${crypto.randomUUID()}`;
}

export function useSpatialSources() {
  const [activeSounds, setActiveSounds] = useState<ActiveSound[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadDefaults = useCallback((bedSounds: BedSound[]) => {
    setActiveSounds(createDefaultActiveSounds(bedSounds));
    setSelectedId(null);
  }, []);

  const loadScene = useCallback(
    (items: Array<{ soundId: string; position: SpatialPoint; volume: number }>) => {
      setActiveSounds(
        items.map((item) => ({
          instanceId: createInstanceId(item.soundId),
          soundId: item.soundId,
          position: item.position,
          volume: Math.max(0, Math.min(1, item.volume)),
        })),
      );
      setSelectedId(null);
    },
    [],
  );

  const addSound = useCallback((sound: SoundDef, position?: SpatialPoint) => {
    setActiveSounds((current) => {
      if (current.some((item) => item.soundId === sound.id)) return current;

      const instanceId = createInstanceId(sound.id);
      const ringTotal = Math.max(current.length + 1, 6);
      const spawn = position ?? defaultSpawnPosition(current.length, ringTotal);
      setSelectedId(instanceId);
      return [...current, { instanceId, soundId: sound.id, position: spawn, volume: 1 }];
    });
  }, []);

  const removeSound = useCallback((instanceId: string) => {
    setActiveSounds((current) => current.filter((item) => item.instanceId !== instanceId));
    setSelectedId((current) => (current === instanceId ? null : current));
  }, []);

  const updatePosition = useCallback((instanceId: string, position: SpatialPoint) => {
    setActiveSounds((current) =>
      current.map((item) =>
        item.instanceId === instanceId ? { ...item, position } : item,
      ),
    );
  }, []);

  const updateVolume = useCallback((instanceId: string, volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setActiveSounds((current) =>
      current.map((item) =>
        item.instanceId === instanceId ? { ...item, volume: clamped } : item,
      ),
    );
  }, []);

  const updateVolumeBySoundId = useCallback((soundId: string, volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setActiveSounds((current) =>
      current.map((item) =>
        item.soundId === soundId ? { ...item, volume: clamped } : item,
      ),
    );
  }, []);

  const nudgeSelected = useCallback((dx: number, dy: number) => {
    if (!selectedId) return;
    setActiveSounds((current) =>
      current.map((item) => {
        if (item.instanceId !== selectedId) return item;
        return {
          ...item,
          position: {
            x: Math.max(-1, Math.min(1, item.position.x + dx)),
            y: Math.max(0.05, Math.min(1, item.position.y + dy)),
          },
        };
      }),
    );
  }, [selectedId]);

  return {
    activeSounds,
    selectedId,
    setSelectedId,
    loadDefaults,
    loadScene,
    addSound,
    removeSound,
    updatePosition,
    updateVolume,
    updateVolumeBySoundId,
    nudgeSelected,
  };
}
