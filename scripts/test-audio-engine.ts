/** Deterministic engine lifecycle/load tests; no browser, network or audio device. */
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine.ts';
import type { SoundDef } from '../src/data/types.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

type BufferStub = { length: number; numberOfChannels: number; duration: number; src: string };
const buffer = (src: string, bytes = 1024): BufferStub => ({
  src, length: bytes / 4, numberOfChannels: 1, duration: 10,
});
const url = (id: string) => `https://audio.example.test/${id}.ogg`;
const sound = (id: string): SoundDef => ({ id, name: id, category: 'ambient', src: url(id), loop: true });
const position = { x: 0, y: 0 };
const realSetTimeout = globalThis.setTimeout;
const tick = () => new Promise<void>((resolve) => realSetTimeout(resolve, 0));

class Param {
  value = 0;
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  setTargetAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {}
}
class NodeStub {
  disconnected = false;
  connect() {}
  disconnect() { this.disconnected = true; }
}
class GainStub extends NodeStub { gain = new Param(); }
class PannerStub extends NodeStub { positionX = new Param(); positionZ = new Param(); }
class SourceStub extends NodeStub {
  buffer: BufferStub | null = null;
  loop = false;
  detune = new Param();
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  start() { this.started = true; }
  stop() { this.stopped = true; this.onended?.(); }
}

let context: ContextStub;
function captureContext(created: ContextStub) { context = created; }
let initialState = 'running';
let resume = async () => {};
let decode = async (src: string) => buffer(src);
class ContextStub {
  state = initialState;
  currentTime = 1;
  destination = new NodeStub();
  gains: GainStub[] = [];
  panners: PannerStub[] = [];
  sources: SourceStub[] = [];
  constructor() { captureContext(this); }
  async resume() { await resume(); this.state = 'running'; }
  createGain() { const node = new GainStub(); this.gains.push(node); return node; }
  createPanner() { const node = new PannerStub(); this.panners.push(node); return node; }
  createBufferSource() { const node = new SourceStub(); this.sources.push(node); return node; }
  decodeAudioData(data: ArrayBuffer) { return decode(new TextDecoder().decode(data)); }
}

let fetchCounts = new Map<string, number>();
let fetchImpl: (src: string, init?: RequestInit) => Promise<Response>;
const response = (src: string) => Promise.resolve(new Response(src, { status: 200 }));
const originals = new Map(['AudioContext', 'window', 'fetch', 'setTimeout'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: ContextStub });
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  setTimeout: (fn: () => void) => realSetTimeout(fn, 0),
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
} });
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const src = String(input);
  fetchCounts.set(src, (fetchCounts.get(src) ?? 0) + 1);
  return fetchImpl(src, init);
}) as typeof fetch;

let passed = 0;
async function test(name: string, run: () => Promise<void>) {
  initialState = 'running';
  resume = async () => {};
  decode = async (src) => buffer(src);
  fetchCounts = new Map();
  fetchImpl = (src) => response(src);
  await run();
  passed += 1;
  console.log(`✓ ${name}`);
}

try {
  await test('preloading decodes while suspended without waiting for an audio gesture', async () => {
    initialState = 'suspended';
    let resumeCalls = 0;
    resume = async () => { resumeCalls += 1; };
    const engine = new AudioEngine();
    await engine.preloadVariants([url('before-gesture')]);
    assert.equal(fetchCounts.get(url('before-gesture')), 1);
    assert.equal(context.state, 'suspended');
    assert.equal(resumeCalls, 0);
    assert.equal(engine.isPlaying, false);
  });

  await test('one four-slot budget covers concurrent preloads, sources and decode', async () => {
    const engine = new AudioEngine();
    const releases: Array<() => void> = [];
    let active = 0;
    let peak = 0;
    fetchImpl = (src) => { active += 1; peak = Math.max(peak, active); return response(src); };
    decode = (src) => new Promise((resolve) => releases.push(() => { active -= 1; resolve(buffer(src)); }));
    const preloads = engine.preloadVariants(['a', 'b', 'c', 'd', 'e', 'f'].map(url));
    const add = engine.addSource('layer', sound('g'), position, 1, { sustained: true, secondarySrc: url('h') });
    await tick();
    assert.equal(fetchCounts.size, 4);
    assert.equal(releases.length, 4);
    releases.shift()!();
    await tick();
    assert.equal(fetchCounts.size, 5);
    while (releases.length) {
      releases.splice(0).forEach((release) => release());
      await tick();
    }
    await Promise.all([preloads, add]);
    assert.equal(fetchCounts.size, 8);
    assert.equal(peak, 4);
    assert.equal(active, 0);
    assert.equal(engine.hasSource('layer'), true);
    engine.clear();
  });

  await test('preload, spatial add and UI loop share one in-flight decode', async () => {
    const engine = new AudioEngine();
    const pending = deferred<BufferStub>();
    let decodes = 0;
    decode = () => { decodes += 1; return pending.promise; };
    const tasks = [engine.preloadVariants([url('same'), url('same')]), engine.addSource('same', sound('same'), position), engine.playLoop('browse', url('same'))];
    await tick();
    assert.equal(fetchCounts.get(url('same')), 1);
    assert.equal(decodes, 1);
    pending.resolve(buffer(url('same')));
    await Promise.all(tasks);
    await engine.preloadVariants([url('same')]);
    assert.equal(fetchCounts.get(url('same')), 1);
    engine.stopLoop('browse');
    engine.clear();
  });

  await test('network and decode failures can retry without connected source leaks', async () => {
    const engine = new AudioEngine();
    fetchImpl = async () => new Response('', { status: 503 });
    await assert.rejects(engine.addSource('broken', sound('broken'), position), /503/);
    assert.equal(context.gains.length, 2); // Master + scene only.
    assert.equal(context.panners.length, 0);
    fetchImpl = (src) => response(src);
    decode = async () => { throw new Error('invalid audio'); };
    await assert.rejects(engine.addSource('broken', sound('broken'), position), /invalid audio/);
    assert.equal(context.panners.length, 0);
    decode = async (src) => buffer(src);
    await engine.addSource('broken', sound('broken'), position);
    assert.equal(fetchCounts.get(url('broken')), 3);
    assert.equal(engine.hasSource('broken'), true);
    engine.clear();
  });

  await test('request timeout aborts body loading, releases the slot and permits retry', async () => {
    const engine = new AudioEngine();
    let aborted = false;
    globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number) => realSetTimeout(callback, delay === 15_000 ? 1 : delay)) as typeof setTimeout;
    fetchImpl = async (_src, init) => ({
      ok: true,
      arrayBuffer: () => new Promise<ArrayBuffer>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
      }),
    }) as Response;
    try {
      await assert.rejects(engine.preloadVariants([url('slow')]), /Timed out/);
      assert.equal(aborted, true);
      fetchImpl = (src) => response(src);
      await engine.preloadVariants([url('slow')]);
      assert.equal(fetchCounts.get(url('slow')), 2);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
  });

  await test('64MiB cache evicts least-recently-used buffers while active sources retain theirs', async () => {
    const engine = new AudioEngine();
    decode = async (src) => buffer(src, 24 * 1024 * 1024);
    await engine.addSource('active-a', sound('a'), position);
    await engine.preloadVariants([url('b')]);
    await engine.preloadVariants([url('a')]); // Touch a; b is now oldest.
    await engine.preloadVariants([url('c')]); // Evict b, keep a + c.
    await engine.preloadVariants([url('a')]);
    assert.equal(fetchCounts.get(url('a')), 1);
    await engine.preloadVariants([url('b')]);
    assert.equal(fetchCounts.get(url('b')), 2);
    await engine.preloadVariants([url('d')]); // a is no longer cached.
    await engine.play();
    assert.equal(context.sources[0].buffer?.src, url('a'));
    assert.equal(context.sources[0].started, true);
    assert.equal(fetchCounts.get(url('a')), 1);
    await engine.preloadVariants([url('a')]);
    assert.equal(fetchCounts.get(url('a')), 2);
    engine.clear();
  });

  await test('an oversized decoded buffer plays but is not retained in the reuse cache', async () => {
    const engine = new AudioEngine();
    decode = async (src) => buffer(src, 65 * 1024 * 1024);
    await engine.addSource('large', sound('large'), position);
    await engine.preloadVariants([url('large')]);
    assert.equal(fetchCounts.get(url('large')), 2);
    await engine.play();
    assert.equal(context.sources[0].started, true);
    engine.clear();
  });

  for (const action of ['remove', 'clear', 'transition'] as const) {
    await test(`${action} prevents a pending scene source from appearing late`, async () => {
      const engine = new AudioEngine();
      await engine.play();
      const pending = deferred<BufferStub>();
      decode = () => pending.promise;
      const add = engine.addSource('pending', sound('pending'), position);
      await tick();
      if (action === 'remove') engine.removeSource('pending');
      else if (action === 'clear') engine.clear();
      else engine.beginSoundscapeTransition();
      pending.resolve(buffer(url('pending')));
      await add;
      assert.deepEqual(engine.getSourceIds(), []);
      assert.equal(context.sources.length, 0);
    });
  }

  await test('newest add for an instance wins even if an older download finishes last', async () => {
    const engine = new AudioEngine();
    await engine.play();
    const old = deferred<BufferStub>();
    decode = (src) => src === url('old') ? old.promise : Promise.resolve(buffer(src));
    const first = engine.addSource('preview', sound('old'), position);
    await tick();
    await engine.addSource('preview', sound('new'), position);
    old.resolve(buffer(url('old')));
    await first;
    assert.equal(context.sources.length, 1);
    assert.equal(context.sources[0].buffer?.src, url('new'));
    assert.equal(context.sources[0].stopped, false);
    engine.clear();
  });

  await test('stopLoop cancels an in-flight load and newer loops win out-of-order loads', async () => {
    const engine = new AudioEngine();
    const old = deferred<BufferStub>();
    decode = (src) => src === url('old-loop') ? old.promise : Promise.resolve(buffer(src));
    const first = engine.playLoop('browse', url('old-loop'));
    await tick();
    engine.stopLoop('browse');
    await engine.playLoop('browse', url('new-loop'));
    old.resolve(buffer(url('old-loop')));
    await first;
    assert.equal(context.sources.length, 1);
    assert.equal(context.sources[0].buffer?.src, url('new-loop'));
    engine.stopLoop('browse');
  });

  await test('pause and stopLoop during unlock cannot start audio later', async () => {
    initialState = 'suspended';
    const resumed = deferred<void>();
    resume = () => resumed.promise;
    const engine = new AudioEngine();
    const play = engine.play();
    const loop = engine.playLoop('browse', url('unused'));
    engine.pause();
    engine.stopLoop('browse');
    resumed.resolve();
    await Promise.all([play, loop]);
    assert.equal(engine.isPlaying, false);
    assert.equal(context.sources.length, 0);
    assert.equal(fetchCounts.size, 0);
  });

  console.log(`${passed} audio engine checks passed.`);
} finally {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
