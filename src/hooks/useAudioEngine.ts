import { useCallback, useEffect, useMemo, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import type { SoundDef } from '../data/types';

export function useAudioEngine() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIsUnlocked(audioEngine.isUnlocked);
      setIsPlaying(audioEngine.isPlaying);
    }, 200);
    return () => window.clearInterval(interval);
  }, []);

  const preloadSounds = useCallback(async (sounds: SoundDef[]) => {
    await audioEngine.preloadSounds(sounds);
  }, []);

  const play = useCallback(async () => {
    await audioEngine.play();
    setIsPlaying(true);
    setIsUnlocked(true);
  }, []);

  const pause = useCallback(() => {
    audioEngine.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (audioEngine.isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [pause, play]);

  return useMemo(
    () => ({
      isPlaying,
      isUnlocked,
      preloadSounds,
      play,
      pause,
      togglePlay,
      engine: audioEngine,
    }),
    [isPlaying, isUnlocked, preloadSounds, play, pause, togglePlay],
  );
}
