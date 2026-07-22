import type { SoundCategory, SoundDef } from '../data/types';
import { displaySoundName } from '../utils/soundCatalog';

const CATEGORY_HINTS: Record<SoundCategory, string> = {
  bird: 'Bird call',
  ambient: 'Ambient atmosphere',
  water: 'Water sounds',
  insect: 'Insect chorus',
};

export function getSoundTooltipLines(sound: SoundDef): { title: string; description: string } {
  const description = sound.description ?? CATEGORY_HINTS[sound.category];
  return { title: displaySoundName(sound), description };
}

export function getSoundTooltip(sound: SoundDef): string {
  const { title, description } = getSoundTooltipLines(sound);
  return `${title} · ${description}`;
}
