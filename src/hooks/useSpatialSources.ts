import { useCallback, useState } from 'react';
import { defaultSpawnPosition } from '../audio/spatialMath';
import { createDefaultActiveSounds, isDefaultInstance, MAX_ACTIVE_SOUNDS } from '../data/environments';
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

  const addSound = useCallback((sound: SoundDef) => {
    setActiveSounds((current) => {
      if (current.length >= MAX_ACTIVE_SOUNDS) return current;
      if (current.some((item) => item.soundId === sound.id)) return current;

      const instanceId = createInstanceId(sound.id);
      const position = defaultSpawnPosition(current.length, MAX_ACTIVE_SOUNDS);
      setSelectedId(instanceId);
      return [...current, { instanceId, soundId: sound.id, position, volume: 1 }];
    });
  }, []);

  const removeSound = useCallback((instanceId: string) => {
    if (isDefaultInstance(instanceId)) return;

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
    addSound,
    removeSound,
    updatePosition,
    updateVolume,
    updateVolumeBySoundId,
    nudgeSelected,
    maxReached: activeSounds.length >= MAX_ACTIVE_SOUNDS,
  };
}
