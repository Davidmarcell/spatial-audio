import type { GeocodeResult } from './geocode';

/**
 * Generic naturalist-plate illustrations for "Search worldwide" geocode rows
 * (arbitrary places anywhere on earth, so there's no curated art for them).
 * Picked by settlement/place type instead of a blank placeholder box — a
 * proper city gets a skyline sketch, a hamlet/village gets a cottage sketch,
 * an island/archipelago gets a coastal sketch, a state/region/country gets a
 * mountain-and-foothills landscape, and anything unclassified falls back to
 * a compass rose.
 */
const GEOCODE_ART_CITY = '/icons/generic/city.jpg';
const GEOCODE_ART_VILLAGE = '/icons/generic/village.jpg';
const GEOCODE_ART_ISLAND = '/icons/generic/island.jpg';
const GEOCODE_ART_REGION = '/icons/generic/region.jpg';
const GEOCODE_ART_COMPASS = '/icons/generic/compass-rose.jpg';

/** Larger, denser settlements — read as a skyline. */
const CITY_TYPES = new Set(['city', 'town', 'municipality', 'borough']);

/** Smaller / looser settlements — read as a cottage cluster. */
const VILLAGE_TYPES = new Set([
  'village',
  'hamlet',
  'suburb',
  'quarter',
  'neighbourhood',
  'locality',
  'isolated_dwelling',
]);

/** Islands / archipelagos — read as a small rocky island offshore. */
const ISLAND_TYPES = new Set(['island', 'archipelago']);

/** Broad admin areas — read as a mountain-and-foothills landscape. */
const REGION_TYPES = new Set(['state', 'region', 'province', 'county', 'district', 'country', 'continent']);

/**
 * Pick a generic illustration for a geocode ("Search worldwide") result.
 * `type`/`addresstype` come straight through from Photon/Nominatim (see
 * `GeocodeResult`); anything not recognised (unclassified matches, streets,
 * POIs that slipped through) gets the compass rose, which reads fine as a
 * universal "somewhere on the map" glyph.
 */
export function getGeocodePlaceholderArt(result: GeocodeResult): string {
  const key = (result.type ?? result.addresstype ?? result.class ?? '').toLowerCase();
  if (CITY_TYPES.has(key)) return GEOCODE_ART_CITY;
  if (VILLAGE_TYPES.has(key)) return GEOCODE_ART_VILLAGE;
  if (ISLAND_TYPES.has(key)) return GEOCODE_ART_ISLAND;
  if (REGION_TYPES.has(key)) return GEOCODE_ART_REGION;
  return GEOCODE_ART_COMPASS;
}
