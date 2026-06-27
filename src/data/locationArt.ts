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
    src: '/icons/auckland-domain.jpg',
    globeSrc: '/icons/globe/auckland-domain.jpg',
    title: 'Auckland Domain where the cricket ground is',
    author: 'Kennett Watkins (c. 1890), Auckland Museum',
    sourceUrl: 'https://www.aucklandmuseum.com/discover/collections/record/997763',
  },
  'urban-europe:london': {
    src: '/icons/met/489985.jpg',
    globeSrc: '/icons/globe/489985.jpg',
    title: 'Rain Landscape',
    author: 'Vasily Kandinsky',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/489985',
  },
  'urban-americas:bed-stuy': {
    src: '/icons/met/853645.jpg',
    globeSrc: '/icons/globe/853645.jpg',
    title: 'Rooftops, Brooklyn',
    author: 'Fidelia Bridges',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/853645',
  },
  'southeast-asia:chiang-mai': {
    src: '/icons/met/10378.jpg',
    globeSrc: '/icons/globe/10378.jpg',
    title: 'Forest Scene',
    author: 'Johann Hermann Carmiencke',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/10378',
  },
  'brazil-coast:rio-de-janeiro': {
    src: '/icons/met/334086.jpg',
    globeSrc: '/icons/globe/334086.jpg',
    title: 'On the Beach',
    author: 'Eugène Boudin',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/334086',
  },
  'alpine-europe:dolomites': {
    src: '/icons/dolomites.jpg',
    globeSrc: '/icons/globe/dolomites.jpg',
    title: 'Der Cimon della Pala in den Dolomiten',
    author: 'Edward Theodore Compton (1896)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Edward_Theodore_Compton_Der_Cimon_della_Pala_in_den_Dolomiten_1896.jpg',
  },
  'nz-forest:nz-forest-general': {
    src: '/icons/silver-tree-fern.jpg',
    globeSrc: '/icons/globe/silver-tree-fern.jpg',
    title: 'Silver Tree Fern (Cyathia dealbata), Karori Forest',
    author: 'William Swainson (1840–1850), Auckland Museum',
    sourceUrl: 'https://www.aucklandmuseum.com/discover/collections/record/995546',
  },
  'costa-rica-rainforest:pacific-slope': {
    src: '/icons/met/10481.jpg',
    title: 'Heart of the Andes',
    author: 'Frederic Edwin Church (1859)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/10481',
  },
};

/** Globe polaroid / list art keyed by worldLocations.id (incl. procedural pins). */
const globePinArtById: Record<string, LocationArtEntry> = {
  'new-york': {
    src: '/icons/met/381008.jpg',
    title: 'Evening, New York Harbor',
    author: 'Henry Farrer (1884)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/381008',
  },
  'new-orleans': {
    src: '/icons/met/380481.jpg',
    title: '“Rounding a Bend” on the Mississippi – The Parting Salute',
    author: 'Frances Flora Bond Palmer (Currier & Ives, 1866)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/380481',
  },
  havana: {
    src: '/icons/met/12392.jpg',
    title: 'Street Scene',
    author: 'The Met Open Access',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/12392',
  },
  'amazon-rainforest': {
    src: '/icons/howler.jpg',
    globeSrc: '/icons/globe/howler.jpg',
    title: 'Red howler monkey',
    author: 'Iconographia Zoologica (1863)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mycetes_seniculus_-_1863_-_Print_-_Iconographia_Zoologica_-_Special_Collections_University_of_Amsterdam_-_UBA01_IZ20200132.tif',
  },
  banff: {
    src: '/icons/waldbach.jpg',
    title: 'Waldbach',
    author: 'The Met Open Access',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/393450',
  },
  paris: {
    src: '/icons/met/437310.jpg',
    title: 'The Boulevard Montmartre on a Winter Morning',
    author: 'Camille Pissarro (1897)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/437310',
  },
  venice: {
    src: '/icons/met/751141.jpg',
    title: 'Venice',
    author: 'The Met Open Access',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/751141',
  },
  'swiss-alps': {
    src: '/icons/met/439844.jpg',
    title: 'Heroic Landscape with Rainbow',
    author: 'Joseph Anton Koch (1824)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/439844',
  },
  seville: {
    src: '/icons/met/55433.jpg',
    title: 'Landscape',
    author: 'The Met Open Access',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/55433',
  },
  marrakech: {
    src: '/icons/met/10770.jpg',
    title: 'Desert Scene',
    author: 'The Met Open Access',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/10770',
  },
  serengeti: {
    src: '/icons/quetzal.jpg',
    title: 'Resplendent quetzal',
    author: 'John Gould',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Resplendent_Quetzal.jpg',
  },
  'cape-town': {
    src: '/icons/met/830271.jpg',
    title: 'Bald Ibis from the Cape of Good Hope',
    author: 'François Nicolas Martinet (1770–86)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/830271',
  },
  kyoto: {
    src: '/icons/hiroshige-rain.jpg',
    title: 'Rain Landscape',
    author: 'Utagawa Hiroshige',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/489985',
  },
  tokyo: {
    src: '/icons/met/12307.jpg',
    title: 'Landscape',
    author: 'The Met Open Access',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/12307',
  },
  bangkok: {
    src: '/icons/met/38064.jpg',
    title: 'Buddhist Temple Painting',
    author: 'Unidentified artist, Thailand (early 19th century)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/38064',
  },
  himalayas: {
    src: '/icons/met/39557.jpg',
    title: 'Wooded Mountains at Dusk',
    author: 'Kuncan (1666)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/39557',
  },
  sydney: {
    src: '/icons/bricher-surf.jpg',
    title: 'Breaking Surf, Bricher',
    author: 'Alfred Thompson Bricher',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/11306',
  },
  bali: {
    src: '/icons/forest-stream.jpg',
    title: 'Forest stream',
    author: 'The Met Open Access',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/12586',
  },
  lapland: {
    src: '/icons/wind-trees.jpg',
    title: 'Wind in trees',
    author: 'The Met Open Access',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/393450',
  },
};

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
  return getLocationArt(item.environmentId, item.regionId);
}
