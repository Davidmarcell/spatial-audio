import {
  artworkAttributions as generatedArtworkAttributions,
  fixedIcons,
  iconPools,
  soundPoolMap as generatedSoundPoolMap,
  type IconPoolEntry,
} from './iconPools.generated';
import type { ArtworkAttribution } from './types';
import {
  FALLBACK_ICON_SRC,
  isLocallyBundledIconSrc,
  resolveTileIconSrc,
} from './iconDetailSrc';
import type { VariantTag } from './types';
import {
  getInsectArtOption,
  isInsectArtOverrideTarget,
  loadInsectArtOptionId,
} from '../utils/insectArtOptions';

/**
 * Sound → art rationale (curated pass):
 * - forest-stream → fixed Monsted forest-stream plate (was falling back to random forest/surf)
 * - stream/creek/brook/river sounds → stream pool (water flowing, forest banks — no figures/shore balls)
 * - surf/coastal/seabird → surf pool (beach/seascape only)
 * - wind/breeze/gust → wind pool (trees, storms — no portraits)
 * - rain/monsoon/shower → rain pool (storm/rain scenes — no city panoramas)
 * - forest/bush/canopy/park-rustle → forest or nyc-park pools
 * - traffic/harbor-traffic → traffic pool (street scenes, circus filtered out)
 * - NZ birds → species plates via nzOnlySpeciesIconAliases; global birds → gray-catbird/toucan/etc.
 */

/** NZ-only regions where native species plates apply. */
const NZ_REGION_IDS = new Set(['auckland']);

/**
 * Aliases that only apply in NZ regions (native species plates). The morepork
 * (ruru) plate is a NZ-specific species illustration, so it must only be used
 * for owl sounds inside NZ regions; everywhere else owls use the generic owl
 * pool (see `soundPoolMap` / `SEMANTIC_POOL_RULES`).
 */
const nzOnlySpeciesIconAliases: Record<string, string> = {
  'tui-forest': 'tui',
  'morepork-forest': 'morepork',
};

/** Dedicated fixed plates for specific ambient sounds. */
const fixedIconAliases: Record<string, string> = {
  'forest-stream': 'forest-stream',
};

/**
 * Regional sound ids that should reuse a named species plate. Kept deliberately
 * small: only true single-species signatures stay fixed (Costa Rican quetzal).
 * All the *generic* birds (songbird / seabird / tropical-bird / primates) now go
 * through region-diverse pools (see `soundPoolMap` below) so the same catbird /
 * gull / toucan / howler plate no longer lands on a dozen unrelated pins.
 */
const speciesIconAliases: Record<string, string> = {
  quetzal: 'quetzal',
};

/** Fixed plates not yet in generated fixedIcons. */
const extendedFixedIcons: Record<string, string> = {
  toucan: '/icons/toucan.jpg',
  // The Rio "Toucan" signature sound gets its own bespoke toco toucan plate so
  // it always shows an actual toucan (not a shared tropical-bird pool draw). The
  // generic global-tropical-bird type still uses the region-diverse pool, and
  // Oaxaca keeps the Barraband toucan.jpg, so the two toucan pins stay unique.
  'toucan-rio': '/icons/toucan-toco-gould.jpg',
  kereru: '/icons/kereru.jpg',
  // Bespoke sound plates: the surf/waves sound uses Courbet's breaking wave (a
  // pure wave, no beach figures); Auckland's Domain Park (bush) sound uses a New
  // Zealand native-forest scene rather than the shared Central Park park plate.
  surf: '/icons/waves-courbet-the-wave.jpg',
  'domain-park': '/icons/forest-otira-gorge-nz.jpg',
  // Paris: each layer gets its OWN bespoke illustration so the market / bells /
  // music tiles no longer share a single market plate. Keyed by the recipe's
  // bespoke Paris sound ids (paris-*), so nothing leaks onto other pins.
  'paris-musette': '/icons/paris-accordion-de-smet.jpg',
  'paris-cafe': '/icons/paris-cafe-beraud.jpg',
  'paris-seine': '/icons/paris-seine-jongkind.jpg',
  'paris-bells': '/icons/paris-notre-dame-delauney.jpg',
  'paris-sparrows': '/icons/paris-house-sparrow-naumann.jpg',
  'paris-cityhum': '/icons/paris-boulevard-pissarro.jpg',
  // Redwoods: the two new default corvids get their own species plates; canopy
  // and drip layers leave the generic Met forest/stream sketches for Bierstadt
  // Giant Redwoods and Mønsted's forest stream.
  'redwoods-raven': '/icons/redwoods-raven-audubon.jpg',
  'redwoods-jay': '/icons/redwoods-stellers-jay-audubon.jpg',
  'redwoods-canopy': '/icons/redwoods-bierstadt.jpg',
  'redwoods-drip': '/icons/forest-stream.jpg',
  // Kyoto: species-accurate Japanese plates (uguisu, higurashi, kajika, jungle
  // crow) plus Hiroshige for temple bells / garden waterside — keyed by the
  // bespoke kyoto-* sound ids so nothing leaks onto other Asian pins.
  'kyoto-bells': '/icons/pool/bells-temple.jpg',
  'kyoto-uguisu': '/icons/kyoto-uguisu-ishizaki.jpg',
  'kyoto-higurashi': '/icons/kyoto-higurashi-utamaro.jpg',
  'kyoto-stream': '/icons/kyoto-garden-stream-hiroshige.jpg',
  'kyoto-crows': '/icons/kyoto-jungle-crow-kyosai.jpg',
  'kyoto-frogs': '/icons/kyoto-kajika-frog.jpg',
  // Serengeti: distant elephant (Kuhnert steppe plate). Lion stays available in
  // the dock with its own Kuhnert plates via the `lion` pool / fixed mapping.
  'global-elephant': '/icons/elephant-kuhnert-steppe.jpg',
  'global-lion': '/icons/lion-kuhnert-awakening.jpg',
  // Bangkok street traffic — Kerr's Menam/Chao Phraya painting, not a Paris boulevard.
  'bangkok-traffic': '/icons/pool/street-bangkok-kerr.jpg',
  // Havana city hum — tall Obispo Street postcard (Habana Vieja), not Brooklyn.
  'havana-cityhum': '/icons/havana-obispo-street.jpg',
  // Default insect plates (live Insects chip can override these while reviewing).
  'global-insects': '/icons/cricket-field-ensifera.jpg',
  'summer-cicadas': '/icons/insect-jardine-plate.jpg',
  'sydney-cicadas': '/icons/cicada-maculata.jpg',
  // Subway (available in every big-city library) — a genre painting of the
  // sound's own subject (subway-car riders), not a generic street/traffic plate.
  'global-subway': '/icons/pool/subway-riders-mora.jpg',
};

/** Attributions for the extended fixed plates above (kept out of the generated file). */
const extendedFixedIconAttributions: ArtworkAttribution[] = [
  {
    file: '/icons/toucan-toco-gould.jpg',
    title: 'Ramphastos toco (Toco Toucan), from A Monograph of the Ramphastidae, or Family of Toucans',
    author: 'Edward Lear (drawn and lithographed) for John Gould, 1834; Houghton Library, Harvard University (Typ 805L.34)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Houghton_Typ_805L.34_-_John_Gould,_Ramphastos_toco,_1834.jpg',
  },
  {
    file: '/icons/cricket-field-ensifera.jpg',
    title: 'Cricket, from a plate of Ensifera (crickets and bush-crickets)',
    author: 'Gotthilf Heinrich von Schubert, Naturgeschichte (1886)',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ensifera_Naturgeschichte.jpg',
  },
  {
    file: '/icons/cicada-maculata.jpg',
    title: 'Illustrations of Exotic Entomology — Cicada Maculata',
    author: 'Dru Drury / John Obadiah Westwood',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Illustrations_of_Exotic_Entomology_Cicada_Maculata.jpg',
  },
  {
    file: '/icons/insect-jardine-plate.jpg',
    title: "Naturalist's Library Entomology, Plate 21 (cicada)",
    author: "Sir William Jardine (Naturalist's Library)",
    license: 'Public domain',
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Jardine_Naturalist's_library_Entomology_Plate_21.jpg",
  },
  {
    file: '/icons/insect-field-cricket-plate.jpg',
    title:
      'Locusta sexpunctata, Gryllus campestris, Gryllotalpa mitidula (plate detail)',
    author: '19th-century natural history plate (Wikimedia Commons)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Locusta_sexpunctata(grasshopper_of_six_points),_Gryllus_campestris(field_crickets),_Gryllotalpa_mitidula(Australian_Crickets).jpg',
  },
  {
    file: '/icons/insect-natural-history.jpg',
    title:
      'Natural history of the animal kingdom for the use of young people (Plate XXIV)',
    author: 'W. F. Kirby / public-domain plate',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Natural_history_of_the_animal_kingdom_for_the_use_of_young_people_(Plate_XXIV)_(5974465081).jpg',
  },
  {
    file: '/icons/lion-kuhnert-awakening.jpg',
    title: 'Des Löwen Erwachen (The Lion Awakens)',
    author: 'Wilhelm Kuhnert (before 1929)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Wilhelm_Kuhnert_Des_L%C3%B6wen_Erwachen.jpg',
  },
  {
    file: '/icons/elephant-kuhnert-steppe.jpg',
    title: 'Afrikanischer Elefant in der Steppe (African Elephant on the Steppe)',
    author: 'Wilhelm Kuhnert (1922)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Wilhelm_Kuhnert_Afrikanischer_Elefant_in_der_Steppe_1922.jpg',
  },
  {
    file: '/icons/pool/street-bangkok-kerr.jpg',
    title: 'Menam River, Bangkok, Siam',
    author: 'Alexander Kerr (c. 1915)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Menam_River_Bangkok_Siam_Painting_by_A_Kerr_c1915.png',
  },
  {
    file: '/icons/havana-obispo-street.jpg',
    title: 'Havana — Obispo Street',
    author: 'American Photo Studios, Havana (photomechanical postcard)',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Havana_-_Obispo_Street_1.jpg',
  },
  {
    file: '/icons/kereru.jpg',
    title: 'New Zealand Pigeon (Kererū, Hemiphaga novaeseelandiae) — Carpophaga Novæ Zealandiæ',
    author: 'John Gerrard Keulemans (Walter Buller, A History of the Birds of New Zealand)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:A_history_of_the_birds_of_New_Zealand_(7157813050).jpg',
  },
  {
    file: '/icons/waves-courbet-the-wave.jpg',
    title: 'The Wave',
    author: 'Gustave Courbet — Oil on canvas',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Gustave_Courbet_-_The_Wave_-_Google_Art_Project.jpg',
  },
  {
    file: '/icons/forest-otira-gorge-nz.jpg',
    title: 'Entrance to the Otira Gorge, New Zealand',
    author: 'Marianne North — Oil on paper (Marianne North Gallery, Royal Botanic Gardens, Kew)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Marianne_North_(1830-1890)_-_Entrance_to_the_Otira_Gorge,_New_Zealand_-_MN731_-_Marianne_North_Gallery.jpg',
  },
  {
    file: '/icons/paris-accordion-de-smet.jpg',
    title: 'The Accordion Player',
    author: 'Gustave De Smet — Oil on canvas',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gustave_De_Smet_-_The_Accordion_Player.jpg',
  },
  {
    file: '/icons/paris-cafe-beraud.jpg',
    title: 'Le boulevard des Capucines, le soir, devant le Café Napolitain (c. 1880)',
    author: 'Jean Béraud — Oil on canvas',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:B%C3%A9raud_-_Le_boulevard_des_Capucines,_le_soir,_devant_le_Caf%C3%A9_Napolitain,_Vers_1880.jpg',
  },
  {
    file: '/icons/paris-seine-jongkind.jpg',
    title: 'View of the Seine looking towards the Pont Royal and the Pavillon de Flore',
    author: 'Johan Barthold Jongkind — Oil on canvas',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Johan_Barthold_Jongkind_-_View_of_the_Seine_looking_towards_the_Pont_Royal_and_the_Pavillon_de_Flore_92_jongkind_6879.jpg',
  },
  {
    file: '/icons/paris-notre-dame-delauney.jpg',
    title: 'Notre-Dame, Église Cathédrale de Paris (etching)',
    author: 'Alfred-Alexandre Delauney',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Notre-Dame_de_Paris-Alfred-Alexandre-Delauney.jpg',
  },
  {
    file: '/icons/paris-house-sparrow-naumann.jpg',
    title: 'House Sparrow (Passer domesticus) — Naturgeschichte der Vögel Mitteleuropas',
    author: 'Johann Friedrich Naumann (chromolithograph)',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Passer_(Naumann).jpg',
  },
  {
    file: '/icons/paris-boulevard-pissarro.jpg',
    title: 'Boulevard Montmartre, Spring (1897)',
    author: 'Camille Pissarro — Oil on canvas',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Camille_Pissarro_-_Boulevard_Montmartre,_Spring_-_Google_Art_Project.jpg',
  },
  {
    file: '/icons/redwoods-raven-audubon.jpg',
    title: 'Raven (Corvus corax), The Birds of America, Plate 101',
    author: 'Robert Havell after John James Audubon',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:101_Raven.jpg',
  },
  {
    file: '/icons/redwoods-stellers-jay-audubon.jpg',
    title: "Steller's Jay (Cyanocitta stelleri)",
    author: 'After John James Audubon, The Birds of America',
    license: 'Public domain',
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Steller's_Jay_(illustration).jpg",
  },
  {
    file: '/icons/redwoods-bierstadt.jpg',
    title: 'Giant Redwood Trees of California',
    author: 'Albert Bierstadt (1874), The Berkshire Museum',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Albert_Bierstadt_-_Giant_Redwood_Trees_of_California_-_Google_Art_Project.jpg',
  },
  {
    file: '/icons/forest-stream.jpg',
    title: 'A Forest Stream',
    author: 'Peder Mørk Mønsted (1905)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:A_Forest_Stream_by_Peder_Mork_Monsted.jpg',
  },
  {
    file: '/icons/kyoto-uguisu-ishizaki.jpg',
    title: 'Japanese bush warbler (uguisu, Cettia diphone) — Cock Blomhoff Collection',
    author: 'Ishizaki Yūshi — pencil drawing and watercolour (Naturalis Biodiversity Center, RMNH.ART.383)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Naturalis_Biodiversity_Center_-_RMNH.ART.383_-_Cettia_diphone_-_Y%C5%ABshi_Ishizaki_-_Cock_Blomhoff_Collection_-_pencil_drawing_-_water_colour.jpg',
  },
  {
    file: '/icons/kyoto-higurashi-utamaro.jpg',
    title: 'Evening Cicada, Higurashi; Spider, Kumo, from the Picture Book of Crawling Creatures (Ehon mushi erami)',
    author: 'Kitagawa Utamaro (MET DP135555)',
    license: 'CC0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:%E3%80%8E%E7%94%BB%E6%9C%AC%E8%99%AB%E6%92%B0%E3%80%8F_%E3%80%8C%E3%81%B2%E3%81%8F%E3%82%89%E3%81%97%E3%80%8D%E3%80%8C%E3%81%8F%E3%82%82%E3%80%8D-Evening_Cicada,_Higurashi;_Spider,_Kumo,_from_the_Picture_Book_of_Crawling_Creatures_(Ehon_mushi_erami)_MET_DP135555.jpg',
  },
  {
    file: '/icons/kyoto-garden-stream-hiroshige.jpg',
    title: 'Tea-houses on the Bank of the Tadasu River in a Shower, from Famous Places of Kyōto',
    author: 'Utagawa Hiroshige (MET DP120471)',
    license: 'CC0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:%E4%BA%AC%E9%83%BD%E5%90%8D%E6%89%80%E4%B9%8B%E5%86%85_%E7%B3%BA%E5%B7%9D%E5%8E%9F%E4%B9%8B%E5%A4%95%E7%AB%8B-Tea-houses_on_the_Bank_of_the_Tadasu_River_in_a_Shower_MET_DP120471.jpg',
  },
  {
    file: '/icons/kyoto-jungle-crow-kyosai.jpg',
    title: 'Full Moon with Crow on Plum Branch',
    author: 'Kawanabe Kyōsai (Cleveland Museum of Art 1930.203)',
    license: 'CC0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Kawanabe_Kyosai_-_Full_Moon_with_Crow_on_Plum_Branch_-_1930.203_-_Cleveland_Museum_of_Art.tif',
  },
  {
    file: '/icons/pool/subway-riders-mora.jpg',
    title: 'Subway Riders in New York City (Evening News)',
    author: 'Francis Luis Mora (1914) — Oil on canvas',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Francis_Luis_Mora_-_Subway_riders_in_NYC.jpg',
  },
  {
    file: '/icons/kyoto-kajika-frog.jpg',
    title: 'Hyla bürgeri (Kajika frog, Buergeria buergeri) — Fauna Japonica, Batrachii Tab. III',
    author: 'Iconographia Zoologica / Fauna Japonica (Temminck & Schlegel); Special Collections, University of Amsterdam',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Hyla_b%C3%BCrgeri_-_1700-1880_-_Print_-_Iconographia_Zoologica_-_Special_Collections_University_of_Amsterdam_-_UBA01_IZ11500119.tif',
  },
];

/** Exclude Met plates whose titles are semantically wrong for a pool. */
const POOL_TITLE_BLOCKLIST: Partial<Record<string, RegExp>> = {
  stream: /figure on shore|boys in a dory|figure in a canoe|portrait|marie antoinette/i,
  surf: /figure on shore/i,
  // "Birch Tree, Niagara" reads as a single spindly trunk sketch, not a forest —
  // excluded from both wind and forest so neither tile draws it.
  wind: /marie antoinette|portrait|birch tree, niagara/i,
  rain: /new york from the heights/i,
  forest: /figure in a canoe|birch tree, niagara/i,
};

/** Keyword rules for sounds missing an explicit pool mapping (checked in order). */
const SEMANTIC_POOL_RULES: Array<{ test: (soundId: string) => boolean; pool: string }> = [
  // Generic owls (non-NZ) use the owl pool. NZ morepork/ruru sounds are handled
  // earlier via the NZ-only species alias and never reach here.
  { test: (id) => /(?:^|-)owl(?:$|-)|night-owl/.test(id), pool: 'owl' },
  // Wildlife species pools (region-diverse). Checked before the generic ambient
  // rules so e.g. `understory-bird` reaches songbird, not the forest pool.
  { test: (id) => /(?:^|-)(?:seabird|gull)(?:$|-)|coastal-bird/.test(id), pool: 'seabird' },
  { test: (id) => /primate|monkey|howler|gibbon/.test(id), pool: 'primates' },
  { test: (id) => /tropical-bird|(?:^|-)toucan(?:$|-)|(?:^|-)quetzal(?:$|-)/.test(id), pool: 'tropical-bird' },
  {
    test: (id) => /songbird|blackbird|nightingale|warbler|sparrow|street-bird|hill-bird|understory-bird|(?:^|-)bird(?:$|-)/.test(id),
    pool: 'songbird',
  },
  // Frogs get their own naturalist frog plates (checked before insects so a
  // `wetland-frogs` id doesn't fall into the butterfly/moth insects pool).
  { test: (id) => /frog|toad|amphibian/.test(id), pool: 'frogs' },
  { test: (id) => /insect|cicada|cricket/.test(id), pool: 'insects' },
  { test: (id) => /(?:^|-)(?:stream|creek|brook|river|waterfall)(?:$|-)/.test(id), pool: 'stream' },
  { test: (id) => /surf|coastal-surf|ocean|waves/.test(id), pool: 'surf' },
  { test: (id) => /(?:^|-)(?:wind|breeze|gust)(?:$|-)/.test(id), pool: 'wind' },
  { test: (id) => /rain|monsoon|shower|drizzle|storm/.test(id), pool: 'rain' },
  { test: (id) => /tram|streetcar|eletrico|trolley/.test(id), pool: 'tram' },
  { test: (id) => /subway|metro/.test(id), pool: 'tram' },
  { test: (id) => /traffic|city-hum|motorway|highway/.test(id), pool: 'traffic' },
  // Human / cultural ambiences. `bell` is matched only as a whole word so it
  // never swallows `bellbird` (a songbird handled earlier).
  { test: (id) => /market|bazaar|bazar|souk|souq/.test(id), pool: 'market' },
  { test: (id) => /(?:^|-)bells?(?:$|-)|carillon|gong|chime|campanile/.test(id), pool: 'bells' },
  { test: (id) => /adhan|muezzin|mosque|ezan/.test(id), pool: 'mosque' },
  { test: (id) => /fado|musette|jazz|bossa|taksim|(?:^|-)ney(?:$|-)|accordion|guitar/.test(id), pool: 'music' },
  { test: (id) => /park-rustle|domain-park|park-ambience/.test(id), pool: 'nyc-park' },
  {
    test: (id) => /forest|bush|canopy|understory|woodland|ambience/.test(id),
    pool: 'forest',
  },
];

/**
 * Region-diverse street plates so a generated city's city-hum / traffic tile
 * gets a street of the RIGHT continent (a Caillebotte Paris boulevard or a
 * Lesser Ury Berlin night street) instead of always a New York scene. Tagged so
 * the flavour resolver + per-scene dedup pick an in-region street.
 */
const streetArtExtras: IconPoolEntry[] = [
  {
    src: '/icons/pool/street-bangkok-kerr.jpg',
    title: 'Menam River, Bangkok, Siam',
    author: 'Alexander Kerr (c. 1915)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Menam_River_Bangkok_Siam_Painting_by_A_Kerr_c1915.png',
    tags: ['asian', 'seasian', 'tropical', 'urban'],
  },
  {
    src: '/icons/havana-obispo-street.jpg',
    title: 'Havana — Obispo Street',
    author: 'American Photo Studios, Havana (photomechanical postcard)',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Havana_-_Obispo_Street_1.jpg',
    tags: ['americas', 'caribbean', 'tropical', 'urban'],
  },
  {
    src: '/icons/pool/street-paris.jpg',
    title: 'Paris Street; Rainy Day',
    author: 'Gustave Caillebotte (Art Institute of Chicago)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Gustave_Caillebotte_-_Paris_Street,_Rainy_Day_-_1964.336_-_Art_Institute_of_Chicago.jpg',
    tags: ['european', 'temperate', 'urban'],
  },
  {
    src: '/icons/pool/street-berlin.jpg',
    title: 'Nächtliche Straßenszene, Berlin (Night Street Scene, Berlin)',
    author: 'Lesser Ury (1920)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Lesser_Ury_-_N%C3%A4chtliche_Strassenszene,_Berlin_(1920).jpg',
    tags: ['european', 'cold', 'urban'],
  },
];

/** Street/traffic pool without theatre or circus imagery; lead with bundled urban plates. */
function buildTrafficPool(): IconPoolEntry[] {
  const filtered = (iconPools['nyc-traffic'] ?? []).filter(
    (entry) => !entry.src.includes('388212'),
  );
  const rooftops = (iconPools['nyc-breeze'] ?? []).find((entry) =>
    entry.src.includes('853645'),
  );
  const bundled = filtered.filter((entry) => isLocallyBundledIconSrc(entry.src));
  const lead = [rooftops, ...bundled].filter((entry): entry is IconPoolEntry => Boolean(entry));
  const leadSrcs = new Set(lead.map((entry) => entry.src));
  return [
    ...lead,
    ...streetArtExtras,
    ...filtered.filter((entry) => !leadSrcs.has(entry.src)),
  ];
}

/** Public-domain river/town plate added to the stream pool for urban riverside depth. */
const streamArtExtras: IconPoolEntry[] = [
  {
    src: '/icons/pool/stream-river-town.jpg',
    title: 'Landscape, River and Town (from a sketchbook)',
    author: 'John William Casilear (The Metropolitan Museum of Art)',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Landscape,_River_and_Town_(from_Sketchbook)_MET_263717.jpg',
    tags: ['temperate', 'americas'],
  },
];

/**
 * Scene / cultural art pools for the human + ambient sound types that generated
 * cities lean on (markets, church + temple bells, mosques, street music, trams,
 * frogs). Before this, `market`/`bells`/`frogs`/`adhan`/etc. had NO pool and
 * silently fell back to a forest landscape (a generated "Berlin" showed a forest
 * for its market AND its church bells). Each plate is a public-domain / CC0 /
 * CC-BY illustration tagged by region so the flavour resolver picks an in-region
 * subject (a Flemish produce market for Europe, a Constantinople bazaar for the
 * Levant, a West Indies linen market for the Americas).
 */
const sceneArtPools: Record<string, IconPoolEntry[]> = {
  market: [
    {
      src: '/icons/pool/market-european.jpg',
      title: 'The Vegetable Market',
      author: 'Joachim Beuckelaer',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Joachim_Beuckelaer_-_The_Vegetable_Market_-_WGA2124.jpg',
      tags: ['european'],
    },
    {
      src: '/icons/pool/market-flemish.jpg',
      title: 'Market Scene with a Pick-pocket',
      author: 'Louise Moillon',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Louise_Moillon_-_Market_Scene_with_a_Pick-pocket_-_WGA16072.jpg',
      tags: ['european'],
    },
    {
      src: '/icons/pool/market-fountain.jpg',
      title: 'Market Scene by a Fountain',
      author: 'Mathys Schoevaerdts',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mathys_Schoevaerdts_-_Market_Scene_by_a_Fountain.jpg',
      tags: ['european'],
    },
    {
      src: '/icons/pool/market-berlin.jpg',
      title: 'Alexanderplatz, Berlin',
      author: 'Lesser Ury',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lesser_Ury_-_Alexanderplatz.jpg',
      tags: ['european', 'cold'],
    },
    {
      src: '/icons/pool/market-mena.jpg',
      title: 'The Bazaar at Constantinople',
      author: 'John Frederick Lewis (Wellcome Collection)',
      license: 'CC BY 4.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:The_bazaar_at_Constantinople._Watercolour_by_J._F._Lewis._Wellcome_V0017600.jpg',
      tags: ['mena', 'mediterranean', 'asian'],
    },
    {
      src: '/icons/pool/market-asian.jpg',
      title: 'Chiryū: The Summer Horse Fair (from the Tōkaidō)',
      author: 'Utagawa Hiroshige',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Chiry%C5%AB_LCCN2009615483.jpg',
      tags: ['asian', 'eastasian', 'seasian', 'tropical'],
    },
    {
      src: '/icons/pool/market-americas.jpg',
      title: 'A Linen Market with a Linen-stall and Vegetable Seller in the West Indies',
      author: 'Agostino Brunias',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Agostino_Brunias_-_A_Linen_Market_with_a_Linen-stall_and_Vegetable_Seller_in_the_West_Indies_-_Google_Art_Project.jpg',
      tags: ['americas', 'caribbean', 'tropical'],
    },
  ],
  bells: [
    {
      src: '/icons/pool/bells-belfry.jpg',
      title: "Belfry of St Sophia's Cathedral in Kyiv",
      author: 'Jan Stanisławski (National Museum, Kraków)',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Jan_Stanis%C5%82awski_-_Belfry_of_St_Sophy%27s_Orhodox_Catedral_in_Kyiv_-_MNK_II-b-584_-_National_Museum_Krak%C3%B3w.jpg',
      tags: ['european', 'cold', 'temperate'],
    },
    {
      src: '/icons/pool/bells-angelus.jpg',
      title: 'The Angelus',
      author: 'Jean-François Millet',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Jean-Fran%C3%A7ois_Millet_-_The_Angelus_-_Google_Art_Project.jpg',
      // Region-neutral (no region tag): a church bell scene that reads correctly
      // for Catholic/Christian bells anywhere, so it is the global church-bells
      // default whenever the region-specific belfry/temple plates are penalised.
    },
    {
      src: '/icons/pool/bells-temple.jpg',
      title: 'Evening Bell at Mii Temple (Eight Views of Ōmi)',
      author: 'Utagawa Hiroshige',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Hiroshige_-_8_Views_of_Omi_-_4._Evening_Bell,_Mii_Temple.jpg',
      tags: ['asian'],
    },
  ],
  mosque: [
    {
      src: '/icons/pool/mosque-prayer.jpg',
      title: 'Prayer in the Mosque',
      author: 'Jean-Léon Gérôme',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Prayer_in_the_Mosque.jpg',
      tags: ['mena'],
    },
  ],
  music: [
    {
      src: '/icons/pool/music-guitar.jpg',
      title: 'Guitar Player',
      author: 'Giovanni Boldini',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Guitar_player_(1873),_by_Giovanni_Boldini.jpg',
      tags: ['european', 'mediterranean'],
    },
    {
      src: '/icons/pool/music-accordion.jpg',
      title: 'Harmonikář (The Accordion Player)',
      author: 'Josef Čapek',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Josef_%C4%8Capek_-_Harmonik%C3%A1%C5%99_(1913).jpg',
      tags: ['european'],
    },
    {
      src: '/icons/pool/music-ensemble.jpg',
      title: 'Interior with a Music-making Company',
      author: 'Rijksmuseum (anonymous drawing)',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Interieur_met_musicerend_gezelschap,_RP-T-1890-A-2260.jpg',
      tags: ['european'],
    },
  ],
  tram: [
    {
      src: '/icons/pool/tram-green-car.jpg',
      title: 'The Green Car',
      author: 'William James Glackens (The Metropolitan Museum of Art)',
      license: 'CC0 (The Metropolitan Museum of Art)',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Green_Car_MET_DT1355.jpg',
      tags: ['americas', 'urban'],
    },
    {
      src: '/icons/pool/tram-copley.jpg',
      title: 'Copley Square, Boston',
      author: 'George Luks',
      license: 'Public domain',
      sourceUrl: "https://commons.wikimedia.org/wiki/File:'Copley_Square,_Boston'_by_George_Benjamin_Luks.jpg",
      tags: ['americas', 'urban', 'temperate'],
    },
  ],
  frogs: [
    {
      src: '/icons/pool/frogs-haeckel.jpg',
      title: 'Batrachia (frogs), from Kunstformen der Natur',
      author: 'Ernst Haeckel',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Haeckel_Batrachia.jpg',
      tags: ['tropical'],
    },
    {
      src: '/icons/pool/frogs-haeckel-spots.jpg',
      title: 'Batrachia (frogs) — plate variant',
      author: 'Ernst Haeckel',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Haeckel_frogs_big_spots.jpg',
      tags: ['temperate'],
    },
  ],
};

/**
 * Region-diverse art pools for the distinctive wildlife types. Each plate is
 * tagged by continent so the location-aware resolver + `flavourScore` cross-
 * region penalty pick an in-region illustration (a Trimen African butterfly for
 * Cape Town, a Merian Neotropical butterfly for Costa Rica), breaking the old
 * one-fixed-plate collisions. Downloaded public-domain plates live under
 * /icons/pool/ (see scripts, sourced from Wikimedia Commons).
 */
const speciesArtPools: Record<string, IconPoolEntry[]> = {
  insects: [
    {
      src: '/icons/insect-jardine-plate.jpg',
      title: "Naturalist's Library Entomology, Plate 21 (cicada)",
      author: "Sir William Jardine (Naturalist's Library)",
      license: 'Public domain',
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Jardine_Naturalist's_library_Entomology_Plate_21.jpg",
      tags: ['temperate', 'summer', 'cicada'],
    },
    {
      src: '/icons/cicada-maculata.jpg',
      title: 'Illustrations of Exotic Entomology — Cicada Maculata',
      author: 'Dru Drury / John Obadiah Westwood',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Illustrations_of_Exotic_Entomology_Cicada_Maculata.jpg',
      tags: ['tropical', 'summer', 'cicada'],
    },
    {
      src: '/icons/cricket-field-ensifera.jpg',
      title: 'Cricket, from a plate of Ensifera (crickets and bush-crickets)',
      author: 'Gotthilf Heinrich von Schubert, Naturgeschichte (1886)',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ensifera_Naturgeschichte.jpg',
      tags: ['temperate', 'european', 'night'],
    },
    {
      src: '/icons/insect-field-cricket-plate.jpg',
      title:
        'Locusta sexpunctata, Gryllus campestris, Gryllotalpa mitidula (plate detail)',
      author: '19th-century natural history plate (Wikimedia Commons)',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Locusta_sexpunctata(grasshopper_of_six_points),_Gryllus_campestris(field_crickets),_Gryllotalpa_mitidula(Australian_Crickets).jpg',
      tags: ['temperate', 'australian', 'summer'],
    },
    {
      src: '/icons/insects.jpg',
      title: 'Metamorphosis of a Small Emperor Moth on a Damson Plum (plate 13)',
      author: 'Maria Sibylla Merian (Getty Museum)',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Metamorphosis_of_a_Small_Emperor_Moth_on_a_Damson_Plum,_plate_13_of_the_Caterpillar_Book,_by_Maria_Sibylla_Merian_(Getty_109Q5N).jpg',
      tags: ['temperate', 'european'],
    },
    {
      src: '/icons/insect-natural-history.jpg',
      title:
        'Natural history of the animal kingdom for the use of young people (Plate XXIV)',
      author: 'W. F. Kirby / public-domain plate',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Natural_history_of_the_animal_kingdom_for_the_use_of_young_people_(Plate_XXIV)_(5974465081).jpg',
      tags: ['temperate', 'european'],
    },
    {
      src: '/icons/merian-suriname-butterfly.jpg',
      title: 'Butterfly and caterpillar — Metamorphosis insectorum Surinamensium (1705), plate 74',
      author: 'Maria Sibylla Merian (British Library)',
      license: 'CC0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Butterfly_and_Caterpillar_-_Metamorphosis_insectorum_surinamensium_(1705),_74_-_BL.jpg',
      tags: ['tropical', 'americas', 'neotropical'],
    },
    {
      src: '/icons/african-butterfly.jpg',
      title: 'South-African Butterflies, plate 7',
      author: 'Roland Trimen (1887)',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:TrimenSouthAfricanButterfliesPlate7.jpg',
      tags: ['african', 'savanna'],
    },
  ],
  songbird: [
    {
      src: '/icons/gray-catbird.jpg',
      title: 'Cat-Bird (Dumetella carolinensis), Birds of America, Pl. 140',
      author: 'John James Audubon (NYPL)',
      license: 'Public domain (NYPL: no known U.S. copyright restrictions)',
      sourceUrl: 'https://digitalcollections.nypl.org/items/2a28c850-c5f9-012f-9b77-58d385a7bc34',
      tags: ['americas', 'nearctic', 'garden'],
    },
    {
      src: '/icons/northern-cardinal.jpg',
      title: 'Common Cardinal Grosbeak (Cardinalis cardinalis), Birds of America, Pl. 203',
      author: 'John James Audubon (NYPL)',
      license: 'Public domain (NYPL: no known U.S. copyright restrictions)',
      sourceUrl: 'https://digitalcollections.nypl.org/items/43a68310-c5f9-012f-0599-58d385a7bc34',
      tags: ['americas', 'nearctic', 'garden'],
    },
    {
      src: '/icons/pool/songbird-european.jpg',
      title: 'Common Nightingale (Luscinia megarhynchos)',
      author: 'John Gould, The Birds of Great Britain',
      license: 'CC BY-SA 4.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Luscinia megarhynchos. John Gould. The birds of Great Britain.jpg',
      tags: ['european', 'garden', 'temperate'],
    },
    {
      src: '/icons/pool/songbird-asian.jpg',
      title: 'Cream-vented Bulbul (Pycnonotus simplex)',
      author: 'John Gerrard Keulemans',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:PycnonotusSimplexKeulemans.jpg',
      tags: ['asian', 'garden'],
    },
    {
      src: '/icons/pool/songbird-african.jpg',
      title: 'Blue-shouldered Robin-Chat (Cossypha cyanocampter)',
      author: 'John Gerrard Keulemans',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:CossyphaCyanocampterKeulemans.jpg',
      tags: ['african', 'savanna'],
    },
  ],
  seabird: [
    {
      src: '/icons/gull.jpg',
      title: 'Red-billed gull (Chroicocephalus scopulinus)',
      author: 'John Gerrard Keulemans (Buller, 1905)',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bul02BirdP029.jpg',
      tags: ['nz', 'pacific', 'coastal'],
    },
    {
      src: '/icons/met/830271.jpg',
      title: 'Bald Ibis from the Cape of Good Hope',
      author: 'François Nicolas Martinet (1770–86)',
      license: 'CC0 (The Metropolitan Museum of Art)',
      sourceUrl: 'https://www.metmuseum.org/art/collection/search/830271',
      tags: ['african', 'coastal'],
    },
    {
      src: '/icons/pool/seabird-european.jpg',
      title: 'Black-legged Kittiwake (Rissa tridactyla)',
      author: 'John Gould',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rissa tridactyla1.jpg',
      tags: ['european', 'coastal'],
    },
    {
      src: '/icons/pool/seabird-americas.jpg',
      title: 'Arctic Tern (Sterna paradisaea)',
      author: 'Robert Havell after John James Audubon',
      license: 'CC0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Robert Havell after John James Audubon, Arctic Tern, 1835, NGA 32391.jpg',
      tags: ['americas', 'coastal'],
    },
  ],
  corvid: [
    {
      src: '/icons/blue-jay.jpg',
      title: 'Blue Jay (Cyanocitta cristata), Birds of America, Pl. 231',
      author: 'John James Audubon (NYPL)',
      license: 'Public domain (NYPL: no known U.S. copyright restrictions)',
      sourceUrl: 'https://digitalcollections.nypl.org/items/510d47d9-7308-a3d9-e040-e00a18064a99',
      tags: ['americas', 'nearctic'],
    },
    {
      src: '/icons/pool/corvid-european.jpg',
      title: 'Eurasian Magpie and Western Jackdaw',
      author: 'Johann Friedrich Naumann',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Elster und Dohle.jpg',
      tags: ['european'],
    },
    {
      src: '/icons/pool/corvid-asian.jpg',
      title: 'Red-billed Blue Magpie (Urocissa erythrorhyncha)',
      author: 'Elizabeth Gould',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Red billed blue magpie Gould.jpg',
      tags: ['asian'],
    },
  ],
  primates: [
    {
      src: '/icons/howler.jpg',
      title: 'Red howler monkey (Mycetes seniculus)',
      author: 'Iconographia Zoologica (University of Amsterdam, 1863)',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Mycetes_seniculus_-_1863_-_Print_-_Iconographia_Zoologica_-_Special_Collections_University_of_Amsterdam_-_UBA01_IZ20200132.tif',
      tags: ['americas', 'neotropical', 'tropical'],
    },
    {
      src: '/icons/pool/primates-asian.jpg',
      title: 'Tenasserim Gibbon (Hylobates entelloides)',
      author: 'Encyclopædia Britannica (1911)',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:EB1911 Gibbon 1.jpg',
      tags: ['asian', 'tropical', 'forest'],
    },
    {
      src: '/icons/pool/primates-african.jpg',
      title: 'Guereza Monkey (Colobus guereza)',
      author: 'W. C. L. Martin',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:A general introduction to the natural history of mammiferous animals (Pl. 12) (9092151645).jpg',
      tags: ['african', 'forest'],
    },
  ],
  'tropical-bird': [
    {
      src: '/icons/toucan.jpg',
      title: 'Le Tocan (Toucan)',
      author: 'Jacques Barraband (Histoire naturelle des perroquets)',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Barraband_No3_Le_Tocan.jpg',
      tags: ['americas', 'neotropical', 'tropical'],
    },
    {
      src: '/icons/quetzal.jpg',
      title: 'Resplendent Trogon (Resplendent Quetzal, Pharomachrus mocinno)',
      author: 'Birds and nature (1905), A. W. Mumford — Biodiversity Heritage Library',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Birds_and_nature_(1905)_(14564781960).jpg',
      tags: ['americas', 'neotropical', 'tropical'],
    },
    {
      src: '/icons/met/363843.jpg',
      title: 'Eclectus Roratus Polychloros',
      author: 'Edward Lear',
      license: 'CC0 (The Metropolitan Museum of Art)',
      sourceUrl: 'https://www.metmuseum.org/art/collection/search/363843',
      tags: ['asian', 'tropical'],
    },
    {
      src: '/icons/pool/tropicalbird-african.jpg',
      title: 'Southern Carmine Bee-eater (Merops nubicoides)',
      author: 'John Gerrard Keulemans',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Merops nubicoides 1884.jpg',
      tags: ['african', 'tropical'],
    },
    {
      src: '/icons/pool/tropicalbird-asian.jpg',
      title: 'Palawan Hornbill (Anthracoceros marchei)',
      author: 'John Gerrard Keulemans',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:AnthracocerosLemprieriKeulemans.jpg',
      tags: ['asian', 'tropical'],
    },
  ],
  lion: [
    {
      src: '/icons/lion-kuhnert-ruaha-tanzania.jpg',
      title: 'Leeuw aan de Ruaharivier, Tanzania, Afrika (Lion on the Ruaha River)',
      author: 'Wilhelm Kuhnert (between 1880 and 1926), Rijksmuseum Twenthe',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Wilhelm_Kuhnert_-_Leeuw_aan_de_Ruaharivier,_Tanzania,_Afrika_-_0194_-_Rijksmuseum_Twenthe.jpg',
      tags: ['african', 'savanna'],
    },
    {
      src: '/icons/lion-kuhnert-head.jpg',
      title: 'Kopf eines Löwen (Head of a Lion)',
      author: 'Wilhelm Kuhnert (1896)',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Wilhelm_Kuhnert_Kopf_eines_L%C3%B6wen.jpg',
      tags: ['african', 'savanna'],
    },
    {
      src: '/icons/lion.jpg',
      title: 'Lion (Felis leo capensis) — Brehms Het Leven der Dieren',
      author: 'Alfred Edmund Brehm (Brehms Tierleben / Het Leven der Dieren)',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Brehms_Het_Leven_der_Dieren_Zoogdieren_Orde_4_Leeuw_(Felis_leo_capensis).jpg',
      tags: ['african', 'savanna'],
    },
  ],
  elephant: [
    {
      src: '/icons/elephant-kuhnert-steppe.jpg',
      title: 'Afrikanischer Elefant in der Steppe (African Elephant on the Steppe)',
      author: 'Wilhelm Kuhnert (1922)',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Wilhelm_Kuhnert_Afrikanischer_Elefant_in_der_Steppe_1922.jpg',
      tags: ['african', 'savanna', 'arid'],
    },
  ],
  owl: [
    {
      src: '/icons/morepork.jpg',
      title: 'Morepork (Ruru) and Laughing owl (Whekau)',
      author: 'John Gerrard Keulemans (Buller, 1888)',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Morepork_(Ruru)_and_Laughing_owl_(Whekau).jpg',
      // NZ/Pacific ruru plate. Tagged with the Southern-Alps climate traits so it
      // decisively beats the arctic Snowy Owl on the Queenstown owl tile; the
      // nz/pacific region gate keeps it off every non-Pacific pin.
      tags: ['nz', 'pacific', 'alpine', 'cold', 'night'],
    },
    {
      src: '/icons/met/751141.jpg',
      title: 'Monedula, Chouëtte (The Owl), from "Livre d\'Oyseaux"',
      author: 'Albert Flamen',
      license: 'CC0 (The Metropolitan Museum of Art)',
      sourceUrl: 'https://www.metmuseum.org/art/collection/search/751141',
      // Generic etched owl — the temperate/woodland default (kept region-neutral
      // so it, not the arctic snowy owl, is the fallback in warm scenes).
      tags: ['temperate', 'woodland'],
    },
    {
      src: '/icons/met/393450.jpg',
      title: 'Snowy Owl',
      author: 'Henry Emerson Tuttle',
      license: 'CC0 (The Metropolitan Museum of Art)',
      sourceUrl: 'https://www.metmuseum.org/art/collection/search/393450',
      // Snowy owl belongs to cold/boreal scenes only — 'temperate' as a warm
      // guard keeps it from beating the generic owl everywhere while 'cold'
      // wins it the boreal pins it actually suits.
      tags: ['cold', 'arctic', 'boreal'],
    },
    {
      src: '/icons/pool/owl-americas.jpg',
      title: 'Great Horned Owl (Bubo virginianus)',
      author: 'Robert Havell after John James Audubon',
      license: 'CC0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Robert Havell after John James Audubon, Great Horned Owl, 1829, NGA 32202.jpg',
      tags: ['americas', 'nearctic', 'night'],
    },
    {
      src: '/icons/pool/owl-asian.jpg',
      title: 'Sulawesi Scops Owl (Otus manadensis)',
      author: 'John Gerrard Keulemans',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Otus manadensis Keulemans.jpg',
      tags: ['asian', 'night'],
    },
    {
      src: '/icons/pool/owl-tropical.jpg',
      title: 'Guatemalan Screech-owl (Megascops guatemalae)',
      author: 'John Gerrard Keulemans',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:ScopsGuatemalaeKeulemans.jpg',
      tags: ['tropical', 'night'],
    },
  ],
};

const extraIconPools: Record<string, IconPoolEntry[]> = {
  traffic: buildTrafficPool(),
  stream: [...(iconPools.stream ?? []), ...streamArtExtras],
  ...speciesArtPools,
  ...sceneArtPools,
};

/**
 * Credits list = generated Met/NYPL attributions + any newly-added species-pool
 * plates (butterflies, region bird plates) that aren't already covered. Keeps
 * the attributions page and the fixed-icon lookup complete.
 */
const artworkAttributions: ArtworkAttribution[] = (() => {
  const merged = [...generatedArtworkAttributions];
  const seen = new Set(merged.map((item) => item.file));
  for (const attribution of extendedFixedIconAttributions) {
    if (seen.has(attribution.file)) continue;
    seen.add(attribution.file);
    merged.push(attribution);
  }
  const attributionPools = [
    ...Object.values(speciesArtPools),
    ...Object.values(sceneArtPools),
    streetArtExtras,
    streamArtExtras,
  ];
  for (const pool of attributionPools) {
    for (const entry of pool) {
      if (seen.has(entry.src)) continue;
      seen.add(entry.src);
      merged.push({
        file: entry.src,
        title: entry.title,
        author: entry.author,
        license: entry.license,
        sourceUrl: entry.sourceUrl,
      });
    }
  }
  return merged;
})();

const mergedIconPools: Record<string, IconPoolEntry[]> = {
  ...iconPools,
  ...extraIconPools,
};

/** Extra sound → icon pool mappings for world-region sounds (reuse Met/Wikimedia pools). */
const soundPoolMap: Record<string, string> = {
  ...generatedSoundPoolMap,
  'copacabana-surf': 'surf',
  'atlantic-wind': 'wind',
  // Distinctive wildlife → region-diverse species pools.
  seabird: 'seabird',
  'herring-gull': 'seabird',
  'forest-gull': 'seabird',
  'coastal-bird': 'seabird',
  'global-gull': 'seabird',
  blackbird: 'songbird',
  nightingale: 'songbird',
  'street-bird': 'songbird',
  'hill-bird': 'songbird',
  'understory-bird': 'songbird',
  'quetzal-rio': 'songbird',
  'global-songbird': 'songbird',
  'toucan-rio': 'tropical-bird',
  'tropical-bird': 'tropical-bird',
  'global-tropical-bird': 'tropical-bird',
  'jungle-primates': 'primates',
  'global-jungle-primates': 'primates',
  // Bangkok signatures — temple bells use the (Asian-tagged) bells pool, the
  // covered market uses the market pool, the koel the Asian tropical-bird pool.
  'bangkok-temple-bells': 'bells',
  'bangkok-market': 'market',
  'bangkok-koel': 'tropical-bird',
  'city-hum': 'traffic',
  'park-rustle': 'nyc-park',
  'urban-breeze': 'nyc-breeze',
  'distant-traffic': 'traffic',
  'london-rain': 'rain',
  'thames-breeze': 'nyc-breeze',
  'park-ambience': 'nyc-park',
  'distant-city': 'traffic',
  'monsoon-rain': 'rain',
  // Auckland / NZ expansions. `domain-park` (Auckland Domain bush) now uses a
  // bespoke NZ native-forest plate via extendedFixedIcons, so it no longer maps
  // to the shared nyc-park (Central Park) pool.
  'auckland-rain': 'rain',
  'urban-creek': 'stream',
  'harbor-traffic': 'traffic',
  'forest-rain': 'rain',
  'bush-stream': 'stream',
  'coastal-surf': 'surf',
  // Rio expansions
  'rio-rain': 'rain',
  'rio-stream': 'stream',
  'rio-traffic': 'traffic',
  // Bed-Stuy expansions
  'brooklyn-rain': 'rain',
  'park-stream': 'stream',
  // London expansions
  'thames-stream': 'stream',
  'london-traffic': 'traffic',
  'street-jazz-busker': 'music',
  'global-jazz': 'music',
  // Lisbon / Istanbul signatures now have dedicated art pools: tram → tram
  // (streetcar plates), fado / ney → music (instrument/performance plates),
  // adhan → mosque (a mosque-prayer plate) instead of all sharing the market.
  'global-tram': 'tram',
  'global-fado': 'music',
  'global-adhan': 'mosque',
  'global-ney': 'music',
  // Distant lion / elephant (Serengeti) → dedicated Kuhnert plates.
  'global-lion': 'lion',
  'global-elephant': 'elephant',
  'bangkok-traffic': 'traffic',
  'havana-cityhum': 'traffic',
  // Musette accordion (Paris uses a bespoke pinned plate; this is the fallback
  // for any bare global-musette instance) → the music/instrument art pool.
  'global-musette': 'music',
  // Pacific Slope expansions
  'canopy-wind': 'wind',
  'forest-floor': 'forest',
  'pacific-surf': 'surf',
  // Global library
  'global-wind': 'wind',
  'global-rain': 'rain',
  'global-stream': 'stream',
  'global-forest': 'forest',
  'global-surf': 'surf',
  'global-traffic': 'traffic',
  // Curation pass: characterful human/ambient layers now route to dedicated art
  // pools (bells → church/temple belfries, market → region markets, frogs → frog
  // plates, bossa-nova/jazz → music) instead of all collapsing to the forest
  // fallback that the missing `market` pool used to produce.
  'global-corvid': 'corvid',
  'global-bells': 'bells',
  'global-market': 'market',
  'global-kookaburra': 'songbird',
  'global-bossa-nova': 'music',
  'global-frogs': 'frogs',
  'rio-bossa-nova': 'music',
  'kookaburra': 'songbird',
};

const SESSION_KEY = 'saudade-icon-seed';
const regionArtCache = new Map<string, Map<string, IconPoolEntry>>();

function readSessionSeed(): string {
  if (typeof sessionStorage === 'undefined') {
    return 'ssr';
  }
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const seed = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, seed);
  return seed;
}

const sessionSeed = readSessionSeed();

function hashKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hashToIndex(key: string, size: number): number {
  return hashKey(key) % size;
}

/**
 * Location/climate-aware flavour scoring. Each icon pool entry can carry region
 * /climate `tags` (tropical, temperate, cold, alpine, coastal, urban, asian,
 * european, americas, pacific, nz, forest, woodland, mountain, …). The resolver
 * prefers entries whose tags intersect the scene's tags so a Caribbean place
 * gets tropical art instead of a Japanese woodblock or a Russian forest, while
 * untagged/non-matching entries remain valid generic fallbacks.
 *
 * Scoring is pure + deterministic (no randomness), so selection stays seeded and
 * never flickers between renders.
 */
const FLAVOUR_CLIMATE_TAGS = new Set(['tropical', 'temperate', 'cold']);
const FLAVOUR_HOT_TAGS = new Set(['tropical']);
const FLAVOUR_COLD_TAGS = new Set(['cold', 'arctic']);

/** Continent/region tags mirrored from the audio picker for cross-region art conflict. */
const FLAVOUR_REGION_TAGS = new Set([
  'european',
  'americas',
  'asian',
  'african',
  'pacific',
  'nz',
  'mediterranean',
  'caribbean',
  'neotropical',
  'nearctic',
]);
const FLAVOUR_REGION_COMPAT: Record<string, string[]> = {
  nz: ['pacific'],
  pacific: ['nz'],
  caribbean: ['americas', 'neotropical'],
  neotropical: ['americas', 'caribbean'],
  nearctic: ['americas'],
  americas: ['caribbean', 'neotropical', 'nearctic'],
  mediterranean: ['european'],
  european: ['mediterranean'],
};

function regionSubset(tags: VariantTag[]): string[] {
  return tags.filter((tag) => FLAVOUR_REGION_TAGS.has(tag));
}

function flavourRegionsCompatible(entryRegions: string[], sceneRegions: string[]): boolean {
  if (entryRegions.length === 0 || sceneRegions.length === 0) return true;
  const scene = new Set(sceneRegions);
  for (const er of entryRegions) {
    if (scene.has(er)) return true;
    for (const compat of FLAVOUR_REGION_COMPAT[er] ?? []) {
      if (scene.has(compat)) return true;
    }
  }
  return false;
}

function flavourScore(
  entryTags: VariantTag[] | undefined,
  sceneTags: VariantTag[] | undefined,
): number {
  if (!entryTags?.length || !sceneTags?.length) return 0;
  const scene = new Set(sceneTags);
  let score = 0;
  for (const tag of entryTags) {
    if (scene.has(tag)) score += FLAVOUR_CLIMATE_TAGS.has(tag) ? 2 : 1;
  }
  // Hard climate conflict: tropical art in a cold scene (or vice-versa) reads as
  // wrong (e.g. a Snowy Owl over a tropical city). Temperate is compatible with
  // both and never conflicts.
  const sceneHot = sceneTags.some((tag) => FLAVOUR_HOT_TAGS.has(tag));
  const sceneCold = sceneTags.some((tag) => FLAVOUR_COLD_TAGS.has(tag));
  const entryHot = entryTags.some((tag) => FLAVOUR_HOT_TAGS.has(tag));
  const entryCold = entryTags.some((tag) => FLAVOUR_COLD_TAGS.has(tag));
  if ((sceneHot && entryCold) || (sceneCold && entryHot)) score -= 4;

  // Cross-continent conflict: art tied to a different biogeographic region reads
  // as wrong (an American cardinal plate over Morocco). Region-neutral art is
  // never penalised so it stays a valid generic fallback everywhere.
  const entryRegions = regionSubset(entryTags);
  const sceneRegions = regionSubset(sceneTags);
  if (!flavourRegionsCompatible(entryRegions, sceneRegions)) score -= 4;
  return score;
}

/**
 * Narrow a pool to the best flavour matches for a scene. When nothing matches
 * (best score ≤ 0) the full pool is returned so generic art still applies.
 */
function preferFlavourMatches(
  pool: IconPoolEntry[],
  sceneTags: VariantTag[] | undefined,
): IconPoolEntry[] {
  if (!sceneTags?.length || pool.length <= 1) return pool;
  let best = -Infinity;
  for (const entry of pool) {
    best = Math.max(best, flavourScore(entry.tags, sceneTags));
  }
  if (best <= 0) return pool;
  const top = pool.filter((entry) => flavourScore(entry.tags, sceneTags) === best);
  return top.length > 0 ? top : pool;
}

function pickFromPool(
  pool: IconPoolEntry[],
  variantKey: string,
  sceneTags?: VariantTag[],
): IconPoolEntry {
  const resolvable = pool.filter((entry) => iconEntryResolvableRank(entry) < 3);
  const base = resolvable.length > 0 ? resolvable : pool;
  const candidates = preferFlavourMatches(base, sceneTags);
  return candidates[hashToIndex(variantKey, candidates.length)];
}

function iconEntryResolvableRank(entry: IconPoolEntry): number {
  if (isLocallyBundledIconSrc(entry.src)) return 0;
  if (entry.detailSrc) return 1;
  if (entry.sourceUrl?.includes('commons.wikimedia.org')) return 2;
  return 3;
}

/** Binary: 0 = resolvable to a displayable src, 1 = not. Used for ranking so
 * bundled and Met/Commons plates disperse equally and only dead entries sink. */
function resolvableTier(entry: IconPoolEntry): number {
  return iconEntryResolvableRank(entry) < 3 ? 0 : 1;
}

function withDisplaySrc(entry: IconPoolEntry): IconPoolEntry {
  return { ...entry, src: resolveTileIconSrc(entry) };
}

function resolveSemanticPool(soundId: string): string | undefined {
  for (const rule of SEMANTIC_POOL_RULES) {
    if (rule.test(soundId)) return rule.pool;
  }
  return undefined;
}

function resolvePoolName(soundId: string): string | undefined {
  return soundPoolMap[soundId] ?? resolveSemanticPool(soundId);
}

function filterPoolEntries(poolName: string, pool: IconPoolEntry[]): IconPoolEntry[] {
  const blocklist = POOL_TITLE_BLOCKLIST[poolName];
  if (!blocklist) return pool;
  const filtered = pool.filter((entry) => !blocklist.test(entry.title));
  return filtered.length > 0 ? filtered : pool;
}

function getPoolForSound(soundId: string): IconPoolEntry[] | undefined {
  const poolName = resolvePoolName(soundId);
  if (!poolName) return undefined;
  const pool = mergedIconPools[poolName];
  if (!pool?.length) return undefined;
  return filterPoolEntries(poolName, pool);
}

function resolveFixedIconId(soundId: string, regionId?: string): string {
  if (regionId && NZ_REGION_IDS.has(regionId)) {
    const nzAlias = nzOnlySpeciesIconAliases[soundId];
    if (nzAlias) return nzAlias;
  }
  return fixedIconAliases[soundId] ?? speciesIconAliases[soundId] ?? soundId;
}

function fixedIconEntry(soundId: string, regionId?: string): IconPoolEntry | null {
  const resolvedId = resolveFixedIconId(soundId, regionId);
  const src = fixedIcons[resolvedId] ?? extendedFixedIcons[resolvedId];
  if (!src) return null;

  const match = artworkAttributions.find((item) => item.file === src);
  if (match) {
    return {
      src: match.file,
      title: match.title,
      author: match.author,
      license: match.license,
      sourceUrl: match.sourceUrl,
    };
  }

  return {
    src,
    title: resolvedId,
    author: 'Unknown',
    license: 'Public domain',
    sourceUrl: src,
  };
}

function rankPoolEntries(
  pool: IconPoolEntry[],
  regionId: string,
  soundId: string,
  sceneTags?: VariantTag[],
): IconPoolEntry[] {
  return [...pool].sort((left, right) => {
    // Flavour match dominates: prefer art that suits the scene's region/climate.
    const flavourDelta = flavourScore(right.tags, sceneTags) - flavourScore(left.tags, sceneTags);
    if (flavourDelta !== 0) return flavourDelta;
    // Only *unresolvable* plates (can't produce a displayable src at all) are
    // demoted; bundled vs Met/Commons plates rank equally so the per-location
    // hash below can disperse across them instead of the one bundled plate
    // winning every scene.
    const resolvableDelta = resolvableTier(left) - resolvableTier(right);
    if (resolvableDelta !== 0) return resolvableDelta;
    // Full-width hash comparison (not modulo pool size): a modulo tiebreak ties
    // ~1/size of the time and the stable sort then always favours the first
    // plate, so a two-plate pool would still send one plate to most pins. A wide
    // hash makes ties vanishingly rare, spreading picks evenly across pins.
    const leftHash = hashKey(`${regionId}:${soundId}:${left.src}`);
    const rightHash = hashKey(`${regionId}:${soundId}:${right.src}`);
    return leftHash - rightHash;
  });
}

function assignUniqueRegionArtwork(
  regionId: string,
  soundIds: string[],
  sceneTags?: VariantTag[],
): Map<string, IconPoolEntry> {
  const usedSrc = new Set<string>();
  const assignments = new Map<string, IconPoolEntry>();

  for (const soundId of soundIds) {
    const fixed = fixedIconEntry(soundId, regionId);
    if (fixed) {
      const resolved = withDisplaySrc(fixed);
      assignments.set(soundId, resolved);
      usedSrc.add(resolved.src);
      continue;
    }

    const pool = getPoolForSound(soundId);
    if (!pool?.length) continue;

    const ranked = rankPoolEntries(pool, regionId, soundId, sceneTags);
    const pick = ranked.find((entry) => !usedSrc.has(resolveTileIconSrc(entry))) ?? ranked[0];
    const resolved = withDisplaySrc(pick);
    usedSrc.add(resolved.src);
    assignments.set(soundId, resolved);
  }

  return assignments;
}

export function getRegionArtworkMap(
  regionId: string,
  regionSoundIds: string[],
  sceneTags?: VariantTag[],
): Map<string, IconPoolEntry> {
  const key = `${regionId}:${regionSoundIds.join(',')}:${sceneTags?.join(',') ?? ''}`;
  const cached = regionArtCache.get(key);
  if (cached) return cached;

  const map = assignUniqueRegionArtwork(regionId, regionSoundIds, sceneTags);
  regionArtCache.set(key, map);
  return map;
}

export function getSoundIconEntry(
  soundId: string,
  variantKey?: string,
  sceneTags?: VariantTag[],
): IconPoolEntry | null {
  const fixed = fixedIconEntry(soundId);
  if (fixed) return withDisplaySrc(fixed);

  const pool = getPoolForSound(soundId);
  if (!pool?.length) return null;

  const key = variantKey ?? `${sessionSeed}:${soundId}`;
  return withDisplaySrc(pickFromPool(pool, key, sceneTags));
}

function insectArtOverrideEntry(soundId: string): IconPoolEntry | null {
  if (typeof window === 'undefined') return null;
  if (!isInsectArtOverrideTarget(soundId)) return null;
  const option = getInsectArtOption(loadInsectArtOptionId());
  return {
    src: option.src,
    title: option.title,
    author: option.author,
    license: option.license,
    sourceUrl: option.sourceUrl,
  };
}

export function getSoundArtwork(
  soundId: string,
  variantKey?: string,
  sceneTags?: VariantTag[],
): IconPoolEntry {
  const insectOverride = insectArtOverrideEntry(soundId);
  if (insectOverride) return withDisplaySrc(insectOverride);

  const fixed = fixedIconEntry(soundId);
  if (fixed) return withDisplaySrc(fixed);

  const pooled = getSoundIconEntry(soundId, variantKey, sceneTags);
  if (pooled) return pooled;

  const semanticPool = resolveSemanticPool(soundId);
  const fallbackPoolName = semanticPool ?? resolvePoolName(soundId) ?? 'forest';
  const fallbackPool = getPoolForSound(fallbackPoolName) ?? mergedIconPools.forest;
  if (fallbackPool?.length) {
    return withDisplaySrc(pickFromPool(fallbackPool, `${sessionSeed}:${soundId}`, sceneTags));
  }

  return withDisplaySrc({
    src: FALLBACK_ICON_SRC,
    title: 'Cat-Bird, 1. Male 2. Female (Plant Black-berry, Rubus villosus.), No. 28, Pl. 140',
    author: 'John James Audubon; lith. W. Endicott & Co.',
    license: 'Public domain (NYPL: no known U.S. copyright restrictions). Credit: From The New York Public Library.',
    sourceUrl: 'https://digitalcollections.nypl.org/items/2a28c850-c5f9-012f-9b77-58d385a7bc34',
  });
}

export function getSoundArtworkForRegion(
  regionId: string,
  regionSoundIds: string[],
  soundId: string,
  variantKey?: string,
  sceneTags?: VariantTag[],
): IconPoolEntry {
  const insectOverride = insectArtOverrideEntry(soundId);
  if (insectOverride) return withDisplaySrc(insectOverride);

  const regional = getRegionArtworkMap(regionId, regionSoundIds, sceneTags).get(soundId);
  if (regional) return regional;
  return getSoundArtwork(soundId, variantKey, sceneTags);
}

export type RegionArtContext = {
  id: string;
  soundIds: string[];
  /** Scene-wide region/climate flavour tags biasing tile art selection. */
  tags?: VariantTag[];
  /** Optional revision so art-preference changes remount tile consumers. */
  insectArtRevision?: number;
};

/**
 * Pick a deterministic, region/climate-appropriate landscape plate for a scene
 * hero from the given ordered pool names. Used by the procedural hero-art
 * resolver so searched / geo pins (and curated pins without a bespoke hero) get
 * fitting art instead of nothing or a mismatched plate.
 */
export function pickHeroArt(
  seedKey: string,
  poolNames: string[],
  sceneTags?: VariantTag[],
): IconPoolEntry | null {
  const pool: IconPoolEntry[] = [];
  for (const name of poolNames) {
    const p = mergedIconPools[name];
    if (p?.length) pool.push(...p);
  }
  if (pool.length === 0) return null;
  return withDisplaySrc(pickFromPool(pool, seedKey, sceneTags));
}

export function getSoundIconSrc(
  soundId: string,
  variantKey?: string,
  region?: RegionArtContext,
): string {
  if (region) {
    return getSoundArtworkForRegion(
      region.id,
      region.soundIds,
      soundId,
      variantKey,
      region.tags,
    ).src;
  }
  return getSoundArtwork(soundId, variantKey).src;
}

export { artworkAttributions };
