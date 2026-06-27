import {
  PROCEDURAL_ENVIRONMENT_ID,
  registerProceduralRegion,
} from '../data/environments';
import type { BedSound, Region, SoundDef, SoundType, VariantTag } from '../data/types';
import { createRng, type Rng } from './seededRandom';

/**
 * Procedural recipe assembly for arbitrary searched locations.
 *
 * Instead of snapping a searched place onto one of a handful of curated
 * templates, this infers climate / biome / urban-vs-nature / coastal traits
 * from the place metadata and composes a layered soundscape from the
 * categorised pools. The layers reference the canonical global sound ids (so
 * existing icon art + palette behaviour keep working) but carry a `type` and
 * place-derived `variantTags`, so the location-seeded picker gives each place a
 * bespoke combination of actual clips.
 */

export type GeocodeContextLite = {
  type?: string;
  class?: string;
  addresstype?: string;
  displayName?: string;
  countryCode?: string;
};

export type ProceduralLocationInfo = {
  name: string;
  lat: number;
  lng: number;
  placeId?: string;
  geocode?: GeocodeContextLite;
};

type Climate = 'tropical' | 'temperate' | 'cold';

const EUROPE = new Set([
  'ad', 'al', 'at', 'ba', 'be', 'bg', 'by', 'ch', 'cy', 'cz', 'de', 'dk', 'ee', 'es', 'fi', 'fr',
  'gb', 'gr', 'hr', 'hu', 'ie', 'is', 'it', 'li', 'lt', 'lu', 'lv', 'mc', 'md', 'me', 'mk', 'mt',
  'nl', 'no', 'pl', 'pt', 'ro', 'rs', 'se', 'si', 'sk', 'sm', 'ua', 'uk', 'va', 'xk',
]);
const AMERICAS = new Set([
  'ar', 'bo', 'br', 'ca', 'cl', 'co', 'cr', 'cu', 'do', 'ec', 'gt', 'gy', 'hn', 'ht', 'jm', 'mx',
  'ni', 'pa', 'pe', 'pr', 'py', 'sr', 'sv', 'us', 'uy', 've',
]);
const PACIFIC = new Set(['au', 'fj', 'nc', 'nz', 'pg', 'sb', 'to', 'vu', 'ws']);
const ASIA = new Set([
  'bd', 'bn', 'bt', 'cn', 'id', 'in', 'jp', 'kh', 'kr', 'la', 'lk', 'mm', 'mn', 'my', 'np', 'ph',
  'sg', 'th', 'tw', 'vn',
]);

function climateForLat(lat: number): Climate {
  const abs = Math.abs(lat);
  if (abs < 23.5) return 'tropical';
  if (abs < 50) return 'temperate';
  return 'cold';
}

function regionTagForCountry(cc: string | undefined, lng: number): VariantTag {
  const code = cc?.toLowerCase();
  if (code) {
    if (EUROPE.has(code)) return 'european';
    if (AMERICAS.has(code)) return 'americas';
    if (PACIFIC.has(code)) return code === 'nz' ? 'nz' : 'pacific';
    if (ASIA.has(code)) return 'asian';
  }
  // Longitude fallback when country code is absent.
  if (lng >= -30 && lng <= 60) return 'european';
  if (lng < -30) return 'americas';
  return 'asian';
}

type Traits = {
  climate: Climate;
  regionTag: VariantTag;
  urban: boolean;
  coastal: boolean;
  riverine: boolean;
  mountain: boolean;
  forest: boolean;
  arid: boolean;
};

function inferTraits(info: ProceduralLocationInfo): Traits {
  const g = info.geocode ?? {};
  const haystack = [info.name, g.displayName, g.type, g.class, g.addresstype]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Only treat genuinely city-scale places as urban. Small settlements
  // (town/village/hamlet) read as nature-leaning so mountain/forest towns like
  // Banff don't get a city-traffic bed.
  const urbanClass = /\bcity\b|metropolis|downtown|suburb|borough/.test(
    `${g.class ?? ''} ${g.type ?? ''} ${g.addresstype ?? ''}`,
  );

  return {
    climate: climateForLat(info.lat),
    regionTag: regionTagForCountry(g.countryCode, info.lng),
    urban: urbanClass || /city|downtown|metro|urban/.test(haystack),
    coastal: /coast|beach|bay|harbour|harbor|port|island|\bsea\b|ocean|cape|gulf|shore|seaside|marina/.test(haystack),
    riverine: /river|lake|delta|loch|reservoir|fjord|canal|creek|stream|pond|wetland|marsh/.test(haystack),
    mountain: /mountain|peak|\balp|ridge|summit|valley|highland|\bmont|\bmount\b|massif/.test(haystack),
    forest: /forest|wood|jungle|rainforest|\bpark\b|reserve|nature|bush|grove/.test(haystack),
    arid: /desert|dune|sahara|outback|arid|steppe/.test(haystack),
  };
}

type LayerSpec = {
  id: string;
  name: string;
  category: SoundDef['category'];
  type: SoundType;
  keywords: string[];
  volume: number;
  bed: boolean;
};

export function buildProceduralRegion(info: ProceduralLocationInfo): Region {
  const traits = inferTraits(info);
  const slug = info.placeId
    ? `place-${info.placeId}`
    : `geo-${info.lat.toFixed(3)}_${info.lng.toFixed(3)}`;
  const regionId = `procedural-${slug}`;
  const seed = regionId;
  const rng = createRng(seed);

  const habitatTags: VariantTag[] = [traits.climate, traits.regionTag];
  if (traits.coastal) habitatTags.push('coastal');
  if (traits.mountain) habitatTags.push('mountain', 'alpine');
  if (traits.forest) habitatTags.push('forest', 'woodland');
  if (traits.urban) habitatTags.push('urban');
  if (traits.climate === 'cold') habitatTags.push('cold');
  if (traits.climate === 'temperate') habitatTags.push('temperate');

  const layers: LayerSpec[] = [];
  const add = (layer: LayerSpec) => layers.push(layer);

  // ---- base bed ----
  if (traits.urban) {
    add({ id: 'global-traffic', name: 'City Hum', category: 'ambient', type: 'city-hum', keywords: ['city', 'urban', 'traffic'], volume: 0.5, bed: true });
    add({ id: 'global-wind', name: 'Street Breeze', category: 'ambient', type: 'wind', keywords: ['wind', 'breeze', 'urban'], volume: 0.4, bed: !traits.coastal });
  } else {
    add({ id: 'global-wind', name: 'Wind', category: 'ambient', type: 'wind', keywords: ['wind', 'breeze'], volume: 0.5, bed: true });
    // Woodland reads well for any non-arid wild place, including cold boreal /
    // alpine towns (Banff, Lapland) that sit among conifer forest.
    if (!traits.arid) {
      add({ id: 'global-forest', name: 'Woodland', category: 'ambient', type: 'forest', keywords: ['forest', 'rustle', 'trees'], volume: 0.46, bed: true });
    }
  }

  // ---- water ----
  if (traits.coastal) {
    add({ id: 'global-surf', name: 'Surf', category: 'water', type: 'waves', keywords: ['surf', 'ocean', 'waves', 'coast'], volume: 0.62, bed: true });
    add({ id: 'global-gull', name: 'Seabirds', category: 'bird', type: 'seabird', keywords: ['gull', 'seabird', 'coast'], volume: 0.42, bed: false });
  } else if (traits.mountain || (traits.climate === 'cold' && !traits.arid)) {
    // Mountain/cold places get a snowmelt mountain stream as a bed layer.
    add({ id: 'global-stream', name: 'Mountain Stream', category: 'water', type: 'stream', keywords: ['stream', 'water', 'river', 'brook', 'mountain'], volume: 0.5, bed: true });
  } else if (traits.riverine) {
    add({ id: 'global-stream', name: 'Stream', category: 'water', type: 'stream', keywords: ['stream', 'water', 'river', 'brook'], volume: 0.5, bed: true });
  } else if (!traits.arid && rng() > 0.5) {
    add({ id: 'global-stream', name: 'Brook', category: 'water', type: 'stream', keywords: ['stream', 'water', 'brook'], volume: 0.44, bed: false });
  }

  // ---- birds ----
  // Tropical-only species (canopy birds, primates) are gated strictly to
  // tropical, non-urban places so cold/temperate scenes never get them.
  if (traits.climate === 'tropical' && !traits.urban) {
    add({ id: 'global-tropical-bird', name: 'Tropical Birds', category: 'bird', type: 'tropical-bird', keywords: ['bird', 'tropical', 'jungle'], volume: 0.52, bed: true });
    if (traits.forest && rng() > 0.4) {
      add({ id: 'global-jungle-primates', name: 'Canopy Calls', category: 'bird', type: 'primates', keywords: ['monkey', 'primate', 'jungle'], volume: 0.4, bed: false });
    }
  } else {
    add({ id: 'global-songbird', name: 'Songbirds', category: 'bird', type: 'songbird', keywords: ['bird', 'songbird', 'dawn'], volume: 0.5, bed: true });
  }

  // ---- insects / frogs (warm climates) ----
  if (traits.climate !== 'cold' && !traits.arid) {
    add({ id: 'global-insects', name: 'Insects', category: 'insect', type: 'insects', keywords: ['insects', 'crickets', 'cicadas', 'evening'], volume: 0.16, bed: false });
  }
  if (traits.climate === 'tropical' && (traits.riverine || traits.forest)) {
    add({ id: 'global-frogs', name: 'Frogs', category: 'insect', type: 'frogs', keywords: ['frogs', 'night', 'wetland'], volume: 0.3, bed: false });
  }

  // ---- always-available palette options ----
  add({ id: 'global-rain', name: 'Rain', category: 'ambient', type: 'rain', keywords: ['rain', 'shower', 'storm', 'weather'], volume: 0.42, bed: false });
  add({ id: 'global-night-owl', name: 'Night Owl', category: 'bird', type: 'owl', keywords: ['owl', 'night', 'nocturnal'], volume: 0.42, bed: false });

  // De-dupe by id (urban + coastal can both want wind, etc.).
  const seenIds = new Set<string>();
  const sounds: SoundDef[] = [];
  const bedSounds: BedSound[] = [];
  for (const layer of layers) {
    if (seenIds.has(layer.id)) continue;
    seenIds.add(layer.id);
    sounds.push({
      id: layer.id,
      name: layer.name,
      category: layer.category,
      type: layer.type,
      variantTags: habitatTags,
      src: '',
      loop: true,
      keywords: layer.keywords,
    });
    if (layer.bed) {
      bedSounds.push({ soundId: layer.id, volume: layer.volume });
    }
  }

  return {
    id: regionId,
    name: info.name,
    sounds,
    bedSounds,
    seed,
    tags: habitatTags,
    procedural: true,
  };
}

/** Build, register, and return ids for a searched location's bespoke scene. */
export function resolveProceduralSoundscape(info: ProceduralLocationInfo): {
  environmentId: string;
  regionId: string;
} {
  const region = buildProceduralRegion(info);
  registerProceduralRegion(region);
  return { environmentId: PROCEDURAL_ENVIRONMENT_ID, regionId: region.id };
}

export type { Rng };
