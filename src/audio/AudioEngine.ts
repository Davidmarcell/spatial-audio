import type { SoundDef, SpatialPoint } from '../data/types';
import { gainFromDistance, toPannerPosition } from './spatialMath';

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

const CROSSFADE_MIN_S = 16;
const CROSSFADE_MAX_S = 30;

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  // Headroom ceiling: the gain applied when master volume is at 100%.
  private readonly baseMasterLevel = 0.9;
  // User-controlled master volume (0–1). Ducking multiplies on top of this.
  private masterVolume = 1;
  private duckingGain = 1;
  private bufferCache = new Map<string, AudioBuffer>();
  private inflight = new Map<string, Promise<AudioBuffer>>();
  private sources = new Map<string, SourceNode>();
  private playing = false;

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

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.effectiveMasterGain();
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /** Preload only the given variant files (lazy: a scene's chosen clips). */
  async preloadVariants(srcs: Iterable<string>): Promise<void> {
    await this.unlock();
    const unique = [...new Set([...srcs].filter(Boolean))];
    await Promise.all(unique.map((src) => this.loadBuffer(src)));
  }

  async preloadSounds(sounds: SoundDef[]): Promise<void> {
    await this.preloadVariants(sounds.map((sound) => sound.src));
  }

  private async loadBuffer(src: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(src);
    if (cached) return cached;

    const pending = this.inflight.get(src);
    if (pending) return pending;

    const promise = (async () => {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Failed to load audio: ${src}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context!.decodeAudioData(arrayBuffer.slice(0));
      this.bufferCache.set(src, audioBuffer);
      return audioBuffer;
    })();

    this.inflight.set(src, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(src);
    }
  }

  async addSource(
    instanceId: string,
    sound: SoundDef,
    position: SpatialPoint,
    volume = 1,
    recipe?: PlaybackRecipe,
  ): Promise<void> {
    await this.unlock();
    const ctx = this.context!;

    const primarySrc = recipe?.src || sound.src;
    if (!primarySrc) return;

    const wantCrossfade =
      sound.loop && Boolean(recipe?.sustained) && Boolean(recipe?.secondarySrc);

    const gain = ctx.createGain();
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 0.35;
    panner.maxDistance = 3;
    panner.rolloffFactor = 1.2;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;

    panner.connect(gain);
    gain.connect(this.masterGain!);

    const layerSrcs = wantCrossfade ? [primarySrc, recipe!.secondarySrc!] : [primarySrc];
    const buffers = await Promise.all(layerSrcs.map((src) => this.loadBuffer(src)));

    // Bail out if the source was torn down while buffers were loading.
    if (!this.context) return;

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
  }

  removeSource(instanceId: string): void {
    const node = this.sources.get(instanceId);
    if (!node) return;
    this.stopSource(instanceId);
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
    await this.unlock();
    if (this.playing) return;
    this.playing = true;
    for (const instanceId of this.sources.keys()) {
      this.startSource(instanceId);
    }
  }

  pause(): void {
    this.playing = false;
    for (const instanceId of this.sources.keys()) {
      this.stopSource(instanceId);
    }
  }

  clear(): void {
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
        ? Math.min(layer.loopOffset * layer.buffer.duration, Math.max(0, layer.buffer.duration - 0.05))
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
      const constant = (cycleMs / 1000) * 0.35;
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

    for (const layer of node.layers) {
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
