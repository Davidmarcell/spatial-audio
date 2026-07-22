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

function labelPartIncluded(name: string, part: string): boolean {
  if (!part) return true;
  const normalizedName = name.toLowerCase();
  const normalizedPart = part.toLowerCase();
  if (normalizedName === normalizedPart) return true;
  if (normalizedName.endsWith(`, ${normalizedPart}`)) return true;
  return normalizedName
    .split(',')
    .map((segment) => segment.trim())
    .includes(normalizedPart);
}

/** Display label in "City, Country" form (British English). */
export function formatWorldLocationLabel(
  location: Pick<WorldLocation, 'name' | 'subtitle'>,
): string {
  const name = location.name.trim();
  const subtitle = location.subtitle.trim();
  if (!subtitle || labelPartIncluded(name, subtitle)) return name;
  return `${name}, ${subtitle}`;
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
    id: 'queenstown',
    name: 'Queenstown',
    subtitle: 'New Zealand',
    lat: -45.0312,
    lng: 168.6626,
    geocode: {
      addresstype: 'town',
      class: 'place',
      countryCode: 'nz',
      displayName: 'Queenstown, Lake Wakatipu, Southern Alps high country, Otago',
    },
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
    id: 'monteverde',
    name: 'Monteverde',
    subtitle: 'Costa Rica',
    lat: 10.301,
    lng: -84.825,
    geocode: {
      addresstype: 'forest',
      class: 'natural',
      countryCode: 'cr',
      displayName: 'Monteverde cloud forest reserve',
    },
  }),
  proceduralPin({
    id: 'redwoods',
    name: 'Redwoods',
    subtitle: 'California',
    lat: 41.2132,
    lng: -124.0046,
    geocode: {
      addresstype: 'forest',
      class: 'natural',
      countryCode: 'us',
      displayName: 'Redwood National and State Parks, coast redwood forest, Pacific coast of Northern California',
    },
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
    id: 'swiss-alps',
    name: 'Swiss Alps',
    subtitle: 'Switzerland',
    lat: 46.5599,
    lng: 8.0444,
    geocode: { addresstype: 'mountain', class: 'natural', countryCode: 'ch' },
  }),
  proceduralPin({
    id: 'lisbon',
    name: 'Lisbon',
    subtitle: 'Portugal',
    lat: 38.7223,
    lng: -9.1393,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'pt' },
  }),
  proceduralPin({
    id: 'istanbul',
    name: 'Istanbul',
    subtitle: 'Turkey',
    lat: 41.0082,
    lng: 28.9784,
    geocode: { addresstype: 'city', class: 'place', countryCode: 'tr' },
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
    id: 'oaxaca',
    name: 'Oaxaca',
    subtitle: 'Mexico',
    lat: 17.0732,
    lng: -96.7266,
    geocode: {
      addresstype: 'city',
      class: 'place',
      countryCode: 'mx',
      displayName: 'Oaxaca de Juárez, Central Valleys, Sierra Madre de Oaxaca dry forest',
    },
  }),
  proceduralPin({
    id: 'bariloche',
    name: 'Bariloche',
    subtitle: 'Argentina',
    lat: -41.133,
    lng: -71.31,
    geocode: {
      addresstype: 'town',
      class: 'place',
      countryCode: 'ar',
      displayName: 'San Carlos de Bariloche, Nahuel Huapi lake, Patagonian Andes',
    },
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
    name: 'Brooklyn',
    subtitle: 'New York',
    lat: 40.6872,
    lng: -73.9418,
    environmentId: 'urban-americas',
    regionId: 'bed-stuy',
  },
  {
    id: 'bangkok',
    name: 'Bangkok',
    subtitle: 'Thailand',
    lat: 13.7563,
    lng: 100.5018,
    environmentId: 'southeast-asia',
    regionId: 'bangkok',
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
