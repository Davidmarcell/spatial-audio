import type { SoundDef } from '../data/types';

export const DOCK_BASE_SIZE = 52;
export const DOCK_SLOT_HEIGHT = 62.4;
export const DOCK_SLOT_GAP = 0;
export const DOCK_LIST_PAD_Y = 0.6;
export const DOCK_PAD_X = 5.3;
export const CANVAS_TILE_SIZE = 84;
export const DRAG_THRESHOLD = 6;

export const MAX_DOCK_SOUNDS = 5;

function dockCandidateRank(seed: string, soundId: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = 0; i < soundId.length; i += 1) {
    hash = (hash * 31 + soundId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Picks up to MAX_DOCK_SOUNDS tiles for the sidebar dock palette.
 * Prefers randomized dock defaults, then backfills from the regional catalog
 * so dragging sounds onto the canvas does not shrink the dock.
 */
export function getDockSounds(
  allSounds: SoundDef[],
  activeSoundIds: string[],
  dockDefaultIds: string[],
): SoundDef[] {
  const soundById = new Map(allSounds.map((sound) => [sound.id, sound]));
  const onCanvas = new Set(activeSoundIds);
  const selected: SoundDef[] = [];
  const selectedIds = new Set<string>();

  const tryAdd = (id: string) => {
    if (selected.length >= MAX_DOCK_SOUNDS || selectedIds.has(id) || onCanvas.has(id)) {
      return;
    }
    const sound = soundById.get(id);
    if (!sound) return;
    selected.push(sound);
    selectedIds.add(id);
  };

  for (const id of dockDefaultIds) {
    tryAdd(id);
  }

  if (selected.length < MAX_DOCK_SOUNDS) {
    const seed = dockDefaultIds.join(':') || 'dock';
    const backfillIds = allSounds
      .map((sound) => sound.id)
      .filter((id) => !selectedIds.has(id) && !onCanvas.has(id))
      .sort((left, right) => dockCandidateRank(seed, left) - dockCandidateRank(seed, right));

    for (const id of backfillIds) {
      tryAdd(id);
      if (selected.length >= MAX_DOCK_SOUNDS) break;
    }
  }

  return selected;
}

export function getDockSlotCenter(
  dockRect: DOMRect,
  soundId: string,
  allSounds: SoundDef[],
  activeSoundIds: string[],
  dockDefaultIds: string[],
): { x: number; y: number } | null {
  const dockSounds = getDockSounds(allSounds, activeSoundIds, dockDefaultIds);
  const index = dockSounds.findIndex((sound) => sound.id === soundId);
  if (index < 0) return null;

  const y =
    dockRect.top +
    DOCK_LIST_PAD_Y +
    index * (DOCK_SLOT_HEIGHT + DOCK_SLOT_GAP) +
    DOCK_SLOT_HEIGHT / 2;
  const x = dockRect.left + DOCK_PAD_X + DOCK_BASE_SIZE / 2;
  return { x, y };
}
