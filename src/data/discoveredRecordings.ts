/** Provider metadata, not proof of species identity or present-day conditions. */
export type DiscoveredRecording = {
  id: string;
  name: string;
  src: string;
  sourceUrl: string;
  author: string;
  license: string;
  lat: number;
  lng: number;
  duration: number;
  description: string;
};

export function validRecording(value: unknown): value is DiscoveredRecording {
  if (!value || typeof value !== 'object') return false;
  const r = value as DiscoveredRecording;
  if (!r.id || !r.name || !r.author) return false;
  if (!['id', 'name', 'src', 'sourceUrl', 'author', 'license', 'description'].every(
    (key) => typeof r[key as keyof DiscoveredRecording] === 'string'
      && String(r[key as keyof DiscoveredRecording]).length <= 4000,
  )) return false;
  if (![r.lat, r.lng, r.duration].every(Number.isFinite)
    || Math.abs(r.lat) > 90 || Math.abs(r.lng) > 180 || r.duration <= 0 || r.duration > 90) return false;
  try {
    if (!/^(CC0|CC BY|https:\/\/creativecommons\.org\/(?:licenses\/by\/\d\.\d\/?|publicdomain\/zero\/1\.0\/?))$/i.test(r.license)) return false;
    const media = new URL(r.src);
    const page = new URL(r.sourceUrl);
    return media.protocol === 'https:' && media.hostname === 'cdn.freesound.org'
      && !media.username && !media.password && !media.port
      && /^\/previews\/[\d/]+[^/]+\.(mp3|ogg)$/.test(media.pathname)
      && page.protocol === 'https:' && page.hostname === 'freesound.org'
      && !page.username && !page.password && !page.port
      && /^\/people\/[^/]+\/sounds\/\d+\/$/.test(page.pathname);
  } catch { return false; }
}
