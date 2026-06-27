import {
  formatCountrySubtitle,
  pickPlaceFromAddress,
  resolvePlaceDisplayName,
  type PlaceAddress,
} from './placeNaming';

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Saudade/1.0 (https://github.com/saudade; contact: local-dev)';
const MAX_RESULTS = 5;
const MIN_QUERY_LENGTH = 2;

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
  placeId: string;
  shortName: string;
  subtitle: string;
  type?: string;
  class?: string;
  addresstype?: string;
  countryCode?: string;
  countryName?: string;
};

type NominatimAddress = PlaceAddress;

type NominatimRow = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  addresstype?: string;
  name?: string;
  address?: NominatimAddress;
};

function splitDisplayName(displayName: string): { shortName: string; subtitle: string } {
  const parts = displayName.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return { shortName: displayName, subtitle: '' };
  }
  return {
    shortName: parts[0],
    subtitle: parts.slice(1).join(', '),
  };
}

function mapRow(row: NominatimRow, searchQuery?: string): GeocodeResult {
  const countryCode = row.address?.country_code?.trim().toLowerCase();
  const countryName = row.address?.country?.trim();
  const primaryName = row.name?.trim() || splitDisplayName(row.display_name).shortName;
  const resolved = resolvePlaceDisplayName({
    primaryName,
    displayName: row.display_name,
    type: row.type,
    class: row.class,
    addresstype: row.addresstype,
    address: row.address,
    searchQuery,
  });

  return {
    lat: Number.parseFloat(row.lat),
    lng: Number.parseFloat(row.lon),
    displayName: row.display_name,
    placeId: String(row.place_id),
    shortName: resolved.shortName,
    subtitle: resolved.subtitle,
    type: row.type,
    class: row.class,
    addresstype: row.addresstype,
    countryCode,
    countryName,
  };
}

/** Fetch up to five Nominatim matches for a place name (OpenStreetMap, no API key). */
export async function fetchGeocodeResults(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(MAX_RESULTS));
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Geocode failed (${response.status})`);
  }

  const rows = (await response.json()) as NominatimRow[];
  return rows.map((row) => mapRow(row, trimmed));
}

export const GEOCODE_DEBOUNCE_MS = 350;

type NominatimReverseRow = {
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  addresstype?: string;
  address?: NominatimAddress;
};

export type ReverseGeocodeLabel = {
  shortName: string;
  subtitle: string;
  geocode?: {
    type?: string;
    class?: string;
    addresstype?: string;
    displayName?: string;
    countryCode?: string;
  };
};

/** Resolve coordinates to a short place label (Nominatim reverse, no API key). */
export async function fetchReverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeLabel | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '10');

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) return null;

  const row = (await response.json()) as NominatimReverseRow;
  const countryCode = row.address?.country_code?.trim().toLowerCase();
  const countryName = row.address?.country?.trim();
  const primaryName =
    row.name?.trim() || pickPlaceFromAddress(row.address) || splitDisplayName(row.display_name).shortName;
  const resolved = resolvePlaceDisplayName({
    primaryName,
    displayName: row.display_name,
    type: row.type,
    class: row.class,
    addresstype: row.addresstype,
    address: row.address,
  });

  return {
    shortName: resolved.shortName,
    subtitle: formatCountrySubtitle(countryCode, countryName, resolved.subtitle),
    geocode: {
      type: row.type,
      class: row.class,
      addresstype: row.addresstype,
      displayName: row.display_name,
      countryCode,
    },
  };
}
