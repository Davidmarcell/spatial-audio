import {
  formatCountrySubtitle,
  pickPlaceFromAddress,
  resolvePlaceDisplayName,
  type PlaceAddress,
} from './placeNaming';

// Forward search uses Photon (Komoot's OpenStreetMap typeahead geocoder, no API
// key). Photon does prefix / fuzzy matching, so a partial or slightly misspelt
// query like "Ho Chi Min" resolves to the real settlement ("Ho Chi Minh City").
// Nominatim, by contrast, only matches literally, so the same query returned a
// handful of tracks and paths named after Ho Chi Minh and never the city.
const PHOTON_SEARCH = 'https://photon.komoot.io/api';
// Reverse geocode ("Use my location") stays on Nominatim, which resolves cleanly
// from coordinates.
const USER_AGENT = 'Saudade/1.0 (https://github.com/saudade; contact: local-dev)';
const MAX_RESULTS = 5;
// Ask Photon for a generous pool so the real settlements survive after we drop
// streets / POIs client-side, then trim back to MAX_RESULTS.
const PHOTON_FETCH_LIMIT = 20;
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

type PhotonProperties = {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  street?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  type?: string;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
};

type PhotonResponse = { features?: PhotonFeature[] };

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

// Photon `osm_value`s that describe a populated place someone would want a
// soundscape for (cities down to hamlets and named localities).
const SETTLEMENT_VALUES = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'borough',
  'suburb',
  'quarter',
  'neighbourhood',
  'locality',
  'isolated_dwelling',
]);

// Broader admin / physical places (states, regions, islands, whole countries)
// used only as a fallback when a query matches no settlement, so searching a
// region or country still resolves to something meaningful.
const ADMIN_PLACE_VALUES = new Set([
  'state',
  'region',
  'province',
  'county',
  'district',
  'country',
  'continent',
  'island',
  'archipelago',
]);

type PlaceTier = 'settlement' | 'admin' | 'other';

function placeTier(props: PhotonProperties): PlaceTier {
  const key = (props.osm_key ?? '').toLowerCase();
  const value = (props.osm_value ?? '').toLowerCase();
  if (key === 'place' && SETTLEMENT_VALUES.has(value)) return 'settlement';
  if (key === 'place' && ADMIN_PLACE_VALUES.has(value)) return 'admin';
  if (key === 'boundary' && value === 'administrative') return 'admin';
  return 'other';
}

/**
 * Build the region/country subtitle beneath a place title. Shows the state or
 * county for context (which also keeps distinct same-name places apart, e.g.
 * the many Springfields) but drops it when it merely repeats the place name
 * (so "Moscow, Moscow, Russia" stays "Moscow, Russia"). GB collapses to "UK".
 */
function buildPlaceSubtitle(props: PhotonProperties): string {
  const countryCode = props.countrycode?.trim().toLowerCase();
  const countryLabel = formatCountrySubtitle(countryCode, props.country?.trim(), '');
  const name = (props.name ?? '').trim().toLowerCase();
  const region = (props.state?.trim() || props.county?.trim() || '');

  const parts: string[] = [];
  if (region && region.toLowerCase() !== name) parts.push(region);
  if (countryLabel) parts.push(countryLabel);
  return parts.join(', ');
}

/** Loose comma-joined context string (feeds trait inference and slug/name). */
function buildDisplayName(props: PhotonProperties): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const part of [props.name, props.district, props.city, props.county, props.state, props.country]) {
    const value = part?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(value);
  }
  return parts.join(', ');
}

function mapFeature(feature: PhotonFeature): GeocodeResult | null {
  const props = feature.properties ?? {};
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const shortName = props.name?.trim();
  if (!shortName) return null;

  const countryCode = props.countrycode?.trim().toLowerCase();
  const osmType = props.osm_type?.trim() ?? '';
  const placeId = props.osm_id != null ? `${osmType}${props.osm_id}` : `${lat.toFixed(5)},${lng.toFixed(5)}`;
  // Map Photon's osm_key/osm_value onto the class/type fields the procedural
  // generator and place-naming already read from Nominatim (place/city etc.),
  // so downstream soundscape inference is unchanged.
  const placeClass = props.osm_key?.trim();
  const placeType = props.osm_value?.trim();

  return {
    lat,
    lng,
    displayName: buildDisplayName(props),
    placeId,
    shortName,
    subtitle: buildPlaceSubtitle(props),
    type: placeType,
    class: placeClass,
    addresstype: placeType,
    countryCode,
    countryName: props.country?.trim(),
  };
}

/**
 * Fetch up to five real places for a query via Photon (OpenStreetMap, no API
 * key). Keeps genuine settlements (cities, towns, villages) and drops streets,
 * house numbers and POIs, which is what let junk like "Ho Chi Min, Australia"
 * (a bush track) leak through before. Falls back to admin areas, then to the
 * raw matches, so region/country searches and the occasional landmark-only
 * query still resolve rather than dead-ending.
 */
export async function fetchGeocodeResults(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const url = new URL(PHOTON_SEARCH);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('limit', String(PHOTON_FETCH_LIMIT));

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Geocode failed (${response.status})`);
  }

  const data = (await response.json()) as PhotonResponse;
  const features = data.features ?? [];

  const settlements: GeocodeResult[] = [];
  const admin: GeocodeResult[] = [];
  const other: GeocodeResult[] = [];
  for (const feature of features) {
    const result = mapFeature(feature);
    if (!result) continue;
    const tier = placeTier(feature.properties ?? {});
    if (tier === 'settlement') settlements.push(result);
    else if (tier === 'admin') admin.push(result);
    else other.push(result);
  }

  // Prefer real settlements; only widen to admin areas or raw matches when no
  // settlement matched, so a good query is never diluted by lesser results.
  const chosen = settlements.length > 0 ? settlements : admin.length > 0 ? admin : other;

  // De-dupe on the OSM object id (unique per place) rather than the label, so
  // genuinely distinct same-name places (the many Springfields) all survive
  // while any repeated object is dropped.
  const seen = new Set<string>();
  const deduped: GeocodeResult[] = [];
  for (const result of chosen) {
    if (seen.has(result.placeId)) continue;
    seen.add(result.placeId);
    deduped.push(result);
    if (deduped.length >= MAX_RESULTS) break;
  }
  return deduped;
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
