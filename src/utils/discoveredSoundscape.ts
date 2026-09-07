import { PROCEDURAL_ENVIRONMENT_ID, registerProceduralRegion } from '../data/environments';
import { validRecording, type DiscoveredRecording } from '../data/discoveredRecordings';
import type { Region } from '../data/types';
import { buildProceduralRegion, type ProceduralLocationInfo } from './proceduralSoundscape';
import { publicUrl } from './publicUrl';

export function regionFromRecordings(info: ProceduralLocationInfo, recordings: DiscoveredRecording[]): Region {
  const baseline = buildProceduralRegion(info);
  // Individual provider IDs remain fixed: shuffling must not cast a library
  // sound over the recording the discovery service actually selected.
  const sounds = recordings.filter(validRecording).slice(0, 4).map((recording) => ({
    id: `discovered-${recording.id}`, name: recording.name.slice(0, 80),
    category: 'ambient' as const, src: recording.src, loop: true, recording,
    description: recording.description,
  }));
  return {
    ...baseline, id: `${baseline.id}-recordings-${sounds.map(s => s.id).join('-')}`,
    sounds, bedSounds: sounds.map((sound, index) => ({ soundId: sound.id, volume: index === 0 ? 0.35 : 0.18 })),
    discovery: { status: 'ready', message: 'Nearby field recordings · locations supplied by their creators, not a live feed. Open a sound for credits. These are full recordings and may contain several sounds.' },
  };
}

/** Research only after a place is selected, never on every autocomplete key. */
export async function resolveDiscoveredSoundscape(info: ProceduralLocationInfo, signal?: AbortSignal) {
  const baseline = buildProceduralRegion(info);
  let region = baseline;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 12_000);
  try {
    const params = new URLSearchParams({ name: info.name, lat: String(info.lat), lng: String(info.lng) });
    if (info.geocode?.countryCode) params.set('countryCode', info.geocode.countryCode);
    const context = `${info.name} ${info.geocode?.displayName ?? ''} ${info.geocode?.type ?? ''}`.toLowerCase();
    const habitat = /mountain|alpine|peak|alps/.test(context) ? 'mountain'
      : /forest|woodland/.test(context) ? 'forest'
      : /beach|coast/.test(context) ? 'coast'
      : /city|suburb|borough/.test(context) ? 'urban' : undefined;
    if (habitat) params.set('habitat', habitat);
    const response = await fetch(`${publicUrl('/api/recordings')}?${params}`, { signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Discovery unavailable');
    const result = await response.json();
    if (result.status === 'ready' && Array.isArray(result.recordings)) {
      const recordings = result.recordings.filter(validRecording);
      if (recordings.length) region = regionFromRecordings(info, recordings);
    }
    if (region === baseline) {
      const status = result.status === 'unconfigured' ? 'unconfigured' : result.status === 'empty' ? 'empty' : 'unavailable';
      region = { ...baseline, discovery: { status, message: status === 'unconfigured'
        ? 'Live sound discovery is not connected. This is a library-based interpretation, not recordings verified for this place.'
        : status === 'empty' ? 'No suitable nearby recordings found. This is a library-based interpretation, not a verified local soundscape.'
          : 'Sound discovery is temporarily unavailable. Playing a library-based interpretation.' } };
    }
  } catch {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    region = { ...baseline, discovery: { status: 'unavailable', message: 'Sound discovery is temporarily unavailable. Playing a library-based interpretation.' } };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  registerProceduralRegion(region);
  return { environmentId: PROCEDURAL_ENVIRONMENT_ID, regionId: region.id };
}
