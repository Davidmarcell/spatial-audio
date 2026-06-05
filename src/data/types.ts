export type SoundCategory = 'bird' | 'ambient' | 'water' | 'insect';

export type SoundDef = {
  id: string;
  name: string;
  category: SoundCategory;
  src: string;
  loop: boolean;
  description?: string;
};

export type BedSound = {
  soundId: string;
  volume: number;
  position?: SpatialPoint;
};

export type Region = {
  id: string;
  name: string;
  sounds: SoundDef[];
  bedSounds?: BedSound[];
};

export type Environment = {
  id: string;
  name: string;
  regions: Region[];
};

export type SpatialPoint = {
  x: number;
  y: number;
};

export type ActiveSound = {
  instanceId: string;
  soundId: string;
  position: SpatialPoint;
  volume: number;
};

export type Attribution = {
  file: string;
  title: string;
  author: string;
  license: string;
  sourceUrl: string;
};

export type ArtworkAttribution = Attribution;
