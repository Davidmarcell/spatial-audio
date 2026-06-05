/** Hero thumbnail art for curated locations (Met / NYPL / Wikimedia). */
export type LocationArtEntry = {
  src: string;
  title: string;
  author: string;
  sourceUrl: string;
};

const locationArtByKey: Record<string, LocationArtEntry> = {
  'nz-forest:auckland': {
    src: '/icons/tui.jpg',
    title: 'Tui adult and young',
    author: 'John Gerrard Keulemans (Buller)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tui_adult_and_young.jpg',
  },
  'urban-europe:london': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Westminster_from_the_River_Thames%2C_London%2C_by_Joseph_Mallord_William_Turner.jpg/330px-Westminster_from_the_River_Thames%2C_London%2C_by_Joseph_Mallord_William_Turner.jpg',
    title: 'Westminster from the River Thames, London',
    author: 'Joseph Mallord William Turner',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Westminster_from_the_River_Thames,_London,_by_Joseph_Mallord_William_Turner.jpg',
  },
  'urban-americas:bed-stuy': {
    src: '/icons/met/853645.jpg',
    title: 'Rooftops, Brooklyn',
    author: 'Fidelia Bridges',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/853645',
  },
  'southeast-asia:chiang-mai': {
    src: '/icons/met/10378.jpg',
    title: 'Forest Scene',
    author: 'Johann Hermann Carmiencke',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/10378',
  },
  'brazil-coast:rio-de-janeiro': {
    src: '/icons/met/334086.jpg',
    title: 'On the Beach',
    author: 'Eugène Boudin',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/334086',
  },
  'alpine-europe:dolomites': {
    src: '/icons/met/11306.jpg',
    title: 'Birch Tree, Niagara',
    author: 'John Frederick Kensett',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/11306',
  },
  'nz-forest:nz-forest-general': {
    src: '/icons/bellbird.jpg',
    title: 'New Zealand Bellbird',
    author: 'John Gerrard Keulemans (Buller, 1888)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bul01BirdP009_(cropped).jpg',
  },
  'costa-rica-rainforest:pacific-slope': {
    src: '/icons/howler.jpg',
    title: 'Red howler monkey',
    author: 'Iconographia Zoologica (1863)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mycetes_seniculus_-_1863_-_Print_-_Iconographia_Zoologica_-_Special_Collections_University_of_Amsterdam_-_UBA01_IZ20200132.tif',
  },
};

export function getLocationArt(
  environmentId: string,
  regionId: string,
): LocationArtEntry | null {
  return locationArtByKey[`${environmentId}:${regionId}`] ?? null;
}

export function getLocationArtForItem(item: {
  environmentId: string;
  regionId: string;
}): LocationArtEntry | null {
  return getLocationArt(item.environmentId, item.regionId);
}
