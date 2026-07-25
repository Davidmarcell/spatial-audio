import type { SoundDef } from '../data/types';

export const DOCK_BASE_SIZE = 52;
export const DOCK_SLOT_HEIGHT = 62.4;
export const DOCK_SLOT_GAP = 0;
export const DOCK_LIST_PAD_Y = 0.6;
export const DOCK_PAD_X = 5.3;
export const CANVAS_TILE_SIZE = 84;
/** Compact canvas tile edge — keeps mobile soundscapes from reading as a pile. */
export const MOBILE_CANVAS_TILE_SIZE = 50;
export const DRAG_THRESHOLD = 6;

const COMPACT_MQ = '(max-width: 768px)';

export function isCompactViewport(): boolean {
  return (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(COMPACT_MQ).matches
  );
}

/** Drag-ghost / hit-target size for the current viewport. */
export function getCanvasTileSize(): number {
  return isCompactViewport() ? MOBILE_CANVAS_TILE_SIZE : CANVAS_TILE_SIZE;
}

/**
 * Floor for how many tiles the dock will always allow. The dock is no longer
 * hard-capped at this number — it grows vertically to hold every sound dragged
 * in, constrained only by how many slots fit the viewport height (see
 * {@link getMaxDockSounds}). This constant is the minimum we guarantee even on
 * short viewports.
 */
export const MAX_DOCK_SOUNDS = 5;

/**
 * How many dock tiles can fit the current viewport height. The dock is a
 * vertically-centred bar, so its total height must stay within the available
 * space; we reserve room for the add-button slot plus comfortable top/bottom
 * breathing space so it never runs to the screen edges. Falls back to a sane
 * default when there is no window (SSR/tests).
 */
export function getMaxDockSounds(): number {
  if (typeof window === 'undefined') return 12;
  // Mobile dock scrolls horizontally — allow a fuller tray of tiles.
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 768px)').matches
  ) {
    return 24;
  }
  const reserved = DOCK_SLOT_HEIGHT + 200;
  const available = window.innerHeight - reserved;
  const fit = Math.floor(available / (DOCK_SLOT_HEIGHT + DOCK_SLOT_GAP));
  return Math.max(MAX_DOCK_SOUNDS, fit);
}

/** Pointer influence radius for dock magnification (px). */
export const DOCK_MAGNET_INFLUENCE = 88;
export const DOCK_HOVER_INFLUENCE = 60;
/**
 * Catch zone around the dock for engaging the magnet while dragging a canvas
 * tile back. Kept tight (~40px from the bar edge) so the dock only responds
 * once the tile is genuinely close — but with no dead spots once inside it.
 */
export const DOCK_ACTIVATION_PAD = 40;
/** Gap opened between dock icons when an external tile approaches (px). */
export const DOCK_INSERTION_GAP = 58;
/** Max icon size during external canvas→dock drag (px). */
export const DOCK_DRAG_MAX_SIZE = 82;

/**
 * Picks the sidebar dock palette tiles from the randomized dock defaults.
 *
 * Dragging a tile out onto the canvas simply removes it from the dock (the
 * remaining tiles settle to close the gap) — we deliberately do NOT backfill a
 * fresh sound from the catalog, so the dock never introduces a sound the user
 * did not choose.
 */
export function getDockSounds(
  allSounds: SoundDef[],
  activeSoundIds: string[],
  dockDefaultIds: string[],
  returningSoundId?: string | null,
): SoundDef[] {
  const soundById = new Map(allSounds.map((sound) => [sound.id, sound]));
  const onCanvas = new Set(activeSoundIds);
  if (returningSoundId) {
    onCanvas.delete(returningSoundId);
  }
  const selected: SoundDef[] = [];
  const selectedIds = new Set<string>();
  const maxDockSounds = getMaxDockSounds();

  const tryAdd = (id: string) => {
    if (selected.length >= maxDockSounds || selectedIds.has(id) || onCanvas.has(id)) {
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

  return selected;
}

export function getDockSlotCenter(
  dockRect: DOMRect,
  soundId: string,
  allSounds: SoundDef[],
  activeSoundIds: string[],
  dockDefaultIds: string[],
  returningSoundId?: string | null,
): { x: number; y: number } | null {
  const dockSounds = getDockSounds(allSounds, activeSoundIds, dockDefaultIds, returningSoundId);
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

/** Stable slot centres along the dock axis (ignores live spread transforms). */
export function getDockSlotCenters(
  dockRect: DOMRect,
  dockSoundCount: number,
  horizontal: boolean,
): number[] {
  const centers: number[] = [];
  const slotStride = DOCK_SLOT_HEIGHT + DOCK_SLOT_GAP;

  for (let i = 0; i < dockSoundCount; i += 1) {
    if (horizontal) {
      const x = dockRect.left + 6 + i * slotStride + DOCK_BASE_SIZE / 2;
      centers.push(x);
    } else {
      const y = dockRect.top + DOCK_LIST_PAD_Y + i * slotStride + DOCK_SLOT_HEIGHT / 2;
      centers.push(y);
    }
  }

  const addIndex = dockSoundCount;
  if (horizontal) {
    const x = dockRect.left + 6 + addIndex * slotStride + DOCK_BASE_SIZE / 2;
    centers.push(x);
  } else {
    const y =
      dockRect.top + DOCK_LIST_PAD_Y + addIndex * slotStride + DOCK_SLOT_HEIGHT / 2;
    centers.push(y);
  }

  return centers;
}

/** Index at which a returning tile would slot in (0 = before first icon). */
export function getDockInsertionIndex(pointerCoord: number, slotCenters: number[]): number {
  if (slotCenters.length === 0) return 0;
  if (slotCenters.length === 1) {
    return pointerCoord < slotCenters[0] ? 0 : 1;
  }

  for (let i = 0; i < slotCenters.length - 1; i += 1) {
    const boundary = (slotCenters[i] + slotCenters[i + 1]) / 2;
    if (pointerCoord < boundary) return i;
  }
  return slotCenters.length;
}

/** Spreads dock items apart to open a gap at `insertionIndex`. */
export function computeDockSpreadOffsets(
  itemCount: number,
  insertionIndex: number,
  gapSize: number,
): number[] {
  const half = gapSize / 2;
  const offsets: number[] = [];
  for (let i = 0; i < itemCount; i += 1) {
    offsets.push(i < insertionIndex ? -half : half);
  }
  return offsets;
}

export function reorderDockDefaultIds(
  dockDefaultIds: string[],
  activeSoundIds: string[],
  allSounds: SoundDef[],
  returningSoundId: string,
  insertionIndex: number,
): string[] {
  const currentDock = getDockSounds(allSounds, activeSoundIds, dockDefaultIds);
  // Drop any stale copy of the returning sound first so re-docking a tile that
  // was itself a dock default never produces a duplicate slot.
  const orderedIds = currentDock
    .map((sound) => sound.id)
    .filter((id) => id !== returningSoundId);
  const clampedIndex = Math.max(0, Math.min(insertionIndex, orderedIds.length));
  orderedIds.splice(clampedIndex, 0, returningSoundId);

  // If the dock is already full (i.e. all viewport slots are taken) the
  // returning tile must still win a slot — trim an *existing* tile from the far
  // end (never the tile the user just dropped), so dropping onto a full dock
  // always snaps in instead of vanishing.
  if (orderedIds.length > getMaxDockSounds()) {
    const lastIndex = orderedIds.length - 1;
    const removeAt = lastIndex === clampedIndex ? lastIndex - 1 : lastIndex;
    orderedIds.splice(removeAt, 1);
  }

  return orderedIds;
}
