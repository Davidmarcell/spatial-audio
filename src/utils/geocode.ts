const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SpatialAudio/1.0 (https://github.com/spatial-audio; contact: local-dev)';
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

type NominatimAddress = {
  country?: string;
  country_code?: string;
};

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

function formatLocationSubtitle(
  countryCode: string | undefined,
  countryName: string | undefined,
  fallbackSubtitle: string,
): string {
  if (countryCode?.toLowerCase() === 'gb') return 'UK';
  if (countryName) return countryName;
  return fallbackSubtitle;
}

function mapRow(row: NominatimRow): GeocodeResult {
  const { shortName, subtitle } = splitDisplayName(row.display_name);
  const countryCode = row.address?.country_code?.trim().toLowerCase();
  const countryName = row.address?.country?.trim();
  return {
    lat: Number.parseFloat(row.lat),
    lng: Number.parseFloat(row.lon),
    displayName: row.display_name,
    placeId: String(row.place_id),
    shortName: row.name?.trim() || shortName,
    subtitle: formatLocationSubtitle(countryCode, countryName, subtitle),
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
  return rows.map(mapRow);
}

export const GEOCODE_DEBOUNCE_MS = 350;
