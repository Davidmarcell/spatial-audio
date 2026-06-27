import { resolveProceduralSoundscape } from '../utils/proceduralSoundscape';
import type { GeocodeContextLite } from '../utils/proceduralSoundscape';

export type WorldLocation = {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  environmentId: string;
  regionId: string;
  /** Geocoded place — not in the curated MVP list. */
  custom?: boolean;
  placeId?: string;
};

type ProceduralPin = {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  geocode?: GeocodeContextLite;
};

function proceduralPin(def: ProceduralPin): WorldLocation {
  const { environmentId, regionId } = resolveProceduralSoundscape({
    name: def.name,
    lat: def.lat,
    lng: def.lng,
    geocode: def.geocode,
  });
  return {
    id: def.id,
    name: def.name,
    subtitle: def.subtitle,
    lat: def.lat,
    lng: def.lng,
    environmentId,
    regionId,
  };
}

/**
 * Curated globe pins for the Radio Garden–style explorer.
 * Also the geo registry for nearest-region matching ("Use my location").
 */
export const worldLocations: WorldLocation[] = [
  {
    id: 'auckland',
    name: 'Auckland',
    subtitle: 'New Zealand',
    lat: -36.8485,
    lng: 174.7633,
    environmentId: 'nz-forest',
    regionId: 'auckland',
  },
  proceduralPin({
    id: 'new-york',
    name: 'New York',
    subtitle: 'United States',
    lat: 40.7128,
    lng: -74.006,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'us' },
  }),
  proceduralPin({
    id: 'new-orleans',
    name: 'New Orleans',
    subtitle: 'United States',
    lat: 29.9511,
    lng: -90.0715,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'us' },
  }),
  proceduralPin({
    id: 'havana',
    name: 'Havana',
    subtitle: 'Cuba',
    lat: 23.1136,
    lng: -82.3666,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'cu' },
  }),
  {
    id: 'rio-de-janeiro',
    name: 'Rio de Janeiro',
    subtitle: 'Brazil',
    lat: -22.9068,
    lng: -43.1729,
    environmentId: 'brazil-coast',
    regionId: 'rio-de-janeiro',
  },
  proceduralPin({
    id: 'amazon-rainforest',
    name: 'Amazon rainforest',
    subtitle: 'Brazil',
    lat: -3.4653,
    lng: -62.2159,
    geocode: { addresstype: 'forest', class: 'natural', countryCode: 'br' },
  }),
  proceduralPin({
    id: 'banff',
    name: 'Banff',
    subtitle: 'Canada',
    lat: 51.1784,
    lng: -115.5708,
    geocode: { addresstype: 'town', class: 'place', countryCode: 'ca' },
  }),
  proceduralPin({
    id: 'paris',
    name: 'Paris',
    subtitle: 'France',
    lat: 48.8566,
    lng: 2.3522,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'fr' },
  }),
  proceduralPin({
    id: 'venice',
    name: 'Venice',
    subtitle: 'Italy',
    lat: 45.4408,
    lng: 12.3155,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'it' },
  }),
  proceduralPin({
    id: 'swiss-alps',
    name: 'Swiss Alps',
    subtitle: 'Switzerland',
    lat: 46.5599,
    lng: 8.0444,
    geocode: { addresstype: 'mountain', class: 'natural', countryCode: 'ch' },
  }),
  proceduralPin({
    id: 'seville',
    name: 'Seville',
    subtitle: 'Spain',
    lat: 37.3891,
    lng: -5.9845,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'es' },
  }),
  proceduralPin({
    id: 'marrakech',
    name: 'Marrakech',
    subtitle: 'Morocco',
    lat: 31.6295,
    lng: -7.9811,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'ma' },
  }),
  proceduralPin({
    id: 'serengeti',
    name: 'Serengeti',
    subtitle: 'Tanzania',
    lat: -2.3333,
    lng: 34.8333,
    geocode: { addresstype: 'national_park', class: 'boundary', countryCode: 'tz' },
  }),
  proceduralPin({
    id: 'cape-town',
    name: 'Cape Town',
    subtitle: 'South Africa',
    lat: -33.9249,
    lng: 18.4241,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'za' },
  }),
  proceduralPin({
    id: 'kyoto',
    name: 'Kyoto',
    subtitle: 'Japan',
    lat: 35.0116,
    lng: 135.7681,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'jp' },
  }),
  proceduralPin({
    id: 'tokyo',
    name: 'Tokyo',
    subtitle: 'Japan',
    lat: 35.6762,
    lng: 139.6503,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'jp' },
  }),
  proceduralPin({
    id: 'bangkok',
    name: 'Bangkok',
    subtitle: 'Thailand',
    lat: 13.7563,
    lng: 100.5018,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'th' },
  }),
  proceduralPin({
    id: 'himalayas',
    name: 'Himalayas',
    subtitle: 'Nepal',
    lat: 28.3949,
    lng: 84.124,
    geocode: { addresstype: 'mountain', class: 'natural', countryCode: 'np' },
  }),
  proceduralPin({
    id: 'sydney',
    name: 'Sydney',
    subtitle: 'Australia',
    lat: -33.8688,
    lng: 151.2093,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'au' },
  }),
  proceduralPin({
    id: 'bali',
    name: 'Bali',
    subtitle: 'Indonesia',
    lat: -8.4095,
    lng: 115.1889,
    geocode: { addresstype: 'region', class: 'place', countryCode: 'id' },
  }),
  proceduralPin({
    id: 'lapland',
    name: 'Lapland',
    subtitle: 'Finland',
    lat: 67.9222,
    lng: 26.5046,
    geocode: { addresstype: 'region', class: 'place', countryCode: 'fi' },
  }),
  {
    id: 'bed-stuy',
    name: 'Bedford-Stuyvesant',
    subtitle: 'Brooklyn, New York',
    lat: 40.6872,
    lng: -73.9418,
    environmentId: 'urban-americas',
    regionId: 'bed-stuy',
  },
  {
    id: 'dolomites',
    name: 'Dolomites',
    subtitle: 'South Tyrol, Italy',
    lat: 46.541,
    lng: 11.844,
    environmentId: 'alpine-europe',
    regionId: 'dolomites',
  },
  {
    id: 'chiang-mai',
    name: 'Chiang Mai',
    subtitle: 'Northern Thailand',
    lat: 18.7883,
    lng: 98.9853,
    environmentId: 'southeast-asia',
    regionId: 'chiang-mai',
  },
  {
    id: 'nz-forest-general',
    name: 'North Island Forest',
    subtitle: 'New Zealand',
    lat: -38.5,
    lng: 176.2,
    environmentId: 'nz-forest',
    regionId: 'nz-forest-general',
  },
  {
    id: 'costa-rica-pacific',
    name: 'Pacific Slope',
    subtitle: 'Costa Rica',
    lat: 10.2,
    lng: -84.8,
    environmentId: 'costa-rica-rainforest',
    regionId: 'pacific-slope',
  },
];

export function findWorldLocation(environmentId: string, regionId: string) {
  return worldLocations.find(
    (location) =>
      location.environmentId === environmentId && location.regionId === regionId,
  );
}

export function getWorldLocation(id: string) {
  return worldLocations.find((location) => location.id === id);
}

export function createCustomWorldLocation(params: {
  lat: number;
  lng: number;
  name: string;
  subtitle: string;
  environmentId: string;
  regionId: string;
  placeId?: string;
}): WorldLocation {
  const slug = params.placeId ?? `${params.lat.toFixed(4)}-${params.lng.toFixed(4)}`;
  return {
    id: `custom-${slug}`,
    name: params.name,
    subtitle: params.subtitle,
    lat: params.lat,
    lng: params.lng,
    environmentId: params.environmentId,
    regionId: params.regionId,
    custom: true,
    placeId: params.placeId,
  };
}
