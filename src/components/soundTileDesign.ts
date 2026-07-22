/**
 * Live-tunable design tokens for the sound-detail card. Edited via the DEV
 * SoundTile button; applied as CSS variables on the detail sheet / preview.
 */

export type SoundTileDesignConfig = {
  /** Outer card corner radius (px). */
  cardRadiusPx: number;
  /** Inner artwork corner radius (px). */
  imageRadiusPx: number;
  /** Card padding around the two columns (px). */
  paddingPx: number;
  /** Artwork column size on desktop (px). */
  imageSizePx: number;
  /** Horizontal gap between artwork and info (px). */
  columnGapPx: number;
  /** Panel max width (rem). */
  panelWidthRem: number;
};

export const DEFAULT_SOUND_TILE_DESIGN: SoundTileDesignConfig = {
  cardRadiusPx: 36,
  imageRadiusPx: 22,
  paddingPx: 22,
  imageSizePx: 280,
  columnGapPx: 28,
  panelWidthRem: 44,
};

const STORAGE_KEY = 'saudade:sound-tile-design';
const VISIBLE_KEY = 'saudade:sound-tile-design-tuner-visible';

export function soundTileDesignToCssVars(
  config: SoundTileDesignConfig,
): Record<string, string> {
  return {
    '--sound-tile-card-radius': `${config.cardRadiusPx}px`,
    '--sound-tile-image-radius': `${config.imageRadiusPx}px`,
    '--sound-tile-padding': `${config.paddingPx}px`,
    '--sound-tile-image-size': `${config.imageSizePx}px`,
    '--sound-tile-column-gap': `${config.columnGapPx}px`,
    '--sound-tile-panel-width': `${config.panelWidthRem}rem`,
  };
}

export function loadSoundTileDesign(): SoundTileDesignConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_SOUND_TILE_DESIGN };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SOUND_TILE_DESIGN };
    const parsed = JSON.parse(raw) as Partial<SoundTileDesignConfig>;
    return { ...DEFAULT_SOUND_TILE_DESIGN, ...parsed };
  } catch {
    return { ...DEFAULT_SOUND_TILE_DESIGN };
  }
}

export function saveSoundTileDesign(config: SoundTileDesignConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function isSoundTileTunerVisible(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('soundTileDebug') === '1') return true;
  return window.localStorage.getItem(VISIBLE_KEY) === '1';
}

export function persistSoundTileTunerVisible(visible: boolean): void {
  if (typeof window === 'undefined') return;
  if (visible) window.localStorage.setItem(VISIBLE_KEY, '1');
  else window.localStorage.removeItem(VISIBLE_KEY);
}

export function soundTileDesignSummary(config: SoundTileDesignConfig): string {
  return [
    `r ${config.cardRadiusPx}`,
    `img ${config.imageSizePx}`,
    `pad ${config.paddingPx}`,
  ].join(' · ');
}

/** Short museum/source label for the card meta row (e.g. "Met"). */
export function shortArtworkSourceLabel(sourceUrl: string): string {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('metmuseum')) return 'Met';
    if (host.includes('nypl')) return 'NYPL';
    if (host.includes('aucklandmuseum')) return 'Auckland Museum';
    if (host.includes('wikimedia') || host.includes('wikipedia')) return 'Wikimedia';
    if (host.includes('britishmuseum')) return 'British Museum';
    if (host.includes('nga.gov')) return 'NGA';
    const base = host.split('.')[0] ?? 'Source';
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return 'Source';
  }
}
