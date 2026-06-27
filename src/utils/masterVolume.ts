const STORAGE_KEY = 'saudade-master-volume';

// Master volume at 100% maps to the engine's existing default headroom.
export const DEFAULT_MASTER_VOLUME = 1;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getStoredMasterVolume(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return DEFAULT_MASTER_VOLUME;
    const parsed = Number.parseFloat(stored);
    if (Number.isFinite(parsed)) return clamp(parsed);
  } catch {
    // Ignore storage access errors (e.g. private mode).
  }
  return DEFAULT_MASTER_VOLUME;
}

export function storeMasterVolume(volume: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clamp(volume)));
  } catch {
    // Ignore storage write errors.
  }
}
