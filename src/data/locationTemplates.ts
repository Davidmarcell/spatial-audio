import { findNearestRegion, type GeoCoords } from '../utils/geo';
import type { GeocodeResult } from '../utils/geocode';
import { worldLocations } from './worldLocations';

export type SoundscapeTemplate = {
  environmentId: string;
  regionId: string;
};

const TEMPLATES = {
  americasUrban: { environmentId: 'urban-americas', regionId: 'bed-stuy' },
  europeUrban: { environmentId: 'urban-europe', regionId: 'london' },
  coastalAmericas: { environmentId: 'brazil-coast', regionId: 'rio-de-janeiro' },
  coastalEurope: { environmentId: 'urban-europe', regionId: 'london' },
  forestPacific: { environmentId: 'nz-forest', regionId: 'nz-forest-general' },
  forestEurope: { environmentId: 'alpine-europe', regionId: 'dolomites' },
  alpine: { environmentId: 'alpine-europe', regionId: 'dolomites' },
  tropical: { environmentId: 'southeast-asia', regionId: 'chiang-mai' },
  rainforest: { environmentId: 'costa-rica-rainforest', regionId: 'pacific-slope' },
  pacificUrban: { environmentId: 'nz-forest', regionId: 'auckland' },
} as const satisfies Record<string, SoundscapeTemplate>;

type TemplateKind = 'urban' | 'coastal' | 'forest' | 'alpine' | 'tropical' | 'rainforest';

type GeocodeContext = Pick<
  GeocodeResult,
  'type' | 'class' | 'addresstype' | 'displayName' | 'countryCode'
>;

const EUROPE_COUNTRY_CODES = new Set([
  'ad', 'al', 'at', 'ba', 'be', 'bg', 'by', 'ch', 'cy', 'cz', 'de', 'dk', 'ee', 'es', 'fi', 'fr',
  'gb', 'gr', 'hr', 'hu', 'ie', 'is', 'it', 'li', 'lt', 'lu', 'lv', 'mc', 'md', 'me', 'mk', 'mt',
  'nl', 'no', 'pl', 'pt', 'ro', 'rs', 'se', 'si', 'sk', 'sm', 'ua', 'uk', 'va', 'xk',
]);

const AMERICAS_COUNTRY_CODES = new Set([
  'ag', 'ai', 'ar', 'aw', 'bb', 'bl', 'bm', 'bo', 'bq', 'br', 'bs', 'bz', 'ca', 'cl', 'co', 'cr',
  'cu', 'cw', 'dm', 'do', 'ec', 'fk', 'gd', 'gf', 'gp', 'gt', 'gy', 'hn', 'ht', 'jm', 'kn', 'ky',
  'lc', 'mf', 'mq', 'ms', 'mx', 'ni', 'pa', 'pe', 'pm', 'pr', 'py', 'sr', 'sv', 'tc', 'tt', 'us',
  'uy', 'vc', 've', 'vg', 'vi',
]);

const PACIFIC_COUNTRY_CODES = new Set(['au', 'fj', 'nc', 'nz', 'pg', 'sb', 'to', 'vu', 'ws']);

const SOUTHEAST_ASIA_COUNTRY_CODES = new Set([
  'bn', 'id', 'kh', 'la', 'mm', 'my', 'ph', 'sg', 'th', 'tl', 'vn',
]);

const RAINFOREST_COUNTRY_CODES = new Set(['cr', 'gt', 'hn', 'ni', 'pa', 'bz', 'co', 'ec', 'pe', 'bo']);

function inferTemplateKind(result: Pick<GeocodeResult, 'type' | 'class' | 'addresstype'>): TemplateKind | null {
  const haystack = [result.type, result.class, result.addresstype]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) return null;

  if (/city|town|village|hamlet|metropolis|suburb|neighbourhood|neighborhood|district|urban|municipality/.test(haystack)) {
    return 'urban';
  }
  if (/coast|beach|bay|harbour|harbor|port|island|sea|ocean/.test(haystack)) {
    return 'coastal';
  }
  if (/forest|wood|jungle|rainforest|national_park|park|nature/.test(haystack)) {
    if (/rainforest|jungle|tropical/.test(haystack)) return 'rainforest';
    return 'forest';
  }
  if (/mountain|peak|alpine|ridge|summit|valley/.test(haystack)) {
    return 'alpine';
  }
  if (/tropical|thailand|southeast|humid/.test(haystack)) {
    return 'tropical';
  }

  return null;
}

function normalizeCountryCode(countryCode?: string): string | null {
  if (!countryCode) return null;
  const normalized = countryCode.trim().toLowerCase();
  return normalized || null;
}

/** Fallback when Nominatim omits country_code (addressdetails off or sparse result). */
function inferCountryCodeFromDisplayName(displayName: string): string | null {
  const lower = displayName.toLowerCase();
  if (/\b(united kingdom|england|scotland|wales|northern ireland)\b/.test(lower)) return 'gb';
  if (/\b(united states|u\.s\.a\.|usa)\b/.test(lower)) return 'us';
  if (/\bnew zealand\b/.test(lower)) return 'nz';
  if (/\bbrazil\b/.test(lower)) return 'br';
  if (/\bthailand\b/.test(lower)) return 'th';
  if (/\bcosta rica\b/.test(lower)) return 'cr';
  if (/\baustralia\b/.test(lower)) return 'au';
  if (/\b(germany|france|italy|spain|netherlands|belgium|austria|switzerland|poland|sweden|norway|denmark|finland|portugal|ireland|czechia|hungary|romania|greece)\b/.test(lower)) {
    return 'eu';
  }
  return null;
}

function resolveCountryCode(result?: GeocodeContext): string | null {
  if (!result) return null;
  return normalizeCountryCode(result.countryCode)
    ?? inferCountryCodeFromDisplayName(result.displayName);
}

function resolveRegionalTemplate(countryCode: string, kind: TemplateKind): SoundscapeTemplate {
  const cc = countryCode === 'eu' ? 'de' : countryCode;

  if (EUROPE_COUNTRY_CODES.has(cc)) {
    switch (kind) {
      case 'urban':
      case 'coastal':
        return TEMPLATES.europeUrban;
      case 'forest':
        return TEMPLATES.forestEurope;
      case 'alpine':
        return TEMPLATES.alpine;
      case 'tropical':
      case 'rainforest':
        return TEMPLATES.forestEurope;
    }
  }

  if (AMERICAS_COUNTRY_CODES.has(cc)) {
    switch (kind) {
      case 'urban':
        return TEMPLATES.americasUrban;
      case 'coastal':
        return cc === 'us' || cc === 'ca' ? TEMPLATES.americasUrban : TEMPLATES.coastalAmericas;
      case 'forest':
        return RAINFOREST_COUNTRY_CODES.has(cc) ? TEMPLATES.rainforest : TEMPLATES.forestPacific;
      case 'alpine':
        return TEMPLATES.alpine;
      case 'tropical':
      case 'rainforest':
        return RAINFOREST_COUNTRY_CODES.has(cc) ? TEMPLATES.rainforest : TEMPLATES.tropical;
    }
  }

  if (PACIFIC_COUNTRY_CODES.has(cc)) {
    switch (kind) {
      case 'urban':
      case 'coastal':
        return TEMPLATES.pacificUrban;
      case 'forest':
      case 'alpine':
        return TEMPLATES.forestPacific;
      case 'tropical':
      case 'rainforest':
        return TEMPLATES.rainforest;
    }
  }

  if (SOUTHEAST_ASIA_COUNTRY_CODES.has(cc)) {
    return TEMPLATES.tropical;
  }

  if (RAINFOREST_COUNTRY_CODES.has(cc)) {
    return TEMPLATES.rainforest;
  }

  if (cc === 'br') {
    return kind === 'urban' || kind === 'coastal' ? TEMPLATES.coastalAmericas : TEMPLATES.rainforest;
  }

  if (cc === 'nz') {
    return kind === 'urban' || kind === 'coastal' ? TEMPLATES.pacificUrban : TEMPLATES.forestPacific;
  }

  return TEMPLATES.forestPacific;
}

/** Pick builtin soundscape from place metadata, or nearest curated globe pin. */
export function resolveSoundscapeForGeocode(
  coords: GeoCoords,
  result?: GeocodeContext,
): SoundscapeTemplate {
  const kind = result ? inferTemplateKind(result) : null;
  const countryCode = resolveCountryCode(result);

  if (kind && countryCode) {
    return resolveRegionalTemplate(countryCode, kind);
  }

  if (kind) {
    const nearest = findNearestRegion(coords, worldLocations);
    if (nearest) {
      return { environmentId: nearest.environmentId, regionId: nearest.regionId };
    }
    return TEMPLATES.americasUrban;
  }

  const nearest = findNearestRegion(coords, worldLocations);
  if (nearest) {
    return { environmentId: nearest.environmentId, regionId: nearest.regionId };
  }

  return TEMPLATES.forestPacific;
}
