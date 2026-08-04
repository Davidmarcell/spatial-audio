/**
 * Reviewable insect-tile art options. Cycle with the Insects chip (or
 * `?insectArt=<id>`) so alternate naturalist plates can be compared live.
 */

export type InsectArtOption = {
  id: string;
  label: string;
  src: string;
  title: string;
  author: string;
  license: string;
  sourceUrl: string;
};

export const INSECT_ART_STORAGE_KEY = 'saudade:insect-art-option';
export const INSECT_ART_CHANGE_EVENT = 'saudade:insect-art-change';

export const INSECT_ART_OPTIONS: InsectArtOption[] = [
  {
    id: 'cicada-jardine',
    label: 'Cicada (Jardine)',
    src: '/icons/insect-jardine-plate.jpg',
    title: "Naturalist's Library Entomology, Plate 21 (cicada)",
    author: "Sir William Jardine (Naturalist's Library)",
    license: 'Public domain',
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Jardine_Naturalist's_library_Entomology_Plate_21.jpg",
  },
  {
    id: 'cicada-maculata',
    label: 'Cicada (Maculata)',
    src: '/icons/cicada-maculata.jpg',
    title: 'Illustrations of Exotic Entomology — Cicada Maculata',
    author: 'Dru Drury / John Obadiah Westwood',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Illustrations_of_Exotic_Entomology_Cicada_Maculata.jpg',
  },
  {
    id: 'cricket',
    label: 'Cricket',
    src: '/icons/cricket-field-ensifera.jpg',
    title: 'Cricket, from a plate of Ensifera (crickets and bush-crickets)',
    author: 'Gotthilf Heinrich von Schubert, Naturgeschichte (1886)',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ensifera_Naturgeschichte.jpg',
  },
  {
    id: 'katydid',
    label: 'Katydid',
    src: '/icons/insect-field-cricket-plate.jpg',
    title:
      'Locusta sexpunctata, Gryllus campestris, Gryllotalpa mitidula (plate detail)',
    author: '19th-century natural history plate (Wikimedia Commons)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Locusta_sexpunctata(grasshopper_of_six_points),_Gryllus_campestris(field_crickets),_Gryllotalpa_mitidula(Australian_Crickets).jpg',
  },
  {
    id: 'moth',
    label: 'Emperor moth',
    src: '/icons/insects.jpg',
    title: 'Metamorphosis of a Small Emperor Moth on a Damson Plum (plate 13)',
    author: 'Maria Sibylla Merian (Getty Museum)',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Metamorphosis_of_a_Small_Emperor_Moth_on_a_Damson_Plum,_plate_13_of_the_Caterpillar_Book,_by_Maria_Sibylla_Merian_(Getty_109Q5N).jpg',
  },
  {
    id: 'grasshopper-plate',
    label: 'Grasshopper plate',
    src: '/icons/insect-natural-history.jpg',
    title:
      'Natural history of the animal kingdom for the use of young people (Plate XXIV)',
    author: 'W. F. Kirby / public-domain plate',
    license: 'Public domain',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Natural_history_of_the_animal_kingdom_for_the_use_of_young_people_(Plate_XXIV)_(5974465081).jpg',
  },
];

const OPTION_BY_ID = new Map(INSECT_ART_OPTIONS.map((opt) => [opt.id, opt]));

export function getInsectArtOption(id: string | null | undefined): InsectArtOption {
  if (id && OPTION_BY_ID.has(id)) return OPTION_BY_ID.get(id)!;
  return INSECT_ART_OPTIONS[0];
}

export function loadInsectArtOptionId(): string {
  if (typeof window === 'undefined') return INSECT_ART_OPTIONS[0].id;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('insectArt');
  if (fromQuery && OPTION_BY_ID.has(fromQuery)) return fromQuery;
  const stored = window.localStorage.getItem(INSECT_ART_STORAGE_KEY);
  if (stored && OPTION_BY_ID.has(stored)) return stored;
  return INSECT_ART_OPTIONS[0].id;
}

export function persistInsectArtOptionId(id: string): void {
  if (typeof window === 'undefined') return;
  if (!OPTION_BY_ID.has(id)) return;
  window.localStorage.setItem(INSECT_ART_STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent(INSECT_ART_CHANGE_EVENT, { detail: { id } }));
}

export function cycleInsectArtOptionId(currentId: string): string {
  const index = INSECT_ART_OPTIONS.findIndex((opt) => opt.id === currentId);
  const next = INSECT_ART_OPTIONS[(index + 1) % INSECT_ART_OPTIONS.length];
  persistInsectArtOptionId(next.id);
  return next.id;
}

/** Sound ids that should follow the live insect-art preference. */
export function isInsectArtOverrideTarget(soundId: string): boolean {
  return /insect|cicada|cricket|higurashi/.test(soundId);
}
