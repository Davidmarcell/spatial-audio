import type { Attribution } from '../data/types';
import { audioAttributionsFromPools } from './soundPools';

/**
 * UI / transition one-shots that sit outside the regional variant pools.
 * Credited in ATTRIBUTIONS.md; kept here so the source list stays complete.
 */
export const uiAudioAttributions: Attribution[] = [
  {
    file: 'public/audio/ui/enter-whoosh.mp3',
    title: 'Swooshes, whoosh, short, deep (~4.6s, natural swell with smooth exponential fade-out)',
    author: 'susssounds',
    license: 'CC0 1.0',
    sourceUrl: 'https://freesound.org/people/susssounds/sounds/752068/',
  },
  {
    file: 'public/audio/ui/globe-ambient.mp3',
    title: 'Ethereal globe browse ambient (synthesized soft noise + pad)',
    author: 'Saudade',
    license: 'Original (app asset)',
    sourceUrl: '',
  },
];

/**
 * Audio attributions for the credits page. Derived directly from the variant
 * pool manifest (src/data/soundClips.generated.ts) so every bundled clip — and
 * only clips with a recorded source + licence — is credited automatically.
 * UI one-shots are appended after the pool-derived list.
 */
export const attributions: Attribution[] = [
  ...audioAttributionsFromPools(),
  ...uiAudioAttributions,
];
