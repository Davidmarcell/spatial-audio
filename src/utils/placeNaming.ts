/**
 * Prefer city / town / region labels over micro-POIs (plaques, memorials, etc.)
 * when resolving coordinates or geocode results for display.
 */

export type PlaceAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  borough?: string;
  suburb?: string;
  city_district?: string;
  county?: string;
  state?: string;
  state_district?: string;
  region?: string;
  country?: string;
  country_code?: string;
};

export type PlaceNameContext = {
  /** Raw Nominatim `name` or first segment of `display_name`. */
  primaryName?: string;
  displayName?: string;
  type?: string;
  class?: string;
  addresstype?: string;
  address?: PlaceAddress;
  /** When set, keep `primaryName` if it closely matches the user's search. */
  searchQuery?: string;
};

const MICRO_POI =
  /\b(memorial|plaque|monument|artwork|sculpture|statue|information|attraction|historic|tourism|benchmark|survey|mileage|marker|wayside|viewpoint|memorial|headstone|grave|tomb|fountain|mural|bench|signpost|guidepost)\b/i;

const ADMIN_PLACE =
  /\b(city|town|village|hamlet|municipality|borough|suburb|district|county|state|region|country|locality|administrative)\b/i;

function normalise(value: string | undefined): string {
  return value?.trim() ?? '';
}

function isMicroPoi(ctx: PlaceNameContext): boolean {
  const haystack = [
    ctx.primaryName,
    ctx.type,
    ctx.class,
    ctx.addresstype,
  ]
    .map(normalise)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) return false;
  if (MICRO_POI.test(haystack)) return true;

  // Named POIs that are not admin areas and carry a specific `name` field.
  const addressType = normalise(ctx.addresstype).toLowerCase();
  const placeClass = normalise(ctx.class).toLowerCase();
  if (
    placeClass &&
    !ADMIN_PLACE.test(`${placeClass} ${addressType}`) &&
    /^(amenity|tourism|historic|man_made|natural)$/.test(placeClass)
  ) {
    return true;
  }

  return false;
}

/** Largest settlement or admin area available in a Nominatim address block. */
export function pickPlaceFromAddress(address: PlaceAddress | undefined): string | null {
  if (!address) return null;

  const candidates = [
    address.city,
    address.town,
    address.municipality,
    address.borough,
    address.village,
    address.city_district,
    address.suburb,
    address.hamlet,
    address.state,
    address.state_district,
    address.region,
    address.county,
  ];

  for (const candidate of candidates) {
    const value = normalise(candidate);
    if (value) return value;
  }

  return normalise(address.country) || null;
}

function pickFromDisplayName(displayName: string | undefined): string | null {
  if (!displayName) return null;
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  // Walk past leading micro-POI segments toward a settlement label.
  for (const part of parts) {
    if (MICRO_POI.test(part)) continue;
    if (part.length >= 2) return part;
  }

  return parts[0] ?? null;
}

function userSearchedForPrimary(ctx: PlaceNameContext): boolean {
  const query = normalise(ctx.searchQuery).toLowerCase();
  const primary = normalise(ctx.primaryName).toLowerCase();
  if (!query || !primary) return false;
  if (query === primary) return true;
  if (primary.includes(query) || query.includes(primary)) return true;
  return false;
}

export type ResolvedPlaceLabel = {
  shortName: string;
  /** Region / country line beneath the title (not a full postal address). */
  subtitle: string;
};

export function formatCountrySubtitle(
  countryCode: string | undefined,
  countryName: string | undefined,
  fallbackSubtitle: string,
): string {
  if (countryCode?.toLowerCase() === 'gb') return 'UK';
  if (countryName) return countryName;
  return fallbackSubtitle;
}

function subtitleFromAddress(
  address: PlaceAddress | undefined,
  shortName: string,
  displayName: string | undefined,
): string {
  const countryCode = normalise(address?.country_code).toLowerCase();
  const countryName = normalise(address?.country);

  const parts = (displayName ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const remainder = parts.filter((part) => part !== shortName);
  const fallback = remainder.slice(0, 2).join(', ');

  return formatCountrySubtitle(countryCode || undefined, countryName || undefined, fallback);
}

/**
 * Resolve a human-facing place title from geocode metadata.
 * Prefers city → region → country; skips obscure POI names unless the user
 * explicitly searched for them.
 */
export function resolvePlaceDisplayName(ctx: PlaceNameContext): ResolvedPlaceLabel {
  const primary = normalise(ctx.primaryName);
  const fromAddress = pickPlaceFromAddress(ctx.address);
  const fromDisplay = pickFromDisplayName(ctx.displayName);

  let shortName = primary || fromAddress || fromDisplay || 'My location';

  if (
    isMicroPoi(ctx) &&
    !userSearchedForPrimary(ctx) &&
    (fromAddress || fromDisplay)
  ) {
    shortName = fromAddress ?? fromDisplay ?? shortName;
  } else if (!primary && fromAddress) {
    shortName = fromAddress;
  } else if (!primary && fromDisplay) {
    shortName = fromDisplay;
  }

  const subtitle = subtitleFromAddress(ctx.address, shortName, ctx.displayName);

  return { shortName, subtitle };
}
