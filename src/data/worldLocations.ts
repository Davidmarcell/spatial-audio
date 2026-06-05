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

/**
 * Curated globe pins for the Radio Garden–style explorer (MVP).
 * Also the geo registry for nearest-region matching ("Use my location").
 * Add lat/lng here (or on app regions) as soundscapes grow.
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
  {
    id: 'rio-de-janeiro',
    name: 'Rio de Janeiro',
    subtitle: 'Brazil',
    lat: -22.9068,
    lng: -43.1729,
    environmentId: 'brazil-coast',
    regionId: 'rio-de-janeiro',
  },
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
