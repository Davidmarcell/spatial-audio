import assert from 'node:assert/strict';
import { validRecording, type DiscoveredRecording } from '../src/data/discoveredRecordings.ts';
import { regionFromRecordings, resolveDiscoveredSoundscape } from '../src/utils/discoveredSoundscape.ts';
import { getRegion } from '../src/data/environments.ts';
import { selectSceneVariants } from '../src/utils/soundscapeSelection.ts';
import { buildScenePayload, decodeScenePayload } from '../src/utils/sceneShare.ts';

const info = { name: 'Hanoi', lat: 21.03, lng: 105.85, placeId: 'fixture', geocode: { countryCode: 'vn', type: 'city' } };
const recording: DiscoveredRecording = { id: '1234', name: 'Hanoi street field recording',
  src: 'https://cdn.freesound.org/previews/1/1234_567-hq.mp3', sourceUrl: 'https://freesound.org/people/recorder/sounds/1234/',
  author: 'recorder', license: 'https://creativecommons.org/licenses/by/4.0/',
  lat: 21.031, lng: 105.851, duration: 40, description: 'A street recording.' };
assert.ok(validRecording(recording));
for (const patch of [{ src: 'https://evil.test/clip.mp3' }, { license: 'CC BY-NC' }, { lat: NaN }, { duration: 1000 }, { sourceUrl: 'javascript:alert(1)' }]) {
  assert.equal(validRecording({ ...recording, ...patch }), false);
}
const region = regionFromRecordings(info, [recording]);
assert.equal(region.sounds[0].src, recording.src);
assert.equal(selectSceneVariants(region.sounds, { seed: region.id }).size, 0, 'library variant casting must not override discovered audio');
const payload = await buildScenePayload({ environmentId: 'procedural', regionId: region.id,
  locationName: info.name, recordings: [recording], sounds: [{ soundId: region.sounds[0].id, position: { x: 0, y: .5 }, volume: .3 }] });
const restored = await decodeScenePayload(payload);
assert.ok(restored);
assert.equal(getRegion('procedural', restored.regionId)?.sounds[0].src, recording.src);
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => Response.json({ status: 'unconfigured', recordings: [] });
  const fallback = await resolveDiscoveredSoundscape(info);
  assert.match(getRegion(fallback.environmentId, fallback.regionId)!.discovery!.message, /not recordings verified/);
  globalThis.fetch = async () => Response.json({ status: 'ready', recordings: [recording] });
  const resolved = await resolveDiscoveredSoundscape(info);
  assert.equal(getRegion(resolved.environmentId, resolved.regionId)!.discovery!.status, 'ready');
  const abort = new AbortController(); abort.abort();
  await assert.rejects(resolveDiscoveredSoundscape(info, abort.signal), { name: 'AbortError' });
} finally { globalThis.fetch = originalFetch; }
console.log('Discovery client, host/license validation, fallback, cancellation and exact-recording sharing checks passed.');
