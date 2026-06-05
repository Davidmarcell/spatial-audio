import { getRegion } from '../data/environments';
import type { ActiveSound, SpatialPoint } from '../data/types';
import type { WorldLocation } from '../data/worldLocations';

export type SharedScene = {
  environmentId: string;
  regionId: string;
  locationName?: string;
  customLocation?: Pick<
    WorldLocation,
    'lat' | 'lng' | 'name' | 'subtitle' | 'placeId' | 'environmentId' | 'regionId'
  >;
  sounds: Array<{
    soundId: string;
    position: SpatialPoint;
    volume: number;
  }>;
};

type SceneWire = {
  e: string;
  r: string;
  n?: string;
  c?: [number, number, string, string, string?];
  s: [string, number, number, number][];
};

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function maybeCompress(json: string): Promise<{ payload: string; z: 0 | 1 }> {
  if (typeof CompressionStream === 'undefined' || json.length < 180) {
    return { payload: json, z: 0 };
  }
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressed = await new Response(stream).arrayBuffer();
    const encoded = toBase64Url(new Uint8Array(compressed));
    if (encoded.length < toBase64Url(new TextEncoder().encode(json)).length) {
      return { payload: encoded, z: 1 };
    }
  } catch {
    // fall through to uncompressed
  }
  return { payload: json, z: 0 };
}

async function maybeDecompress(payload: string, compressed: boolean): Promise<string> {
  if (!compressed) return payload;
  if (typeof DecompressionStream === 'undefined') return '';
  try {
    const bytes = fromBase64Url(payload);
    const stream = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream('deflate'));
    return await new Response(stream).text();
  } catch {
    return '';
  }
}

function encodeWire(scene: SharedScene): SceneWire {
  const wire: SceneWire = {
    e: scene.environmentId,
    r: scene.regionId,
    s: scene.sounds.map((item) => [
      item.soundId,
      round3(item.position.x),
      round3(item.position.y),
      round3(item.volume),
    ]),
  };
  if (scene.locationName) wire.n = scene.locationName;
  if (scene.customLocation) {
    wire.c = [
      round3(scene.customLocation.lat),
      round3(scene.customLocation.lng),
      scene.customLocation.name,
      scene.customLocation.subtitle,
      scene.customLocation.placeId,
    ];
  }
  return wire;
}

function decodeWire(wire: SceneWire): SharedScene | null {
  if (!wire.e || !wire.r || !Array.isArray(wire.s)) return null;
  const region = getRegion(wire.e, wire.r);
  if (!region) return null;

  const validSoundIds = new Set(region.sounds.map((sound) => sound.id));
  const sounds = wire.s
    .filter((row) => Array.isArray(row) && row.length >= 4 && validSoundIds.has(row[0]))
    .map(([soundId, x, y, volume]) => ({
      soundId,
      position: { x: Number(x), y: Number(y) },
      volume: Math.max(0, Math.min(1, Number(volume))),
    }));

  if (sounds.length === 0) return null;

  const scene: SharedScene = {
    environmentId: wire.e,
    regionId: wire.r,
    sounds,
  };
  if (typeof wire.n === 'string' && wire.n) scene.locationName = wire.n;
  if (Array.isArray(wire.c) && wire.c.length >= 4) {
    scene.customLocation = {
      lat: Number(wire.c[0]),
      lng: Number(wire.c[1]),
      name: String(wire.c[2]),
      subtitle: String(wire.c[3]),
      environmentId: wire.e,
      regionId: wire.r,
      placeId: wire.c[4] ? String(wire.c[4]) : undefined,
    };
  }
  return scene;
}

export function buildScenePayload(scene: SharedScene): Promise<string> {
  const json = JSON.stringify(encodeWire(scene));
  return maybeCompress(json).then(({ payload, z }) => {
    if (z) return `z.${payload}`;
    return toBase64Url(new TextEncoder().encode(json));
  });
}

export async function decodeScenePayload(encoded: string): Promise<SharedScene | null> {
  const trimmed = encoded.trim();
  if (!trimmed) return null;

  const compressed = trimmed.startsWith('z.');
  const body = compressed ? trimmed.slice(2) : trimmed;

  let json = '';
  if (compressed) {
    json = await maybeDecompress(body, true);
  } else {
    try {
      json = new TextDecoder().decode(fromBase64Url(body));
    } catch {
      json = body;
    }
  }

  if (!json) return null;

  try {
    const wire = JSON.parse(json) as SceneWire;
    return decodeWire(wire);
  } catch {
    return null;
  }
}

export async function buildSceneShareUrl(
  scene: SharedScene,
  href = typeof window !== 'undefined' ? window.location.href : '',
): Promise<string> {
  if (!href) return '';
  const payload = await buildScenePayload(scene);
  const url = new URL(href);
  url.searchParams.set('scene', payload);
  url.hash = '';
  return url.toString();
}

export function readSceneParam(href: string): string | null {
  const url = new URL(href);
  const query = url.searchParams.get('scene');
  if (query) return query;
  const hash = url.hash.replace(/^#/, '');
  if (hash.startsWith('scene=')) return hash.slice('scene='.length);
  return null;
}

export async function parseSceneFromUrl(
  href = typeof window !== 'undefined' ? window.location.href : '',
): Promise<SharedScene | null> {
  if (!href) return null;
  const param = readSceneParam(href);
  if (!param) return null;
  return decodeScenePayload(param);
}

export function clearSceneFromUrl(href = window.location.href) {
  const url = new URL(href);
  url.searchParams.delete('scene');
  if (url.hash.startsWith('#scene=')) url.hash = '';
  window.history.replaceState(null, '', url);
}

export function sceneFromAppState(input: {
  environmentId: string;
  regionId: string;
  locationName: string;
  customGlobeLocation: WorldLocation | null;
  activeSounds: ActiveSound[];
}): SharedScene | null {
  const region = getRegion(input.environmentId, input.regionId);
  if (!region) return null;

  const validSoundIds = new Set(region.sounds.map((sound) => sound.id));
  const sounds = input.activeSounds
    .filter((item) => validSoundIds.has(item.soundId))
    .map((item) => ({
      soundId: item.soundId,
      position: item.position,
      volume: item.volume,
    }));

  if (sounds.length === 0) return null;

  const scene: SharedScene = {
    environmentId: input.environmentId,
    regionId: input.regionId,
    locationName: input.locationName,
    sounds,
  };

  if (
    input.customGlobeLocation
    && input.customGlobeLocation.environmentId === input.environmentId
    && input.customGlobeLocation.regionId === input.regionId
    && input.customGlobeLocation.custom
  ) {
    scene.customLocation = {
      lat: input.customGlobeLocation.lat,
      lng: input.customGlobeLocation.lng,
      name: input.customGlobeLocation.name,
      subtitle: input.customGlobeLocation.subtitle,
      placeId: input.customGlobeLocation.placeId,
      environmentId: input.environmentId,
      regionId: input.regionId,
    };
  }

  return scene;
}

export function customLocationFromScene(scene: SharedScene): WorldLocation | null {
  if (!scene.customLocation) return null;
  const { lat, lng, name, subtitle, placeId, environmentId, regionId } = scene.customLocation;
  return {
    id: placeId ? `shared-${placeId}` : `shared-${lat}-${lng}`,
    name,
    subtitle,
    lat,
    lng,
    environmentId,
    regionId,
    custom: true,
    placeId,
  };
}
