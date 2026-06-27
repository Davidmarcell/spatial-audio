/** Per-icon zoom/position to crop plate margins and show full-bleed artwork. */
export type IconCrop = {
  scale: number;
  x?: string;
  y?: string;
};

const DEFAULT: IconCrop = { scale: 1.38 };

/** Crops keyed by Met / artwork file — trims white paper margins on scans. */
export const iconCropBySrc: Record<string, IconCrop> = {
  '/icons/gray-catbird.jpg': { scale: 1.35, y: '42%' },
  '/icons/northern-cardinal.jpg': { scale: 1.28, y: '44%' },
  '/icons/blue-jay.jpg': { scale: 1.32, y: '46%' },
  '/icons/met/10378.jpg': { scale: 1.55, y: '46%' },
  '/icons/met/11124.jpg': { scale: 1.48, y: '44%' },
  '/icons/met/11306.jpg': { scale: 2.35, y: '42%' },
  '/icons/met/11908.jpg': { scale: 1.62, y: '48%' },
  '/icons/met/13115.jpg': { scale: 1.52, y: '45%' },
  '/icons/met/11804.jpg': { scale: 1.45, y: '48%' },
  '/icons/met/19239.jpg': { scale: 1.5, y: '46%' },
  '/icons/met/266296.jpg': { scale: 1.55, y: '44%' },
  '/icons/met/339882.jpg': { scale: 1.48, y: '42%' },
  '/icons/met/371952.jpg': { scale: 1.5, y: '45%' },
  '/icons/met/388212.jpg': { scale: 1.52, y: '43%' },
  '/icons/met/488326.jpg': { scale: 1.42, y: '44%' },
  '/icons/met/853645.jpg': { scale: 1.48, y: '46%' },
  '/icons/met/15519.jpg': { scale: 2.05, y: '40%' },
  '/icons/met/15775.jpg': { scale: 2.4, y: '38%' },
  '/icons/met/17053.jpg': { scale: 1.58, y: '46%' },
  '/icons/met/334086.jpg': { scale: 1.5, y: '44%' },
  '/icons/met/338617.jpg': { scale: 1.45, y: '42%' },
  '/icons/met/339153.jpg': { scale: 1.55, y: '46%' },
  '/icons/met/363843.jpg': { scale: 1.42, y: '44%' },
  '/icons/quetzal.jpg': { scale: 1.2, y: '42%' },
  '/icons/met/460052.jpg': { scale: 1.48, y: '45%' },
  '/icons/met/489985.jpg': { scale: 1.5, y: '44%' },
  '/icons/met/824771.jpg': { scale: 1.65, y: '46%' },
  '/icons/forest-stream.jpg': { scale: 1.42, y: '44%' },
  '/icons/waldbach.jpg': { scale: 1.48, y: '42%' },
  '/icons/hiroshige-rain.jpg': { scale: 1.35, y: '46%' },
  '/icons/bricher-surf.jpg': { scale: 1.4, y: '48%' },
  '/icons/wind-trees.jpg': { scale: 1.5, y: '44%' },
  '/icons/met/12586.jpg': { scale: 1.55, y: '42%' },
  '/icons/met/12307.jpg': { scale: 1.52, y: '44%' },
  '/icons/met/10770.jpg': { scale: 1.58, y: '46%' },
  '/icons/met/12392.jpg': { scale: 1.5, y: '42%' },
  '/icons/met/55433.jpg': { scale: 1.38, y: '48%' },
  '/icons/met/11131.jpg': { scale: 1.4, y: '44%' },
  '/icons/met/11138.jpg': { scale: 1.45, y: '48%' },
  '/icons/met/371022.jpg': { scale: 1.45, y: '46%' },
  '/icons/met/286187.jpg': { scale: 1.5, y: '46%' },
};

export const iconCropBySound: Record<string, IconCrop> = {
  tui: { scale: 1.55, y: '38%' },
  bellbird: { scale: 1.35, y: '45%' },
  morepork: { scale: 1.3, y: '40%' },
  fantail: { scale: 1.35, y: '42%' },
  gull: { scale: 1.28, y: '44%' },
  toucan: { scale: 1.22, y: '48%' },
  howler: { scale: 1.2 },
  insects: { scale: 1.18, y: '46%' },
  quetzal: { scale: 1.2, y: '42%' },
  'understory-bird': { scale: 1.22, y: '48%' },
  surf: { scale: 1.35 },
  wind: { scale: 1.45, y: '44%' },
  'wind-forest': { scale: 1.45, y: '44%' },
  'forest-ambience': { scale: 1.55, y: '44%' },
  rain: { scale: 1.35 },
  stream: { scale: 1.5, y: '42%' },
  'alpine-wind': { scale: 1.48, y: '44%' },
  'mountain-stream': { scale: 2.2, y: '38%' },
  'forest-stream': { scale: 1.42, y: '44%' },
  'bush-stream': { scale: 1.5, y: '42%' },
  'urban-creek': { scale: 1.5, y: '42%' },
  'global-stream': { scale: 1.5, y: '42%' },
  'harbor-traffic': { scale: 1.48, y: '43%' },
  'park-rustle': { scale: 1.5, y: '45%' },
  'forest-valley': { scale: 1.58, y: '44%' },
  'alpine-bird': { scale: 1.42, y: '42%' },
  'gray-catbird': { scale: 1.5, y: '44%' },
  'northern-cardinal': { scale: 1.35, y: '42%' },
  'blue-jay': { scale: 1.4, y: '44%' },
};

export function getIconCrop(
  soundId: string,
  src?: string,
  size?: 'canvas' | 'compact' | 'palette' | 'detail',
): IconCrop {
  const base =
    (src && iconCropBySrc[src]) || iconCropBySound[soundId] || DEFAULT;
  if (size !== 'detail') return base;
  return { ...base, scale: Math.max(1, base.scale * 0.88) };
}
