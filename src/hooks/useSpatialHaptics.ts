import { useMemo } from 'react';
import type { SpatialPoint } from '../data/types';
import {
  createSpatialDragHaptics,
  playHaptic,
  playSpatialDropHaptic,
  playVolumeHaptic,
  type HapticPattern,
} from '../utils/haptics';

export function useSpatialHaptics() {
  const dragHaptics = useMemo(() => createSpatialDragHaptics(), []);

  return useMemo(
    () => ({
      pattern(pattern: HapticPattern) {
        playHaptic(pattern);
      },
      spatialDrop(position: SpatialPoint) {
        playSpatialDropHaptic(position);
      },
      volume(volume: number) {
        playVolumeHaptic(volume);
      },
      dragStart(instanceId: string, position: SpatialPoint) {
        dragHaptics.start(instanceId, position);
      },
      dragMove(instanceId: string, position: SpatialPoint) {
        dragHaptics.move(instanceId, position);
      },
      dragEnd(instanceId: string) {
        dragHaptics.end(instanceId);
      },
    }),
    [dragHaptics],
  );
}
