import type { SoundDef } from '../data/types';

export const DOCK_BASE_SIZE = 48;
export const DOCK_SLOT_HEIGHT = 84;
export const DOCK_SLOT_GAP = 2;
export const DOCK_LIST_PAD_Y = 13.6;
export const DOCK_PAD_X = 5.6;
export const CANVAS_TILE_SIZE = 84;
export const DRAG_THRESHOLD = 6;

export function getAvailableSounds(sounds: SoundDef[], activeSoundIds: string[]) {
  return sounds.filter((sound) => !activeSoundIds.includes(sound.id));
}

export function getDockSlotCenter(
  dockRect: DOMRect,
  soundId: string,
  allSounds: SoundDef[],
  activeSoundIds: string[],
): { x: number; y: number } | null {
  const available = getAvailableSounds(allSounds, activeSoundIds);
  const index = available.findIndex((sound) => sound.id === soundId);
  if (index < 0) return null;

  const y =
    dockRect.top +
    DOCK_LIST_PAD_Y +
    index * (DOCK_SLOT_HEIGHT + DOCK_SLOT_GAP) +
    DOCK_SLOT_HEIGHT / 2;
  const x = dockRect.left + DOCK_PAD_X + DOCK_BASE_SIZE / 2;
  return { x, y };
}
