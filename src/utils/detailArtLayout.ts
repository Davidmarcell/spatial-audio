/** Landscape detail art targets this height; width follows the natural ratio. */
export const LANDSCAPE_ART_HEIGHT_PX = 330;
/** Minimum width reserved for the meta/volume column beside the art. */
export const DETAIL_INFO_COLUMN_MIN_PX = 200;
/** Allow wider panels when landscape art grows past the default card. */
export const DETAIL_PANEL_WIDTH_MAX_PX = 880;

export type DetailArtBox = {
  artW: number;
  artH: number;
  isLandscape: boolean;
};

/**
 * Portrait keeps the designer's square-ish column width and grows taller.
 * Landscape flips the constraint: fix height at 330px and let width widen.
 */
export function detailArtBox(aspect: number, imageSizePx: number): DetailArtBox {
  const a = Math.max(0.4, aspect);
  if (a > 1.02) {
    const artH = LANDSCAPE_ART_HEIGHT_PX;
    return { artW: artH * a, artH, isLandscape: true };
  }
  const artW = imageSizePx;
  return { artW, artH: artW / a, isLandscape: false };
}

export function clampDetailCardWidth(preferred: number, maxWidth = DETAIL_PANEL_WIDTH_MAX_PX): number {
  if (typeof window === 'undefined') return Math.min(preferred, maxWidth);
  return Math.min(preferred, maxWidth, Math.max(280, window.innerWidth - 32));
}

export function estimateDetailOpenRect(
  panelWidthPx: number,
  imageSizePx: number,
  paddingPx: number,
  columnGapPx: number,
  aspect: number,
): { left: number; top: number; width: number; height: number; artW: number; artH: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : panelWidthPx;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 420;
  const stacked = vw <= 760;
  const box = detailArtBox(aspect, imageSizePx);

  if (stacked) {
    // Phone: full-width card, art on top, meta below — same shared-element path.
    const width = clampDetailCardWidth(Math.min(panelWidthPx, vw - 24), vw - 24);
    const artW = Math.max(120, width - paddingPx * 2);
    const artH = box.isLandscape
      ? Math.min(LANDSCAPE_ART_HEIGHT_PX, artW / Math.max(0.4, aspect))
      : artW / Math.max(0.4, aspect);
    const infoBlock = 220;
    const height = Math.min(
      paddingPx * 2 + artH + infoBlock + 12,
      vh * 0.88,
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

  const contentW = box.artW + columnGapPx + DETAIL_INFO_COLUMN_MIN_PX + paddingPx * 2;
  const preferredW = box.isLandscape ? Math.max(panelWidthPx, contentW) : panelWidthPx;
  const width = clampDetailCardWidth(preferredW);

  const maxArtW = Math.max(120, width - paddingPx * 2 - columnGapPx - DETAIL_INFO_COLUMN_MIN_PX);
  const artW = Math.min(box.artW, maxArtW);
  const artH = artW / Math.max(0.4, aspect);

  const height = Math.min(paddingPx * 2 + Math.max(artH, 240), vh * 0.85);
  return {
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    width,
    height,
    artW,
    artH,
  };
}
