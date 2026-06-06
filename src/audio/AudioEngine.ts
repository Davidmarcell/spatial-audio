import type { SoundDef, SpatialPoint } from '../data/types';
import { gainFromDistance, toPannerPosition } from './spatialMath';
import { publicAssetPath } from '../utils/publicAssetPath';

type SourceNode = {
  soundId: string;
  buffer: AudioBuffer;
  loop: boolean;
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  panner: PannerNode;
  userVolume: number;
  lastDistance: number;
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
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
      this.masterGain.gain.value = 0.9;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  async preloadSounds(sounds: SoundDef[]): Promise<void> {
    await this.unlock();
    await Promise.all(sounds.map((sound) => this.loadBuffer(sound.src)));
  }

  private async loadBuffer(src: string): Promise<AudioBuffer> {
    const resolvedSrc = publicAssetPath(src);
    const cached = this.bufferCache.get(resolvedSrc);
    if (cached) return cached;

    const response = await fetch(resolvedSrc);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${resolvedSrc}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context!.decodeAudioData(arrayBuffer.slice(0));
    this.bufferCache.set(resolvedSrc, audioBuffer);
    return audioBuffer;
  }

  async addSource(
    instanceId: string,
    sound: SoundDef,
    position: SpatialPoint,
    volume = 1,
  ): Promise<void> {
    await this.unlock();
    const buffer = await this.loadBuffer(sound.src);
    const ctx = this.context!;

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

    this.sources.set(instanceId, {
      soundId: sound.id,
      buffer,
      loop: sound.loop,
      source: null,
      gain,
      panner,
      userVolume: volume,
      lastDistance: 0,
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
    if (!node || node.source || !this.context) return;

    const source = this.context.createBufferSource();
    source.buffer = node.buffer;
    source.loop = node.loop;
    source.connect(node.panner);
    source.start(0);
    node.source = source;

    source.onended = () => {
      if (!node.loop && node.source === source) {
        node.source = null;
      }
    };
  }

  private stopSource(instanceId: string): void {
    const node = this.sources.get(instanceId);
    if (!node?.source) return;

    try {
      node.source.stop();
    } catch {
      // Source may already be stopped.
    }
    node.source.disconnect();
    node.source = null;
  }
}

export const audioEngine = new AudioEngine();
