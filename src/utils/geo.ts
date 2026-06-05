/**
 * Geo utilities for nearest-region matching (MVP foundation for hyper-dynamic location).
 *
 * Future direction (not in MVP):
 * - watchPosition for travel / auto-switch soundscapes while moving
 * - reverse geocode for human labels ("You are near Auckland")
 * - fuzzy / weighted match when between regions (distance thresholds, blending)
 * - sync globe map highlight + toast when region changes
 * - expand geo registry: lat/lng on every app region, not only globe pins
 */

const EARTH_RADIUS_KM = 6371;

export type GeoCoords = {
  lat: number;
  lng: number;
};

export type GeoRegionTarget = GeoCoords & {
  environmentId: string;
  regionId: string;
};

/** Great-circle distance in kilometres (haversine). */
export function haversineDistanceKm(a: GeoCoords, b: GeoCoords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Pick the candidate region whose pin is closest to the user. */
export function findNearestRegion<T extends GeoRegionTarget>(
  coords: GeoCoords,
  candidates: readonly T[],
): T | null {
  if (!candidates.length) return null;

  let nearest = candidates[0];
  let minDistance = haversineDistanceKm(coords, nearest);

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const distance = haversineDistanceKm(coords, candidate);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = candidate;
    }
  }

  return nearest;
}
