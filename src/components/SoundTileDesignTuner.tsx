import type { DetailTarget } from './SoundArtDetail';
import type { RegionArtContext } from '../data/iconArt';

type SoundTileDesignTunerProps = {
  regionArt: RegionArtContext;
  sampleTarget?: DetailTarget | null;
};

/** Product preview hides the SoundTile design launcher chip. */
export function SoundTileDesignTuner(_: SoundTileDesignTunerProps) {
  return null;
}
