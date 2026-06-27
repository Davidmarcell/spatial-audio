export const ORIGIN_ENTER_OFFSET_MAX = 32;
export const ORIGIN_ENTER_OFFSET_MIN = 8;

export type OriginEnterOffset = { x: number; y: number };

/** Static screen rect captured at click time (DOMRect values are live). */
export type OriginRectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function snapshotOriginRect(rect: DOMRectReadOnly | null): OriginRectSnapshot | null {
  if (!rect) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function originRectFromSnapshot(snapshot: OriginRectSnapshot): DOMRectReadOnly {
  return {
    left: snapshot.left,
    top: snapshot.top,
    width: snapshot.width,
    height: snapshot.height,
    right: snapshot.left + snapshot.width,
    bottom: snapshot.top + snapshot.height,
    x: snapshot.left,
    y: snapshot.top,
    toJSON() {
      return this;
    },
  } as DOMRectReadOnly;
}

/** Default enter nudge when no trigger origin is provided. */
export const DEFAULT_ENTER_OFFSET: OriginEnterOffset = { x: 0, y: 14 };

function clampMagnitude(dx: number, dy: number, max: number): OriginEnterOffset {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude <= max || magnitude === 0) {
    return { x: dx, y: dy };
  }
  const scale = max / magnitude;
  return { x: dx * scale, y: dy * scale };
}

/**
 * Distance from screen center (0–1) for the trigger midpoint.
 * Used to scale origin nudge: center ≈ 8px, edges up to 32px.
 */
function triggerDistanceFromCenter(originRect: DOMRectReadOnly): number {
  const cx = originRect.left + originRect.width / 2;
  const cy = originRect.top + originRect.height / 2;
  const maxDistance = Math.hypot(window.innerWidth / 2, window.innerHeight / 2);
  if (maxDistance === 0) return 0;
  const dx = cx - window.innerWidth / 2;
  const dy = cy - window.innerHeight / 2;
  return Math.min(1, Math.hypot(dx, dy) / maxDistance);
}

/**
 * Offset from the panel's resting center toward the trigger.
 * Nudge scales with trigger distance from screen center (~8px center, ~32px edges).
 */
export function computeOriginEnterOffset(
  originRect: DOMRectReadOnly,
  _panelRect?: DOMRectReadOnly | null,
  maxOffset = ORIGIN_ENTER_OFFSET_MAX,
  minOffset = ORIGIN_ENTER_OFFSET_MIN,
): OriginEnterOffset {
  const originCx = originRect.left + originRect.width / 2;
  const originCy = originRect.top + originRect.height / 2;
  // The panel is always viewport-centred; measuring its transformed box during
  // enter/exit animations skews the nudge direction when swapping sounds.
  const panelCx = window.innerWidth / 2;
  const panelCy = window.innerHeight / 2;

  const dx = originCx - panelCx;
  const dy = originCy - panelCy;

  const distanceFactor = triggerDistanceFromCenter(originRect);
  const effectiveMax =
    minOffset + (maxOffset - minOffset) * distanceFactor;

  return clampMagnitude(dx, dy, effectiveMax);
}
