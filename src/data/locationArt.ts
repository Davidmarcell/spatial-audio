import { pickHeroArt } from './iconArt';
import { getRegion } from './environments';
import type { VariantTag } from './types';

/** Hero thumbnail art for curated locations (Met / NYPL / Wikimedia). */
export type LocationArtEntry = {
  src: string;
  globeSrc?: string;
  title: string;
  author: string;
  sourceUrl: string;
};

const locationArtByKey: Record<string, LocationArtEntry> = {
  'nz-forest:auckland': {
    src: '/icons/auckland-government-house.jpg',
    title: 'First Government House, Auckland',
    author: 'Edward Ashworth (c. 1842-1843), Alexander Turnbull Library / National Library of New Zealand',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:First_Government_House,_Auckland.jpg',
  },
  'urban-europe:london': {
    src: '/icons/met/489985.jpg',
    globeSrc: '/icons/globe/489985.jpg',
    title: 'Rain Landscape',
    author: 'Vasily Kandinsky',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/489985',
  },
  'urban-americas:bed-stuy': {
    src: '/icons/brooklyn-washington-square.jpg',
    title: 'Washington Square',
    author: 'William Glackens (1912)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Washington_Square,_by_William_Glackens.png',
  },
  'brazil-coast:rio-de-janeiro': {
    src: '/icons/rio-sugarloaf-colour.jpg',
    title: 'Pão de Açúcar (Sugarloaf over Guanabara Bay)',
    author: 'Jules Marie Vincent de Sinety (watercolour)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Jules_Marie_Vincent_de_Sinety_-_P%C3%A3o_de_A%C3%A7%C3%BAcar.jpg',
  },
};

/**
 * Globe polaroid / list art keyed by worldLocations.id (incl. procedural pins).
 * Only region-appropriate plates with correct, verified captions live here; pins
 * without an entry fall through to the procedural hero resolver below, which
 * picks a climate/region-appropriate landscape from the icon pools. This removed
 * the old contradictory captions (a Seville "Landscape" that was actually a
 * Hiroshige rain print, a Marrakech "Desert Scene" that was a New-England river
 * view).
 */
const globePinArtById: Record<string, LocationArtEntry> = {
  lisbon: {
    src: '/icons/lisbon-tejo.png',
    title: 'Vista da cidade de Lisboa desde o Rio Tejo (view of Lisbon from the Tagus)',
    author: 'Portuguese school, 19th century',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Vista_da_cidade_de_Lisboa_desde_o_Rio_Tejo_-_escola_portuguesa,_s%C3%A9c._XIX.png',
  },
  istanbul: {
    src: '/icons/istanbul-bosphorus.jpg',
    title: 'View of Constantinople and the Bosphorus',
    author: 'Ivan Aivazovsky (1856)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Aivazovsky_-_View_of_Constantinople_and_the_Bosphorus.jpg',
  },
  havana: {
    src: '/icons/havana-harbour-entrance.jpg',
    title: 'Havana seen from the harbour entrance (Album Pintoresco de la Isla de Cuba)',
    author: 'B. May & Compañía, Havana; printed by Storch & Kramer, Berlin (1855)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:1855_Tomada_desde_la_entrade_del_puerto_Habana_Cuba_11398004.jpg',
  },
  monteverde: {
    src: '/icons/monteverde-tropics.jpg',
    title: 'Rainy Season in the Tropics (cloud-forest cordillera)',
    author: 'Frederic Edwin Church (1866)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Frederic_Edwin_Church_-_Rainy_Season_in_the_Tropics_-_Google_Art_Project.jpg',
  },
  paris: {
    src: '/icons/met/437310.jpg',
    title: 'The Boulevard Montmartre on a Winter Morning',
    author: 'Camille Pissarro (1897)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/437310',
  },
  serengeti: {
    src: '/icons/serengeti-hwandoni-hills.jpg',
    title: 'Hwandoni Hills (East African highland-plain vista)',
    author: 'Akseli Gallen-Kallela (1910)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Akseli_Gallen-Kallela_Hwandoni_Hills.tif',
  },
  'swiss-alps': {
    src: '/icons/swiss-alps-matterhorn.jpg',
    title: 'The Matterhorn',
    author: 'Albert Bierstadt (c. 1867), Dallas Museum of Art',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Albert_Bierstadt_-_The_Matterhorn_-_1971.72_-_Dallas_Museum_of_Art.jpg',
  },
  'cape-town': {
    src: '/icons/cape-town-table-bay-colour.jpg',
    title: 'View of Cape Town, Table Bay, Cape of Good Hope',
    author: 'Thomas Whitcombe (oil painting)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Thomas_Whitcombe_-_View_of_Cape_Town,_Table_Bay,_Cape_of_Good_Hope.jpg',
  },
  kyoto: {
    src: '/icons/kyoto-kamo-river.jpg',
    title:
      'Cooling off in the Evening at Shijogawara, from Famous Places of Kyōto (Kyoto meisho no uchi)',
    author: 'Utagawa Hiroshige (c. 1834)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:%E4%BA%AC%E9%83%BD%E5%90%8D%E6%89%80%E4%B9%8B%E5%86%85_%E5%9B%9B%E6%9D%A1%E6%B2%B3%E5%8E%9F%E5%A4%95%E6%B6%BC-Cooling_off_in_the_Evening_at_Shijogawara_MET_DP120470.jpg',
  },
  redwoods: {
    src: '/icons/redwoods-bierstadt.jpg',
    title: 'Giant Redwood Trees of California',
    author: 'Albert Bierstadt (1874), The Berkshire Museum',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Albert_Bierstadt_-_Giant_Redwood_Trees_of_California_-_Google_Art_Project.jpg',
  },
  queenstown: {
    src: '/icons/queenstown-wakatipu.jpg',
    title: 'Lake Wakatipu with Mount Earnslaw, Middle Island, New Zealand',
    author: 'Eugène von Guérard (1877–79)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Eug%C3%A8ne_von_Gu%C3%A9rard_-_Lake_Wakatipu_with_Mount_Earnslaw,_Middle_Island,_New_Zealand_-_Google_Art_Project.jpg',
  },
  oaxaca: {
    src: '/icons/oaxaca-valley-of-mexico.jpg',
    title: 'The Valley of Mexico from the Santa Isabel Mountain Range',
    author: 'José María Velasco (1877)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Jos%C3%A9_Mar%C3%ADa_Velasco_-_The_Valley_of_Mexico_from_the_Santa_Isabel_Mountain_Range_-_Google_Art_Project.jpg',
  },
  bariloche: {
    src: '/icons/bariloche-andes-aconcagua.jpg',
    title:
      'Two Leagues from Santa Rosa de Los Andes, with the Andes and Aconcagua (central Andes vista, stand-in for the Nahuel Huapi cordillera)',
    author: 'Edward Gennys Fanshawe (1851)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Edward_Gennys_Fanshawe,_Two_Leagues_from_Santa_Rosa_(de_Los_Andes,_Chile),_Jany_14th_1851_(with_the_Andes_and_Aconcagua).jpg',
  },
  himalayas: {
    src: '/icons/himalayas-kangchenjunga.jpg',
    title: 'Kangchenjunga from Darjeeling',
    author: 'Edward Lear (1879)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Edward_Lear_-_Kangchenjunga_from_Darjeeling_-_Google_Art_Project.jpg',
  },
  sydney: {
    src: '/icons/sydney-harbour.jpg',
    title: 'View of Sydney Harbour showing Sydney Cove',
    author: 'Conrad Martens (c. 1850s)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Conrad_Martens_-_View_of_Sydney_Harbour_showing_Sydney_Cove_-_Google_Art_Project.jpg',
  },
  bali: {
    src: '/icons/bali-temple-watercolour.jpg',
    title: 'Balinese temple courtyard with meru shrines (watercolour of a temple on Bali)',
    author: 'Tropenmuseum / Nationaal Museum van Wereldculturen',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:COLLECTIE_TROPENMUSEUM_Aquarel_voorstellend_een_tempel_op_Bali_TMnr_3204-104.jpg',
  },
  bangkok: {
    src: '/icons/bangkok-clark-aquatint.jpg',
    title: 'View of Bangkok (coloured aquatint on the Chao Phraya river)',
    author: 'John Heaviside Clark, after H.A.C.; published by Henry Colburn, London (1828)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:View_of_Bangkok_by_John_Heaviside_Clark_1828_Colored.jpg',
  },
  lapland: {
    src: '/icons/lapland-landscape.jpg',
    title: 'Landscape from Lapland',
    author: 'Torsten Wasastjerna',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Torsten_Wasastjerna_-_Landscape_from_Lapland.jpg',
  },
};

/** Ordered pool preferences for the procedural hero, by dominant scene trait. */
function heroPoolOrder(tags: Set<VariantTag>): string[] {
  if (tags.has('coastal') || tags.has('beach')) return ['surf', 'rain', 'forest', 'wind'];
  if (tags.has('alpine') || tags.has('mountain')) return ['stream', 'wind', 'forest', 'rain'];
  if (tags.has('urban')) return ['rain', 'nyc-breeze', 'forest', 'traffic'];
  if (tags.has('forest') || tags.has('woodland') || tags.has('rainforest')) {
    return ['forest', 'stream', 'wind', 'rain'];
  }
  if (tags.has('arid')) return ['wind', 'forest', 'rain'];
  return ['forest', 'wind', 'stream', 'surf', 'rain'];
}

/**
 * Region/climate-appropriate hero for searched/geo pins (and curated pins without
 * a bespoke hero). Pulls a landscape plate from the icon pools using the scene's
 * flavour tags, so the attribution is always correct (it comes straight from the
 * pool entry) and the art suits the place.
 */
export function getProceduralHeroArt(item: {
  id?: string;
  environmentId: string;
  regionId: string;
}): LocationArtEntry | null {
  const region = getRegion(item.environmentId, item.regionId);
  const tags = region?.tags ?? [];
  const seed = item.id ?? `${item.environmentId}:${item.regionId}`;
  const entry = pickHeroArt(seed, heroPoolOrder(new Set(tags)), tags);
  if (!entry) return null;
  return {
    src: entry.src,
    title: entry.title,
    author: entry.author,
    sourceUrl: entry.sourceUrl,
  };
}

export function getLocationArt(
  environmentId: string,
  regionId: string,
): LocationArtEntry | null {
  return locationArtByKey[`${environmentId}:${regionId}`] ?? null;
}

export function getLocationArtForItem(item: {
  id?: string;
  environmentId: string;
  regionId: string;
}): LocationArtEntry | null {
  if (item.id && globePinArtById[item.id]) {
    return globePinArtById[item.id];
  }
  return (
    getLocationArt(item.environmentId, item.regionId) ?? getProceduralHeroArt(item)
  );
}
