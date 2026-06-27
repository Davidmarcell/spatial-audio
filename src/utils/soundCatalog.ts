import { globalAmbientLibrary } from '../data/globalAmbientLibrary';
import type { AddSoundTab, Season, SoundCategory, SoundDef } from '../data/types';

const AMBIENT_TAB_CATEGORIES: SoundCategory[] = ['ambient', 'water'];
const WILDLIFE_TAB_CATEGORIES: SoundCategory[] = ['bird', 'insect'];

const CATEGORY_LABELS: Record<SoundCategory, string> = {
  ambient: 'Ambient',
  water: 'Water',
  bird: 'Bird',
  insect: 'Insect',
};

/** Query term → related words checked against sound name, description, and keywords. */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  dog: ['bark', 'canine', 'puppy', 'dog'],
  rain: ['rain', 'shower', 'storm', 'drizzle', 'monsoon', 'thunder', 'weather'],
  traffic: ['traffic', 'road', 'cars', 'highway', 'urban', 'street', 'city'],
  wind: ['wind', 'breeze', 'gust', 'air'],
  water: ['water', 'stream', 'brook', 'creek', 'river', 'surf', 'ocean', 'sea', 'waves'],
  bird: ['bird', 'songbird', 'chirp', 'sing', 'wildlife', 'gull', 'owl'],
  forest: ['forest', 'woods', 'trees', 'rustle', 'nature', 'park'],
  night: ['night', 'nocturnal', 'owl', 'crickets', 'dark', 'evening'],
  beach: ['beach', 'surf', 'ocean', 'sea', 'coast', 'shore', 'waves'],
  city: ['city', 'urban', 'traffic', 'street', 'road'],
  insect: ['insect', 'crickets', 'cicadas', 'bugs'],
};

const DISPLAY_TAG_KEYWORDS: Array<{ label: string; terms: string[] }> = [
  { label: 'Rain', terms: ['rain', 'drizzle', 'storm', 'shower', 'monsoon', 'thunder'] },
  { label: 'Wind', terms: ['wind', 'breeze', 'gust'] },
  { label: 'Water', terms: ['water', 'stream', 'brook', 'creek', 'river', 'surf', 'ocean'] },
  { label: 'Bird', terms: ['bird', 'songbird', 'owl', 'gull', 'sparrow', 'warbler'] },
  { label: 'Insect', terms: ['insect', 'insects', 'crickets', 'cicadas', 'bugs'] },
  { label: 'Urban', terms: ['urban', 'city', 'traffic', 'street', 'road', 'cars'] },
  { label: 'Night', terms: ['night', 'nocturnal', 'evening', 'dusk', 'owl'] },
];

const GENERIC_TAG_TERMS = new Set([
  'ambient',
  'bird',
  'birds',
  'insect',
  'insects',
  'sound',
  'sounds',
  'loop',
  'global',
  'regional',
  'water',
  'weather',
]);

export function categoryLabel(category: SoundCategory): string {
  return CATEGORY_LABELS[category];
}

export function soundsForAddTab(sounds: SoundDef[], tab: AddSoundTab): SoundDef[] {
  const categories =
    tab === 'ambient' ? AMBIENT_TAB_CATEGORIES : WILDLIFE_TAB_CATEGORIES;
  return sounds.filter((sound) => categories.includes(sound.category));
}

export function filterSoundsBySeason(sounds: SoundDef[], season: Season): SoundDef[] {
  return sounds.filter((sound) => {
    if (!sound.seasons || sound.seasons.length === 0) return true;
    return sound.seasons.includes(season);
  });
}

export function mergeRegionalAndGlobalSounds(regionalSounds: SoundDef[]): SoundDef[] {
  const seen = new Set(regionalSounds.map((sound) => sound.id));
  const extras = globalAmbientLibrary.filter((sound) => !seen.has(sound.id));
  return [...regionalSounds, ...extras];
}

export function paletteSoundsForRegion(
  sounds: SoundDef[],
  tab: AddSoundTab,
  season: Season,
): SoundDef[] {
  return filterSoundsBySeason(soundsForAddTab(sounds, tab), season);
}

export function librarySoundsForRegion(sounds: SoundDef[], season: Season): SoundDef[] {
  return filterSoundsBySeason(sounds, season);
}

function expandSearchTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const terms = new Set<string>([normalized]);
  for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
    const all = [key, ...synonyms];
    if (all.some((word) => normalized.includes(word) || word.includes(normalized))) {
      for (const word of all) terms.add(word);
    }
  }
  return [...terms];
}

function soundSearchHaystack(sound: SoundDef): string {
  return [
    sound.name,
    categoryLabel(sound.category),
    sound.description ?? '',
    ...(sound.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

export function filterSoundsByQuery(sounds: SoundDef[], query: string): SoundDef[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return sounds;

  const terms = expandSearchTerms(normalized);
  return sounds.filter((sound) => {
    const haystack = soundSearchHaystack(sound);
    return terms.some((term) => haystack.includes(term));
  });
}

export function isGlobalLibrarySound(soundId: string): boolean {
  return globalAmbientLibrary.some((sound) => sound.id === soundId);
}

function soundTokenSet(sound: SoundDef): Set<string> {
  const joined = [
    sound.id,
    sound.name,
    sound.description ?? '',
    ...(sound.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase();
  const tokens = joined.split(/[^a-z0-9]+/).filter(Boolean);
  return new Set(tokens);
}

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function displayTagsForSound(
  sound: SoundDef,
  opts?: { isGlobal?: boolean; maxTags?: number },
): string[] {
  const maxTags = opts?.maxTags ?? 5;
  const tokens = soundTokenSet(sound);
  const tags: string[] = [opts?.isGlobal ? 'Global' : 'Regional', categoryLabel(sound.category)];

  for (const candidate of DISPLAY_TAG_KEYWORDS) {
    if (candidate.terms.some((term) => tokens.has(term)) && !tags.includes(candidate.label)) {
      tags.push(candidate.label);
    }
  }

  if (sound.seasons && sound.seasons.length > 0) {
    if (sound.seasons.length > 2) {
      tags.push('Seasonal');
    } else {
      for (const season of sound.seasons) tags.push(titleCase(season));
    }
  }

  if ((sound.keywords?.length ?? 0) > 0 && tags.length < maxTags) {
    const extra = sound.keywords
      ?.map((value) => value.toLowerCase())
      .find((value) => !GENERIC_TAG_TERMS.has(value) && !tags.includes(titleCase(value)));
    if (extra) tags.push(titleCase(extra));
  }

  return tags.slice(0, maxTags);
}
