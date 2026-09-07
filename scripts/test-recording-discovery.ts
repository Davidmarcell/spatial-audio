import assert from 'node:assert/strict';
import { discoverRecordings, type RecordingDiscoveryInput } from '../server/recordingDiscovery.ts';

const place: RecordingDiscoveryInput = { name: 'Example city', lat: 40.7, lng: -74, habitat: 'urban', countryCode: 'us' };
const token = 'server-test-token';
function row(id: number, changes: Record<string, unknown> = {}) {
  return {
    id, name: `Street traffic ${id}`, description: 'Field recording of street traffic and a tram.',
    tags: ['field-recording', 'traffic'], username: 'recorder',
    url: `https://freesound.org/people/recorder/sounds/${id}/`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    geotag: '40.7 -74', duration: 45, filesize: 5_000_000, channels: 2, samplerate: 44100, is_remix: false,
    previews: { 'preview-lq-mp3': `https://cdn.freesound.org/previews/1/${id}_9-lq.mp3` },
    ...changes,
  };
}
function metadata(rows: unknown[]) { return new Response(JSON.stringify({ results: rows }), { headers: { 'content-type': 'application/json' } }); }
function mock(handler: (url: URL, init: RequestInit | undefined, index: number) => Response | Promise<Response>) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return handler(url, init, calls.length - 1);
  }) as typeof fetch;
  return { fetcher, calls };
}
let passed = 0;
async function test(name: string, run: () => Promise<void>) { await run(); passed += 1; console.log(`✓ ${name}`); }

await test('missing server token returns unconfigured without any request', async () => {
  const { fetcher, calls } = mock(() => { throw new Error('must not fetch'); });
  const result = await discoverRecordings(place, { fetch: fetcher });
  assert.equal(result.status, 'unconfigured');
  assert.deepEqual(result.recordings, []);
  assert.equal(calls.length, 0);
});

await test('current geographic API, header authentication, four-result cap and nearest ordering', async () => {
  const { fetcher, calls } = mock(() => metadata([row(1, { geotag: '40.72 -74' }), row(2), row(3), row(4), row(5)]));
  const result = await discoverRecordings(place, { token, fetch: fetcher });
  assert.equal(result.status, 'ready');
  assert.equal(result.recordings.length, 4);
  assert.equal(result.recordings[0].id, 'freesound-2');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin + calls[0].url.pathname, 'https://freesound.org/apiv2/search/');
  assert.match(calls[0].url.searchParams.get('filter')!, /\{!geofilt sfield=geotag pt=40\.7,-74 d=5\}/);
  assert.match(calls[0].url.searchParams.get('filter')!, /duration:\[3 TO 90\]/);
  assert.match(calls[0].url.searchParams.get('filter')!, /traffic/);
  assert.equal(new Headers(calls[0].init?.headers).get('Authorization'), `Token ${token}`);
  assert.equal(calls[0].url.href.includes(token), false);
  assert.equal(calls[0].init?.redirect, 'error');
});

await test('two geographic tiers deduplicate and never accept distant or missing geotags', async () => {
  const { fetcher, calls } = mock(() => metadata([
    row(1), row(1), row(2, { geotag: '41.7 -74' }), row(3, { geotag: null }),
    row(4, { geotag: '40.8 -74' }),
    row(5, { geotag: 'NaN -74' }), row(6, { geotag: '40.7 -74 10' }),
  ]));
  const result = await discoverRecordings(place, { token, fetch: fetcher });
  assert.equal(calls.length, 2);
  assert.match(calls[1].url.searchParams.get('filter')!, / d=20\}/);
  assert.deepEqual(result.recordings.map((item) => item.id), ['freesound-1', 'freesound-4']);
  assert.match(result.message, /within 20 km/);
});

await test('only CC0 and CC-BY allowlisted licenses survive', async () => {
  const { fetcher } = mock(() => metadata([
    row(1, { license: 'Creative Commons 0' }), row(2, { license: 'Attribution' }),
    row(3, { license: 'http://creativecommons.org/licenses/by/3.0/' }),
    row(4, { license: 'Attribution NonCommercial' }), row(5, { license: 'https://creativecommons.org/licenses/by-nc/4.0/' }),
    row(6, { license: 'https://creativecommons.org/licenses/by-sa/4.0/' }),
    row(7, { license: 'https://creativecommons.org.evil.test/licenses/by/4.0/' }), row(8, { license: 'unknown' }),
  ]));
  const result = await discoverRecordings(place, { token, fetch: fetcher });
  assert.deepEqual(result.recordings.map((item) => item.id), ['freesound-1', 'freesound-2', 'freesound-3']);
  assert.equal(result.recordings[0].license, 'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.equal(result.recordings[1].license, 'CC BY');
  assert.equal(result.recordings[2].license, 'https://creativecommons.org/licenses/by/3.0/');
});

await test('metadata screens habitat mismatch, music, speech and synthetic content', async () => {
  const { fetcher } = mock(() => metadata([
    row(1, { name: 'Forest birds', description: 'Bird song in the forest.', tags: ['forest', 'bird'] }),
    row(2, { description: 'Street traffic with music' }), row(3, { description: 'Street voices talking' }),
    row(4, { description: 'Synthetic street ambience' }), row(5, { description: 'Street music generated by AI' }),
    row(6, { description: 'Street singer song' }), row(7, { is_remix: true }), row(8),
  ]));
  const result = await discoverRecordings(place, { token, fetch: fetcher });
  assert.deepEqual(result.recordings.map((item) => item.id), ['freesound-8']);
});

await test('natural bird song remains eligible for a forest habitat', async () => {
  const { fetcher } = mock(() => metadata([
    row(1, { name: 'Bird song', description: 'Birds singing in woodland.', tags: ['forest', 'birds'] }),
    row(2, { name: 'Wind and rain', description: 'Wind and rain outside a house.', tags: ['wind', 'rain'] }),
  ]));
  const result = await discoverRecordings({ ...place, name: 'Example forest', habitat: 'forest' }, { token, fetch: fetcher });
  assert.equal(result.recordings.length, 1);
});

await test('preview/source hosts, protocols, identity and size/duration limits are rechecked', async () => {
  const { fetcher } = mock(() => metadata([
    row(1, { duration: 91 }), row(2, { filesize: 33 * 1024 * 1024 }), row(3, { duration: Infinity }),
    row(4, { previews: { 'preview-lq-mp3': 'http://cdn.freesound.org/previews/1/4_9-lq.mp3' } }),
    row(5, { previews: { 'preview-lq-mp3': 'https://cdn.freesound.org.evil.test/previews/1/5_9-lq.mp3' } }),
    row(6, { previews: { 'preview-lq-mp3': 'https://cdn.freesound.org/previews/1/999_9-lq.mp3' } }),
    row(7, { url: 'https://freesound.org/people/recorder/sounds/999/' }), row(8, { channels: 8 }),
    row(9, { samplerate: 192000 }), row(10, { filesize: null }), row(11, { geotag: '91 -74' }),
    row(12, { previews: { 'preview-lq-mp3': 'https://user:secret@cdn.freesound.org/previews/1/12_9-lq.mp3' } }),
  ]));
  const result = await discoverRecordings(place, { token, fetch: fetcher });
  assert.equal(result.status, 'empty');
});

await test('returned metadata is plain bounded text, without credential/provider errors', async () => {
  const { fetcher } = mock(() => metadata([row(1, {
    name: '&lt;b&gt;Street traffic&lt;/b&gt;', username: '<b>Recorder</b>',
    description: `<script>alert('untrusted')</script><p>Street traffic &amp; trams. ${'a'.repeat(900)}</p>`,
  })]));
  const result = await discoverRecordings(place, { token, fetch: fetcher });
  assert.equal(result.recordings[0].name, 'Street traffic');
  assert.equal(result.recordings[0].author, 'Recorder');
  assert.equal(result.recordings[0].description.length, 600);
  assert.equal(result.recordings[0].description.includes('<'), false);
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(JSON.stringify(result).includes('untrusted'), false);
});

await test('concurrent requests deduplicate and cached objects cannot be mutated by callers', async () => {
  const { fetcher, calls } = mock(() => metadata([row(1), row(2), row(3), row(4)]));
  const [first, second] = await Promise.all([discoverRecordings(place, { token, fetch: fetcher }), discoverRecordings(place, { token, fetch: fetcher })]);
  assert.equal(calls.length, 1);
  first.recordings[0].name = 'mutated';
  assert.notEqual(second.recordings[0].name, 'mutated');
  const third = await discoverRecordings(place, { token, fetch: fetcher });
  assert.notEqual(third.recordings[0].name, 'mutated');
  assert.equal(calls.length, 1);
  await discoverRecordings(place, { token: 'different-token', fetch: fetcher });
  assert.equal(calls.length, 2);
});

await test('timeout is unavailable, aborts request, does not retry another region, and is retryable', async () => {
  const originalTimeout = globalThis.setTimeout;
  let fail = true;
  let aborted = false;
  const { fetcher, calls } = mock((_url, init) => fail ? new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error(`timeout with ${token}`)); }, { once: true });
  }) : metadata([row(1), row(2), row(3), row(4)]));
  globalThis.setTimeout = ((fn: (...args: unknown[]) => void, delay?: number) => originalTimeout(fn, delay === 6000 ? 1 : delay)) as typeof setTimeout;
  try {
    const result = await discoverRecordings(place, { token, fetch: fetcher });
    assert.equal(result.status, 'unavailable');
    assert.equal(aborted, true);
    assert.equal(calls.length, 1);
    assert.equal(JSON.stringify(result).includes(token), false);
    fail = false;
    assert.equal((await discoverRecordings(place, { token, fetch: fetcher })).status, 'ready');
    assert.equal(calls.length, 2);
  } finally { globalThis.setTimeout = originalTimeout; }
});

await test('one cancelled subscriber does not cancel a shared lookup for another', async () => {
  let release!: () => void;
  let upstreamAborted = false;
  const { fetcher, calls } = mock((_url, init) => new Promise((resolve) => {
    release = () => resolve(metadata([row(1), row(2), row(3), row(4)]));
    init?.signal?.addEventListener('abort', () => { upstreamAborted = true; });
  }));
  const controller = new AbortController();
  const first = discoverRecordings(place, { token, fetch: fetcher, signal: controller.signal });
  const second = discoverRecordings(place, { token, fetch: fetcher });
  controller.abort();
  assert.equal((await first).status, 'unavailable');
  assert.equal(upstreamAborted, false);
  release();
  assert.equal((await second).status, 'ready');
  assert.equal(calls.length, 1);
});

await test('invalid coordinates and already-aborted requests never contact provider', async () => {
  const { fetcher, calls } = mock(() => { throw new Error('must not fetch'); });
  assert.equal((await discoverRecordings({ ...place, lat: NaN }, { token, fetch: fetcher })).status, 'unavailable');
  const controller = new AbortController(); controller.abort();
  assert.equal((await discoverRecordings(place, { token, fetch: fetcher, signal: controller.signal })).status, 'unavailable');
  assert.equal(calls.length, 0);
});

await test('oversized and malformed provider metadata become unavailable', async () => {
  for (const body of ['not json', JSON.stringify({ results: [], padding: 'a'.repeat(513 * 1024) })]) {
    const { fetcher } = mock(() => new Response(body));
    assert.equal((await discoverRecordings(place, { token, fetch: fetcher })).status, 'unavailable');
  }
});

await test('ready cache expires after ten minutes', async () => {
  const { fetcher, calls } = mock(() => metadata([row(1), row(2), row(3), row(4)]));
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    await discoverRecordings(place, { token, fetch: fetcher });
    now += 601_000;
    await discoverRecordings(place, { token, fetch: fetcher });
    assert.equal(calls.length, 2);
  } finally { Date.now = originalNow; }
});

await test('cache retains at most 128 lookup entries', async () => {
  const { fetcher, calls } = mock(() => metadata([row(1), row(2), row(3), row(4)]));
  for (let index = 0; index < 129; index += 1) {
    await discoverRecordings({ ...place, lat: place.lat + index * 0.00001 }, { token, fetch: fetcher });
  }
  assert.equal(calls.length, 129);
  await discoverRecordings(place, { token, fetch: fetcher });
  assert.equal(calls.length, 130);
});

await test('at most sixteen distinct lookups are in flight', async () => {
  const releases: Array<() => void> = [];
  const { fetcher, calls } = mock(() => new Promise((resolve) => releases.push(() => resolve(metadata([row(1), row(2), row(3), row(4)])))));
  const work = Array.from({ length: 16 }, (_, index) => discoverRecordings({ ...place, lat: place.lat + index * 0.00001 }, { token, fetch: fetcher }));
  const excess = await discoverRecordings({ ...place, lat: place.lat + 0.0002 }, { token, fetch: fetcher });
  assert.equal(excess.status, 'unavailable');
  assert.equal(calls.length, 16);
  releases.forEach((release) => release());
  assert.equal((await Promise.all(work)).every((value) => value.status === 'ready'), true);
});

console.log(`${passed} recording discovery checks passed.`);
