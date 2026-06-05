import type { AppLocation } from '../data/environments';
import type { WorldLocation } from '../data/worldLocations';

export type RegionRef = {
  environmentId: string;
  regionId: string;
};

export function pickRandomRegion(
  appLocations: readonly AppLocation[],
  worldLocations: readonly WorldLocation[],
): RegionRef {
  const seen = new Set<string>();
  const pool: RegionRef[] = [];

  for (const loc of appLocations) {
    const key = `${loc.environmentId}:${loc.regionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ environmentId: loc.environmentId, regionId: loc.regionId });
  }

  for (const loc of worldLocations) {
    const key = `${loc.environmentId}:${loc.regionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ environmentId: loc.environmentId, regionId: loc.regionId });
  }

  if (pool.length === 0) {
    return appLocations[0] ?? worldLocations[0];
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
