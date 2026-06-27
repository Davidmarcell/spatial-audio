import type { ArtworkAttribution } from './types';

/**
 * Credit lines for curated location hero art that is not part of the
 * sound-icon download pipeline (scripts/icon-manifest.json). Auckland Museum
 * open-access images are reusable under "No known copyright restrictions"
 * (Auckland Museum CC BY terms) provided the Museum is attributed; Wikimedia
 * Commons items are public domain (the original artist's death predates the
 * copyright term).
 */
export const locationArtAttributions: ArtworkAttribution[] = [
  {
    file: '/icons/auckland-domain.jpg',
    title: 'Auckland Domain where the cricket ground is',
    author:
      'Watkins, Kennett (c. 1890). Auckland War Memorial Museum Tāmaki Paenga Hira. PD-1996-1-3.',
    license: 'No known copyright restrictions (Auckland Museum)',
    sourceUrl: 'https://www.aucklandmuseum.com/discover/collections/record/997763',
  },
  {
    file: '/icons/silver-tree-fern.jpg',
    title: 'Silver Tree Fern (Cyathia dealbata), Karori Forest',
    author:
      'Swainson, William (1840–1850). Auckland War Memorial Museum Tāmaki Paenga Hira. PD-1961-9-31.',
    license: 'No known copyright restrictions (Auckland Museum)',
    sourceUrl: 'https://www.aucklandmuseum.com/discover/collections/record/995546',
  },
  {
    file: '/icons/dolomites.jpg',
    title: 'Der Cimon della Pala in den Dolomiten',
    author: 'Compton, Edward Theodore (1896), via Wikimedia Commons.',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Edward_Theodore_Compton_Der_Cimon_della_Pala_in_den_Dolomiten_1896.jpg',
  },
  {
    file: '/icons/met/10481.jpg',
    title: 'Heart of the Andes',
    author: 'Church, Frederic Edwin (1859). The Metropolitan Museum of Art.',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/10481',
  },
  {
    file: '/icons/met/38064.jpg',
    title: 'Buddhist Temple Painting',
    author: 'Unidentified artist, Thailand (early 19th century). The Metropolitan Museum of Art.',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/38064',
  },
  {
    file: '/icons/met/380481.jpg',
    title: '“Rounding a Bend” on the Mississippi – The Parting Salute',
    author: 'Palmer, Frances Flora Bond (Currier & Ives, 1866). The Metropolitan Museum of Art.',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/380481',
  },
  {
    file: '/icons/met/830271.jpg',
    title: 'Bald Ibis from the Cape of Good Hope, from “Histoire Naturelle des Oiseaux”',
    author: 'Martinet, François Nicolas (1770–86). The Metropolitan Museum of Art.',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/830271',
  },
  {
    file: '/icons/met/437310.jpg',
    title: 'The Boulevard Montmartre on a Winter Morning',
    author: 'Pissarro, Camille (1897). The Metropolitan Museum of Art.',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/437310',
  },
  {
    file: '/icons/met/439844.jpg',
    title: 'Heroic Landscape with Rainbow',
    author: 'Koch, Joseph Anton (1824). The Metropolitan Museum of Art.',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/439844',
  },
  {
    file: '/icons/met/39557.jpg',
    title: 'Wooded Mountains at Dusk',
    author: 'Kuncan (dated 1666). The Metropolitan Museum of Art.',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/39557',
  },
  {
    file: '/icons/met/381008.jpg',
    title: 'Evening, New York Harbor',
    author: 'Farrer, Henry (1884). The Metropolitan Museum of Art.',
    license: 'CC0 (The Metropolitan Museum of Art)',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/381008',
  },
];
