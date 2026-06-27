/**
 * Deterministic pseudo-randomness helpers. Seeding by a location key makes a
 * place consistent with itself across reloads while different places (or a new
 * shuffle salt) get distinct results.
 */

/** xfnv1a string hash → 32-bit seed. */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — fast, deterministic, good enough for picking clips. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function createRng(seedKey: string): Rng {
  return mulberry32(hashSeed(seedKey));
}

/** Weighted pick from `items`; `weightOf` returns a non-negative weight. */
export function weightedPick<T>(items: T[], weightOf: (item: T) => number, rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0, weightOf(item));
    total += w;
    return w;
  });
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let target = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    target -= weights[i];
    if (target < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Deterministic Fisher-Yates shuffle driven by the supplied rng. */
export function shuffleWithRng<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Random float in [min, max) from the supplied rng. */
export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}
