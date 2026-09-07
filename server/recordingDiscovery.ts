import { createHash } from 'node:crypto';

export type RecordingDiscoveryInput = {
  name: string;
  lat: number;
  lng: number;
  countryCode?: string;
  habitat?: string;
};
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
export type RecordingDiscoveryResult = {
  status: 'ready' | 'unconfigured' | 'unavailable' | 'empty';
  recordings: DiscoveredRecording[];
  message: string;
};
export type RecordingDiscoveryOptions = {
  token?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
};

// API/search and geographic filter syntax verified against the official docs:
// https://freesound.org/docs/api/resources_apiv2.html
// https://freesound.org/docs/api/authentication.html
const RADII_KM = [5, 20] as const;
const MAX_RECORDINGS = 4;
const REQUEST_TIMEOUT_MS = 6_000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_ORIGINAL_BYTES = 32 * 1024 * 1024;
const CACHE_LIMIT = 128;
const INFLIGHT_LIMIT = 16;
const READY_TTL_MS = 10 * 60 * 1000;
const EMPTY_TTL_MS = 60 * 1000;
const FIELDS = 'id,url,name,tags,description,username,license,geotag,duration,filesize,channels,samplerate,is_remix,previews';

type CacheEntry = { expires: number; value: RecordingDiscoveryResult };
type Pending = { controller: AbortController; users: number; promise: Promise<RecordingDiscoveryResult> };
type Store = { cache: Map<string, CacheEntry>; pending: Map<string, Pending> };
// Injected transports get separate caches, keeping tests and alternate server
// transports isolated. Neither credentials nor provider errors reach responses.
const stores = new WeakMap<typeof fetch, Store>();

function result(status: RecordingDiscoveryResult['status'], message: string): RecordingDiscoveryResult {
  return { status, message, recordings: [] };
}
const unavailable = () => result('unavailable', 'Recording discovery is temporarily unavailable.');

function plain(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  let text = value.slice(0, 20_000);
  for (let pass = 0; pass < 2; pass += 1) {
    text = text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
      const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
      if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
      const point = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    });
  }
  return text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function habitatTerms(input: RecordingDiscoveryInput): string[] {
  const context = `${plain(input.habitat, 80)} ${plain(input.name, 160)}`.toLowerCase();
  if (/subway|metro|railway|train station/.test(context)) return ['subway', 'metro', 'train', 'railway', 'station'];
  if (/wetland|marsh|swamp|pond/.test(context)) return ['wetland', 'marsh', 'swamp', 'pond', 'reeds'];
  if (/coast|beach|ocean|seaside|shore/.test(context)) return ['coastal', 'coast', 'beach', 'ocean', 'sea', 'surf', 'waves', 'shore', 'harbour', 'harbor'];
  if (/forest|woodland|rainforest/.test(context)) return ['forest', 'woodland', 'woods', 'trees', 'rainforest'];
  if (/river|stream|waterfall/.test(context)) return ['river', 'stream', 'creek', 'waterfall'];
  if (/mountain|alpine/.test(context)) return ['mountain', 'alpine', 'ridge', 'valley'];
  if (/desert|dune/.test(context)) return ['desert', 'dunes'];
  if (/rural|farm|grassland|meadow/.test(context)) return ['countryside', 'rural', 'meadow', 'grassland', 'farmland'];
  if (/urban|city|town|built/.test(context)) return ['traffic', 'street', 'city', 'urban', 'tram', 'subway', 'metro', 'train', 'bus', 'motorcycle', 'moped', 'scooter'];
  return ['ambience', 'ambient', 'field-recording', 'outdoor', 'soundscape', 'nature', 'environment'];
}

function allowedLicense(value: unknown): string | null {
  if (value === 'Creative Commons 0' || value === 'CC0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (value === 'Attribution' || value === 'CC BY') return 'CC BY'; // The API label does not specify a version.
  if (typeof value !== 'string') return null;
  try {
    const link = new URL(value);
    if (!['http:', 'https:'].includes(link.protocol) || !['creativecommons.org', 'www.creativecommons.org'].includes(link.hostname) || link.port || link.username || link.password || link.search || link.hash) return null;
    if (!/^\/publicdomain\/zero\/1\.0\/?$/.test(link.pathname) && !/^\/licenses\/by\/(1\.0|2\.0|2\.5|3\.0|4\.0)\/?$/.test(link.pathname)) return null;
    return `https://creativecommons.org${link.pathname.replace(/\/?$/, '/')}`;
  } catch { return null; }
}

function checkedUrl(value: unknown, host: string, path: RegExp): string | null {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try {
    const link = new URL(value);
    if (link.protocol !== 'https:' || link.hostname !== host || link.port || link.username || link.password || link.search || link.hash || !path.test(link.pathname)) return null;
    return link.href;
  } catch { return null; }
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
function validPoint(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180;
}

const EXCLUDED = /\b(music|musical|musician|piano|guitar|drums?|drumming|melody|melodic|synth(?:etic|esizer|esized|esised)?|synthesis|speech|speaking|spoken|talking|conversation|narration|dialogue|vocals?|voices?|foley|artificial|simulated|generated|sound-design|sound design|remix|beatbox|electronica|techno)\b/i;

function parseRecording(raw: unknown, input: RecordingDiscoveryInput, radius: number, terms: string[]): DiscoveredRecording | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(item.id) || Number(item.id) <= 0 || item.is_remix === true) return null;
  const id = String(item.id);
  const license = allowedLicense(item.license);
  if (!license || typeof item.geotag !== 'string') return null;
  const coordinates = item.geotag.trim().split(/\s+/).map(Number);
  if (coordinates.length !== 2 || !validPoint(coordinates[0], coordinates[1])) return null;
  const [lat, lng] = coordinates;
  if (distanceKm(input, { lat, lng }) > radius) return null;
  if (typeof item.duration !== 'number' || !Number.isFinite(item.duration) || item.duration < 3 || item.duration > 90) return null;
  if (typeof item.filesize !== 'number' || !Number.isSafeInteger(item.filesize) || item.filesize <= 0 || item.filesize > MAX_ORIGINAL_BYTES) return null;
  if (typeof item.channels !== 'number' || ![1, 2].includes(item.channels) || typeof item.samplerate !== 'number' || !Number.isFinite(item.samplerate) || item.samplerate < 8000 || item.samplerate > 96000) return null;
  if (typeof item.description !== 'string' || item.description.length > 20_000 || typeof item.name !== 'string' || item.name.length > 1000) return null;
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 80).map((tag) => plain(tag, 100)).join(' ') : '';
  const metadata = `${plain(item.name, 1000)} ${plain(item.description, 20_000)} ${tags}`.toLowerCase();
  const unqualifiedSinging = /\b(song|singing|singer)\b/.test(metadata) && !/\b(bird|birds|birdsong|insect|insects|cricket|crickets)\b/.test(metadata);
  if (EXCLUDED.test(metadata) || unqualifiedSinging || !terms.some((term) => new RegExp(`\\b${term.replace('-', '[- ]')}\\b`, 'i').test(metadata))) return null;
  const sourceUrl = checkedUrl(item.url, 'freesound.org', new RegExp(`^/people/[^/]+/sounds/${id}/?$`));
  const previews = item.previews && typeof item.previews === 'object' ? item.previews as Record<string, unknown> : {};
  const previewPath = new RegExp(`^/previews/\\d+/${id}_\\d+-lq\\.(mp3|ogg)$`);
  const src = checkedUrl(previews['preview-lq-mp3'], 'cdn.freesound.org', previewPath) ?? checkedUrl(previews['preview-lq-ogg'], 'cdn.freesound.org', previewPath);
  const name = plain(item.name, 120);
  const author = plain(item.username, 100);
  if (!sourceUrl || !src || !name || !author) return null;
  return { id: `freesound-${id}`, name, src, sourceUrl, author, license, lat, lng, duration: item.duration, description: plain(item.description, 600) };
}

async function boundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES || !response.body) throw new Error('Invalid metadata response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('Metadata response too large');
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const body = Buffer.concat(chunks, bytes).toString('utf8');
  return JSON.parse(body);
}

async function queryTier(input: RecordingDiscoveryInput, terms: string[], radius: number, token: string, transport: typeof fetch, parent: AbortSignal): Promise<unknown[]> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  try {
    if (parent.aborted) throw new Error('Cancelled');
    const url = new URL('https://freesound.org/apiv2/search/');
    const alternatives = terms.map((term) => `"${term}"`).join(' OR ');
    url.searchParams.set('query', '');
    url.searchParams.set('filter', `{!geofilt sfield=geotag pt=${input.lat},${input.lng} d=${radius}} duration:[3 TO 90] filesize:[1 TO ${MAX_ORIGINAL_BYTES}] license:("Creative Commons 0" OR "Attribution") (tag:(${alternatives}) OR name:(${alternatives}) OR description:(${alternatives}))`);
    url.searchParams.set('fields', FIELDS);
    url.searchParams.set('page_size', '40');
    url.searchParams.set('group_by_pack', '1');
    const response = await transport(url, { headers: { Authorization: `Token ${token}`, Accept: 'application/json' }, signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error('Provider unavailable');
    const data = await boundedJson(response);
    if (!data || typeof data !== 'object' || !Array.isArray((data as { results?: unknown }).results)) throw new Error('Invalid metadata');
    return (data as { results: unknown[] }).results.slice(0, 40);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', abort);
  }
}

async function retrieve(input: RecordingDiscoveryInput, terms: string[], token: string, transport: typeof fetch, signal: AbortSignal): Promise<RecordingDiscoveryResult> {
  const recordings = new Map<string, DiscoveredRecording>();
  const urls = new Set<string>();
  let radiusUsed: number = RADII_KM[0];
  let failed = false;
  for (const radius of RADII_KM) {
    radiusUsed = radius;
    try {
      const rows = await queryTier(input, terms, radius, token, transport, signal);
      for (const row of rows) {
        const recording = parseRecording(row, input, radius, terms);
        if (!recording || recordings.has(recording.id) || urls.has(recording.src)) continue;
        recordings.set(recording.id, recording);
        urls.add(recording.src);
      }
    } catch {
      failed = true;
      break;
    }
    if (recordings.size >= MAX_RECORDINGS || signal.aborted) break;
  }
  if (signal.aborted) return unavailable();
  const selected = [...recordings.values()].sort((a, b) => distanceKm(input, a) - distanceKm(input, b) || a.id.localeCompare(b.id)).slice(0, MAX_RECORDINGS);
  if (selected.length) return { status: 'ready', recordings: selected, message: `Found ${selected.length} geotagged recording${selected.length === 1 ? '' : 's'} within ${radiusUsed} km. Locations and descriptions are supplied by uploaders.` };
  return failed ? unavailable() : result('empty', 'No suitable geotagged recordings were found within 20 km.');
}

/** Server-only: never pass the API token through client props or query strings. */
export async function discoverRecordings(input: RecordingDiscoveryInput, options: RecordingDiscoveryOptions = {}): Promise<RecordingDiscoveryResult> {
  const token = options.token?.trim();
  if (!token) return result('unconfigured', 'Recording discovery is not configured on this server.');
  if (token.length > 512 || /\s/.test(token)) return unavailable();
  if (!input || !validPoint(input.lat, input.lng) || !plain(input.name, 160)) return result('unavailable', 'A valid place and coordinates are required.');
  if (options.signal?.aborted) return unavailable();
  const transport = options.fetch ?? fetch;
  let store = stores.get(transport);
  if (!store) { store = { cache: new Map(), pending: new Map() }; stores.set(transport, store); }
  const terms = habitatTerms(input);
  const credentialId = createHash('sha256').update(token).digest('hex');
  const key = JSON.stringify([credentialId, input.lat, input.lng, terms, plain(input.countryCode, 2).toLowerCase()]);
  const cached = store.cache.get(key);
  if (cached && cached.expires > Date.now()) {
    store.cache.delete(key); store.cache.set(key, cached);
    return structuredClone(cached.value);
  }
  store.cache.delete(key);
  let pending = store.pending.get(key);
  if (pending?.controller.signal.aborted) { store.pending.delete(key); pending = undefined; }
  if (!pending) {
    if (store.pending.size >= INFLIGHT_LIMIT) return unavailable();
    const controller = new AbortController();
    const entry: Pending = { controller, users: 0, promise: Promise.resolve(unavailable()) };
    const currentStore = store;
    entry.promise = retrieve(input, terms, token, transport, controller.signal).then((value) => {
      if (!controller.signal.aborted && (value.status === 'ready' || value.status === 'empty')) {
        while (currentStore.cache.size >= CACHE_LIMIT) currentStore.cache.delete(currentStore.cache.keys().next().value!);
        currentStore.cache.set(key, { expires: Date.now() + (value.status === 'ready' ? READY_TTL_MS : EMPTY_TTL_MS), value });
      }
      return value;
    }).finally(() => { if (currentStore.pending.get(key) === entry) currentStore.pending.delete(key); });
    store.pending.set(key, entry);
    pending = entry;
  }
  const shared = pending;
  shared.users += 1;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: RecordingDiscoveryResult) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', cancelled);
      shared.users -= 1;
      if (shared.users === 0 && store.pending.get(key) === shared) shared.controller.abort();
      resolve(structuredClone(value));
    };
    const cancelled = () => finish(unavailable());
    options.signal?.addEventListener('abort', cancelled, { once: true });
    if (options.signal?.aborted) cancelled();
    else void shared.promise.then(finish, () => finish(unavailable()));
  });
}
