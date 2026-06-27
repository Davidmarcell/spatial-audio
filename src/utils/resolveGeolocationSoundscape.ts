import { fetchReverseGeocode } from './geocode';
import {
  resolveProceduralSoundscape,
  type GeocodeContextLite,
} from './proceduralSoundscape';

export type GeolocationSoundscapeMatch = {
  environmentId: string;
  regionId: string;
  lat: number;
  lng: number;
  name: string;
  subtitle: string;
};

/**
 * Resolve coordinates to a bespoke procedural soundscape plus human labels.
 * Shared by the bottom-bar button and the globe "Use my location" row.
 */
export async function resolveGeolocationSoundscape(
  lat: number,
  lng: number,
): Promise<GeolocationSoundscapeMatch> {
  let shortName = 'My location';
  let subtitle = '';
  let geocode: GeocodeContextLite | undefined;

  try {
    const label = await fetchReverseGeocode(lat, lng);
    if (label) {
      shortName = label.shortName;
      subtitle = label.subtitle;
      if (label.geocode) geocode = label.geocode;
    }
  } catch {
    // Keep fallback labels when reverse geocode is unavailable.
  }

  const { environmentId, regionId } = resolveProceduralSoundscape({
    name: shortName,
    lat,
    lng,
    geocode,
  });

  return {
    environmentId,
    regionId,
    lat,
    lng,
    name: shortName,
    subtitle,
  };
}
