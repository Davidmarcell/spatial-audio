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

/** Aspect floor, so a freak ratio can't produce an unbounded box. */
const MIN_ASPECT = 0.25;

/**
 * Viewport-aware portrait cap. A full 420px plate plus title, meta and the
 * volume row does not fit a short window, so tighten it to the space available.
 *
 * This MUST be shared by everything that sizes the card. The flight estimate
 * used to compute its own cap and its own width, so it flew the card to
 * 344x420 art while the settled render laid out 199x333 — the card visibly
 * shrank after landing.
 */
export function portraitArtMaxHeightPx(): number {
  if (typeof window === 'undefined') return PORTRAIT_ART_MAX_HEIGHT_PX;
  return Math.min(PORTRAIT_ART_MAX_HEIGHT_PX, Math.max(200, window.innerHeight * 0.42));
}

/**
 * Arcade-style sheet: single column, art on top. Portrait grows taller inside
 * a narrow card; landscape keeps a fixed height and widens within the panel.
 *
 * Both dimensions are capped and the ratio is preserved either way, so the box
 * always fits and a tall plate narrows rather than stretching.
 */
export function detailArtBox(
  aspect: number,
  imageSizePx: number,
  maxHeightPx: number = PORTRAIT_ART_MAX_HEIGHT_PX,
  maxWidthPx?: number,
): DetailArtBox {
  const a = Math.max(MIN_ASPECT, aspect);
  const isLandscape = a > 1.02;

  let artH = isLandscape ? Math.min(LANDSCAPE_ART_HEIGHT_PX, maxHeightPx) : 0;
  let artW = 0;
  if (isLandscape) {
    artW = artH * a;
  } else {
    const naturalH = imageSizePx / a;
    artH = Math.min(maxHeightPx, naturalH);
    // Width follows the (possibly capped) height at the true ratio, rather than
    // staying fixed while only height shrinks — that stretched tall plates.
    artW = artH < naturalH ? artH * a : imageSizePx;
  }

  // A wide plate can still overflow the card; shrink both together so the ratio
  // survives instead of the CSS max-width squashing it.
  if (maxWidthPx != null && artW > maxWidthPx) {
    artW = maxWidthPx;
    artH = artW / a;
  }

  return { artW, artH, isLandscape };
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

  const width = clampDetailCardWidth(Math.min(panelWidthPx, vw - 44), Math.min(DETAIL_PANEL_WIDTH_MAX_PX, vw - 44));
  // Exactly the box the card will settle into — same function, same caps, same
  // available width. Any divergence here is a visible resize after the flight
  // lands, which is what a second copy of this arithmetic used to cause.
  const { artW, artH } = detailArtBox(
    aspect,
    imageSizePx,
    portraitArtMaxHeightPx(),
    Math.max(120, width - paddingPx * 2),
  );
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
