/** Portrait art height target for Arcade-style tall sheets. */
export const PORTRAIT_ART_MAX_HEIGHT_PX = 420;
/** Landscape detail art targets this height; width follows the natural ratio. */
export const LANDSCAPE_ART_HEIGHT_PX = 280;
/** Allow wider panels when landscape art grows past the default card. */
export const DETAIL_PANEL_WIDTH_MAX_PX = 440;

export type DetailArtBox = {
  artW: number;
  artH: number;
  isLandscape: boolean;
};

/**
 * Arcade-style sheet: single column, art on top. Portrait grows taller inside
 * a narrow card; landscape keeps a fixed height and widens within the panel.
 */
export function detailArtBox(aspect: number, imageSizePx: number): DetailArtBox {
  const a = Math.max(0.4, aspect);
  if (a > 1.02) {
    const artH = LANDSCAPE_ART_HEIGHT_PX;
    return { artW: artH * a, artH, isLandscape: true };
  }
  const artW = imageSizePx;
  const artH = Math.min(PORTRAIT_ART_MAX_HEIGHT_PX, artW / a);
  return { artW, artH, isLandscape: false };
}

export function clampDetailCardWidth(preferred: number, maxWidth = DETAIL_PANEL_WIDTH_MAX_PX): number {
  if (typeof window === 'undefined') return Math.min(preferred, maxWidth);
  return Math.min(preferred, maxWidth, Math.max(280, window.innerWidth - 44));
}

/**
 * Narrow, tall sheet (not full-bleed). No sidebar column — art stacks above
 * meta, App Store Arcade card → sheet proportions.
 */
export function estimateDetailOpenRect(
  panelWidthPx: number,
  imageSizePx: number,
  paddingPx: number,
  _columnGapPx: number,
  aspect: number,
): { left: number; top: number; width: number; height: number; artW: number; artH: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : panelWidthPx;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
  const box = detailArtBox(aspect, imageSizePx);

  const width = clampDetailCardWidth(Math.min(panelWidthPx, vw - 44), Math.min(DETAIL_PANEL_WIDTH_MAX_PX, vw - 44));
  const artW = Math.max(120, width - paddingPx * 2);
  const artH = box.isLandscape
    ? Math.min(LANDSCAPE_ART_HEIGHT_PX, artW / Math.max(0.4, aspect))
    : Math.min(PORTRAIT_ART_MAX_HEIGHT_PX, artW / Math.max(0.4, aspect));
  const infoBlock = 240;
  const height = Math.min(
    paddingPx * 2 + artH + infoBlock + 16,
    vh * 0.92,
  );
  return {
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    width,
    height,
    artW,
    artH,
  };
}
