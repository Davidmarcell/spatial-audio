import type { SoundDef, SpatialPoint } from '../data/types';
import { publicUrl } from '../utils/publicUrl';
import { gainFromDistance, toPannerPosition } from './spatialMath';

/** One budget shared by preloads, spatial sources and UI audio. */
const LOAD_CONCURRENCY = 4;
const DECODED_CACHE_BYTES = 64 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Per-playback recipe resolved by the soundscape selection layer. Lets the
 * engine play a location-seeded variant (and an optional second variant for
 * crossfade) instead of one fixed file, with subtle micro-variation so a
 * reused layer never sounds identical twice.
 */
export type PlaybackRecipe = {
  /** Concrete variant file; falls back to the SoundDef `src` when omitted. */
  src?: string;
  /** Second sustained variant for dual-layer crossfade. */
  secondarySrc?: string;
  sustained?: boolean;
  /** Pitch offset in cents applied to the primary layer. */
  detuneCents?: number;
  /** Fraction (0..1) of the buffer skipped before the loop begins. */
  loopOffset?: number;
};

type Layer = {
  src: string;
  buffer: AudioBuffer;
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  detuneCents: number;
  loopOffset: number;
  /** Base mix level within the source group (1 for solo, ~0.5 for crossfade). */
  baseLevel: number;
};

type SourceNode = {
  soundId: string;
  loop: boolean;
  layers: Layer[];
  gain: GainNode;
  panner: PannerNode;
  userVolume: number;
  lastDistance: number;
  crossfade: boolean;
  crossfadeTimer: number | null;
  crossfadeIndex: number;
};

/** Soft swell as a scene starts, so nothing snaps on at full level. */
const SCENE_FADE_IN_S = 0.3;

const CROSSFADE_MIN_S = 28;
const CROSSFADE_MAX_S = 48;
/** Fraction of each crossfade cycle spent ramping between layers. */
const CROSSFADE_RAMP_FRACTION = 0.55;
/** Seconds trimmed from the buffer tail so Web Audio loop wraps cleanly. */
const LOOP_END_SAFETY_S = 0.02;

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  /** Sub-bus carrying only the spatial scene (see `ensureGraph`). */
  private sceneGain: GainNode | null = null;
  // Headroom ceiling: the gain applied when master volume is at 100%.
  private readonly baseMasterLevel = 0.9;
  // User-controlled master volume (0–1). Ducking multiplies on top of this.
  private masterVolume = 1;
  private duckingGain = 1;
  private bufferCache = new Map<string, AudioBuffer>();
  private bufferCacheBytes = 0;
  private inflight = new Map<string, Promise<AudioBuffer>>();
  private loadingCount = 0;
  private loadQueue: Array<() => void> = [];
  private sources = new Map<string, SourceNode>();
  private sourceRequests = new Map<string, symbol>();
  private loopRequests = new Map<string, symbol>();
  private playing = false;
  private transportEpoch = 0;
  // Monotonic load-session token. Bumped whenever a new soundscape supersedes
  // the current one, so any async buffer load (fetch/decode) still in flight
  // for the old scene can detect it lost the race and refuse to start playing.
  private loadEpoch = 0;

  get isPlaying() {
    return this.playing;
  }

  get isUnlocked() {
    return this.context?.state === 'running';
  }

  hasSource(instanceId: string): boolean {
    return this.sources.has(instanceId);
  }

  getSourceIds(): string[] {
    return [...this.sources.keys()];
  }

  /** Create the AudioContext graph if needed (may stay suspended until a gesture). */
  private ensureGraph(): void {
    if (this.context) return;
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.effectiveMasterGain();
    this.masterGain.connect(this.context.destination);
    // Scene bus: every spatial layer runs through this, UI one-shots do not.
    // It exists so the whole soundscape can be faded as one thing on play
    // without ducking the transition whoosh that plays over the top of it.
    this.sceneGain = this.context.createGain();
    this.sceneGain.gain.value = 1;
    this.sceneGain.connect(this.masterGain);
  }

  async unlock(): Promise<void> {
    this.ensureGraph();
    if (this.context!.state === 'suspended') {
      await this.context!.resume();
    }
  }

  /** Preload only the given variant files (lazy: a scene's chosen clips). */
  async preloadVariants(srcs: Iterable<string>): Promise<void> {
    // Decode works while suspended. A resume() promise may wait for a gesture,
    // so preloading must not await it or attempt to change playback state.
    this.ensureGraph();
    const unique = [...new Set([...srcs].filter(Boolean))];
    await Promise.all(unique.map((src) => this.loadBuffer(src)));
  }

  /**
   * Play a non-spatial one-shot (UI transitions). Routes Source → Gain → master
   * and bypasses PannerNode so the clip stays centered.
   */
  async playOneShot(src: string, options?: { volume?: number }): Promise<void> {
    await this.unlock();
    const ctx = this.context!;
    const master = this.masterGain;
    if (!master) return;

    const buffer = await this.loadBuffer(src);
    if (!this.context || !this.masterGain) return;

    const volume = Math.max(0, Math.min(1, options?.volume ?? 0.6));
    const gain = ctx.createGain();
    gain.gain.value = volume;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.connect(gain);
    gain.connect(master);
    source.onended = () => {
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
      try {
        gain.disconnect();
      } catch {
        // Already disconnected.
      }
    };
    source.start(0);
  }

  /** Non-spatial looping UI beds (e.g. quiet globe browse ambience). */
  private uiLoops = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

  async playLoop(
    id: string,
    src: string,
    options?: { volume?: number; fadeInSeconds?: number },
  ): Promise<void> {
    // Invalidate before the first await: closing the globe during unlock or
    // fetch must prevent its ambience from starting after the globe is gone.
    this.stopLoop(id);
    const request = Symbol(id);
    this.loopRequests.set(id, request);
    try {
      await this.unlock();
      if (this.loopRequests.get(id) !== request) return;
      const ctx = this.context!;
      const master = this.masterGain;
      if (!master) return;

      const buffer = await this.loadBuffer(src);
      if (!this.context || !this.masterGain || this.loopRequests.get(id) !== request) return;

      const volume = Math.max(0, Math.min(1, options?.volume ?? 0.2));
      const fadeIn = Math.max(0, options?.fadeInSeconds ?? 0.8);
      const gain = ctx.createGain();
      gain.gain.value = 0;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(master);
      source.start(0);
      if (fadeIn > 0) {
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeIn);
      } else {
        gain.gain.value = volume;
      }
      this.uiLoops.set(id, { source, gain });
    } finally {
      if (this.loopRequests.get(id) === request) this.loopRequests.delete(id);
    }
  }

  stopLoop(id: string, fadeOutSeconds = 0.45): void {
    this.loopRequests.delete(id);
    const entry = this.uiLoops.get(id);
    if (!entry || !this.context) return;
    this.uiLoops.delete(id);
    const { source, gain } = entry;
    const ctx = this.context;
    const fade = Math.max(0.05, fadeOutSeconds);
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    } catch {
      // Ignore scheduling races on teardown.
    }
    window.setTimeout(() => {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
      try {
        gain.disconnect();
      } catch {
        // Already disconnected.
      }
    }, fade * 1000 + 30);
  }

  async preloadSounds(sounds: SoundDef[]): Promise<void> {
    await this.preloadVariants(sounds.map((sound) => sound.src));
  }

  private async loadBuffer(src: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(src);
    if (cached) {
      this.bufferCache.delete(src);
      this.bufferCache.set(src, cached);
      return cached;
    }

    const pending = this.inflight.get(src);
    if (pending) return pending;

    const promise = this.withLoadSlot(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let arrayBuffer: ArrayBuffer;
      try {
        const response = await fetch(publicUrl(src), { signal: controller.signal });
        if (!response.ok) throw new Error(`Failed to load audio (${response.status}): ${src}`);
        arrayBuffer = await response.arrayBuffer();
      } catch (error) {
        if (controller.signal.aborted) throw new Error(`Timed out loading audio: ${src}`, { cause: error });
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      // Web Audio decoding cannot be aborted. Hold the shared slot until it
      // completes, and let callers reject stale playback with their epoch/token.
      const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
      this.cacheBuffer(src, audioBuffer);
      return audioBuffer;
    });

    this.inflight.set(src, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(src);
    }
  }

  private async withLoadSlot<T>(task: () => Promise<T>): Promise<T> {
    if (this.loadingCount >= LOAD_CONCURRENCY) {
      await new Promise<void>((resolve) => this.loadQueue.push(resolve));
    } else {
      this.loadingCount += 1;
    }
    try {
      return await task();
    } finally {
      const next = this.loadQueue.shift();
      if (next) next(); // Transfer this slot directly to the next queued load.
      else this.loadingCount -= 1;
    }
  }

  private cacheBuffer(src: string, buffer: AudioBuffer): void {
    const bytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    // Active layers keep their own AudioBuffer references; eviction affects
    // reuse only, so an oversized clip can still play without filling the cache.
    if (bytes > DECODED_CACHE_BYTES) return;
    while (this.bufferCacheBytes + bytes > DECODED_CACHE_BYTES) {
      const oldest = this.bufferCache.entries().next().value;
      if (!oldest) break;
      this.bufferCache.delete(oldest[0]);
      this.bufferCacheBytes -= oldest[1].length * oldest[1].numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    }
    this.bufferCache.set(src, buffer);
    this.bufferCacheBytes += bytes;
  }

  /**
   * Deterministically tear down the current soundscape before a new one loads.
   * Bumps the load epoch (so any in-flight buffer load for the outgoing scene
   * is discarded and never starts), then stops, disconnects and cancels the
   * gain ramps of every active source. The transport flag (`playing`) is left
   * untouched so the incoming scene keeps playing without a manual replay.
   *
   * Every soundscape switch (search, region/environment change, world-map pick,
   * geolocation, reshuffle) must route through here so nothing from the old
   * location can linger or start late on top of the new one.
   */
  beginSoundscapeTransition(): void {
    this.loadEpoch += 1;
    this.sourceRequests.clear();
    for (const instanceId of [...this.sources.keys()]) {
      this.removeSource(instanceId);
    }
  }

  async addSource(
    instanceId: string,
    sound: SoundDef,
    position: SpatialPoint,
    volume = 1,
    recipe?: PlaybackRecipe,
  ): Promise<void> {
    // Pin the load session: if a new soundscape supersedes us at any await
    // point below, we must discard this load and never start playback.
    const epoch = this.loadEpoch;
    const request = Symbol(instanceId);
    this.sourceRequests.set(instanceId, request);
    try {
      await this.unlock();
      if (epoch !== this.loadEpoch || this.sourceRequests.get(instanceId) !== request) return;
      const ctx = this.context!;

      const primarySrc = recipe?.src || sound.src;
      if (!primarySrc) return;

      const wantCrossfade =
        sound.loop && Boolean(recipe?.sustained) && Boolean(recipe?.secondarySrc);

      const layerSrcs = wantCrossfade ? [primarySrc, recipe!.secondarySrc!] : [primarySrc];
      const buffers = await Promise.all(layerSrcs.map((src) => this.loadBuffer(src)));
      if (epoch !== this.loadEpoch || !this.context || this.sourceRequests.get(instanceId) !== request) return;

      // Allocate/connect only after loading succeeds. Failed or cancelled loads
      // never leave silent panners and gains connected to the scene bus.
      this.removeSource(instanceId);

      const gain = ctx.createGain();
      const panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      // Raised alongside `PANNER_LATERAL_GAIN`: widening the stereo field pushes
      // side-placed sources further from the listener, and on the old 0.35 ref the
      // inverse curve dimmed them by ~25%. This keeps their loudness where it was
      // so the wider image is heard as direction, not as a volume drop.
      panner.refDistance = 0.5;
      panner.maxDistance = 3;
      panner.rolloffFactor = 1.2;
      panner.coneInnerAngle = 360;
      panner.coneOuterAngle = 360;

      panner.connect(gain);
      gain.connect(this.sceneGain ?? this.masterGain!);

      const baseDetune = recipe?.detuneCents ?? 0;
      const baseOffset = recipe?.loopOffset ?? 0;

      const layers: Layer[] = layerSrcs.map((src, index) => {
        const layerGain = ctx.createGain();
        // First layer starts audible; the crossfade partner starts silent.
        const baseLevel = wantCrossfade ? 0.85 : 1;
        layerGain.gain.value = wantCrossfade && index === 1 ? 0 : baseLevel;
        layerGain.connect(panner);
        return {
          src,
          buffer: buffers[index],
          gain: layerGain,
          source: null,
          // Give the crossfade partner a small extra detune so it never phases.
          detuneCents: baseDetune + (index === 1 ? 7 : 0),
          loopOffset: index === 1 ? (baseOffset + 0.37) % 1 : baseOffset,
          baseLevel,
        };
      });

      this.sources.set(instanceId, {
        soundId: sound.id,
        loop: sound.loop,
        layers,
        gain,
        panner,
        userVolume: volume,
        lastDistance: 0,
        crossfade: wantCrossfade,
        crossfadeTimer: null,
        crossfadeIndex: 0,
      });

      this.updatePosition(instanceId, position);
      this.updateVolume(instanceId, volume);

      if (this.playing) {
        this.startSource(instanceId);
      }
    } finally {
      if (this.sourceRequests.get(instanceId) === request) this.sourceRequests.delete(instanceId);
    }
  }

  removeSource(instanceId: string): void {
    this.sourceRequests.delete(instanceId);
    const node = this.sources.get(instanceId);
    if (!node) return;
    this.stopSource(instanceId);
    if (this.context) {
      node.gain.gain.cancelScheduledValues(this.context.currentTime);
    }
    for (const layer of node.layers) {
      layer.gain.disconnect();
    }
    node.gain.disconnect();
    node.panner.disconnect();
    this.sources.delete(instanceId);
  }

  updatePosition(instanceId: string, position: SpatialPoint): void {
    const node = this.sources.get(instanceId);
    if (!node) return;

    const pannerPos = toPannerPosition(position);
    node.panner.positionX.setValueAtTime(pannerPos.x, this.context!.currentTime);
    node.panner.positionZ.setValueAtTime(pannerPos.z, this.context!.currentTime);

    node.lastDistance = Math.hypot(position.x, position.y);
    this.applyGain(instanceId);
  }

  updateVolume(instanceId: string, volume: number): void {
    const node = this.sources.get(instanceId);
    if (!node) return;
    node.userVolume = Math.max(0, Math.min(1, volume));
    this.applyGain(instanceId);
  }

  setDuckingGain(gain: number, transitionSeconds = 0.2): void {
    this.duckingGain = Math.max(0, Math.min(1, gain));
    this.applyMasterGain(transitionSeconds);
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMasterVolume(volume: number, transitionSeconds = 0.08): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyMasterGain(transitionSeconds);
  }

  private effectiveMasterGain(): number {
    return this.baseMasterLevel * this.masterVolume * this.duckingGain;
  }

  private applyMasterGain(transitionSeconds: number): void {
    if (!this.context || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(
      this.effectiveMasterGain(),
      this.context.currentTime,
      transitionSeconds,
    );
  }

  private applyGain(instanceId: string): void {
    const node = this.sources.get(instanceId);
    if (!node || !this.context) return;

    const gain = gainFromDistance(node.lastDistance) * node.userVolume;
    node.gain.gain.setTargetAtTime(gain, this.context.currentTime, 0.03);
  }

  async play(): Promise<void> {
    const epoch = ++this.transportEpoch;
    await this.unlock();
    if (epoch !== this.transportEpoch) return;
    if (this.playing) return;
    this.playing = true;
    // Bring the whole scene up as one gesture rather than snapping every layer
    // on at full level. Ramping the shared scene bus (not the individual source
    // gains) keeps this independent of the spatial distance/volume system, which
    // is continuously retargeting those.
    const sceneGain = this.sceneGain;
    if (sceneGain && this.context) {
      const now = this.context.currentTime;
      sceneGain.gain.cancelScheduledValues(now);
      sceneGain.gain.setValueAtTime(0, now);
      sceneGain.gain.linearRampToValueAtTime(1, now + SCENE_FADE_IN_S);
    }
    for (const instanceId of this.sources.keys()) {
      this.startSource(instanceId);
    }
  }

  pause(): void {
    this.transportEpoch += 1;
    this.playing = false;
    for (const instanceId of this.sources.keys()) {
      this.stopSource(instanceId);
    }
  }

  clear(): void {
    this.loadEpoch += 1;
    this.sourceRequests.clear();
    this.pause();
    for (const instanceId of [...this.sources.keys()]) {
      this.removeSource(instanceId);
    }
  }

  private startSource(instanceId: string): void {
    const node = this.sources.get(instanceId);
    if (!node || !this.context) return;

    for (const layer of node.layers) {
      if (layer.source) continue;
      const source = this.context.createBufferSource();
      source.buffer = layer.buffer;
      source.loop = node.loop;
      if (layer.detuneCents && source.detune) {
        source.detune.value = layer.detuneCents;
      }
      source.connect(layer.gain);
      const offset = node.loop
        ? Math.min(
            layer.loopOffset * layer.buffer.duration,
            Math.max(0, layer.buffer.duration - LOOP_END_SAFETY_S),
          )
        : 0;
      source.start(0, offset);
      layer.source = source;

      source.onended = () => {
        if (!node.loop && layer.source === source) {
          layer.source = null;
        }
      };
    }

    if (node.crossfade && node.layers.length > 1) {
      this.scheduleCrossfade(instanceId);
    }
  }

  private scheduleCrossfade(instanceId: string): void {
    const node = this.sources.get(instanceId);
    if (!node || !this.context || node.crossfadeTimer !== null) return;

    const cycleMs = (CROSSFADE_MIN_S + Math.random() * (CROSSFADE_MAX_S - CROSSFADE_MIN_S)) * 1000;

    const step = () => {
      const current = this.sources.get(instanceId);
      if (!current || !this.context) return;
      current.crossfadeIndex = (current.crossfadeIndex + 1) % current.layers.length;
      const active = current.crossfadeIndex;
      const constant = (cycleMs / 1000) * CROSSFADE_RAMP_FRACTION;
      current.layers.forEach((layer, index) => {
        const target = index === active ? layer.baseLevel : 0;
        layer.gain.gain.setTargetAtTime(target, this.context!.currentTime, constant);
      });
    };

    node.crossfadeTimer = window.setInterval(step, cycleMs);
  }

  private stopSource(instanceId: string): void {
    const node = this.sources.get(instanceId);
    if (!node) return;

    if (node.crossfadeTimer !== null) {
      window.clearInterval(node.crossfadeTimer);
      node.crossfadeTimer = null;
    }
    node.crossfadeIndex = 0;

    const now = this.context?.currentTime ?? 0;
    for (const layer of node.layers) {
      // Cancel any pending crossfade/gain ramp so a stopped layer can never
      // ramp itself back up after the source has been torn down.
      layer.gain.gain.cancelScheduledValues(now);
      if (!layer.source) continue;
      try {
        layer.source.stop();
      } catch {
        // Source may already be stopped.
      }
      layer.source.disconnect();
      layer.source = null;
      // Reset crossfade mix so a restart begins from the same baseline.
      if (node.crossfade) {
        layer.gain.gain.value = layer === node.layers[0] ? layer.baseLevel : 0;
      }
    }
  }
}

export const audioEngine = new AudioEngine();
