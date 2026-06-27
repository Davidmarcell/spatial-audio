import type { Attribution } from '../data/types';
import { audioAttributionsFromPools } from './soundPools';

/**
 * Audio attributions for the credits page. Derived directly from the variant
 * pool manifest (src/data/soundClips.generated.ts) so every bundled clip — and
 * only clips with a recorded source + licence — is credited automatically.
 */
export const attributions: Attribution[] = audioAttributionsFromPools();
