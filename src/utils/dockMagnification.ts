/** macOS-style dock magnification from pointer distance (px). */
export function dockMagnification(
  distance: number,
  baseSize: number,
  maxSize: number,
  influence = 120,
): number {
  if (distance >= influence) return baseSize;
  const t = 1 - distance / influence;
  return baseSize + (maxSize - baseSize) * t * t;
}
