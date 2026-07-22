/**
 * Higher-resolution image URL for the detail modal. Tile icons stay on bundled
 * ~330px (Wikimedia) or local files; detail view pulls larger sources when possible.
 */
export const FALLBACK_ICON_SRC = '/icons/gray-catbird.jpg';

/** Met plates shipped under public/icons/met/ (see npm run download:icons). */
const BUNDLED_MET_SRCS = new Set([
  '/icons/met/10378.jpg',
  '/icons/met/10770.jpg',
  '/icons/met/11124.jpg',
  '/icons/met/11131.jpg',
  '/icons/met/11138.jpg',
  '/icons/met/11306.jpg',
  '/icons/met/12307.jpg',
  '/icons/met/12392.jpg',
  '/icons/met/12586.jpg',
  '/icons/met/286187.jpg',
  '/icons/met/338617.jpg',
  '/icons/met/363843.jpg',
  '/icons/met/371022.jpg',
  '/icons/met/393450.jpg',
  '/icons/met/489985.jpg',
  '/icons/met/55433.jpg',
  '/icons/met/751141.jpg',
  '/icons/met/830271.jpg',
  '/icons/met/853645.jpg',
]);

export function isLocallyBundledIconSrc(src: string): boolean {
  return !src.startsWith('/icons/met/') || BUNDLED_MET_SRCS.has(src);
}

export function getDetailIconSrc(
  tileSrc: string,
  sourceUrl?: string,
  detailSrc?: string,
): string {
  if (detailSrc) return detailSrc;

  if (!sourceUrl) return tileSrc;

  const commonsFile = sourceUrl.match(/commons\.wikimedia\.org\/wiki\/File:(.+)$/i);
  if (commonsFile?.[1]) {
    const fileName = decodeURIComponent(commonsFile[1]);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1200`;
  }

  // Met IIIF main-image often 400s; prefer bundled tile or explicit detailSrc from pool.
  if (/metmuseum\.org\/art\/collection\/search\/\d+/i.test(sourceUrl)) {
    return tileSrc;
  }

  return tileSrc;
}

/** Best URL for a small tile — local file when bundled, otherwise a remote fallback. */
export function resolveTileIconSrc(entry: {
  src: string;
  sourceUrl?: string;
  detailSrc?: string;
}): string {
  if (isLocallyBundledIconSrc(entry.src)) return entry.src;

  const remote = getDetailIconSrc(entry.src, entry.sourceUrl, entry.detailSrc);
  if (remote !== entry.src) return remote;

  const commonsFile = entry.sourceUrl?.match(/commons\.wikimedia\.org\/wiki\/File:(.+)$/i);
  if (commonsFile?.[1]) {
    const fileName = decodeURIComponent(commonsFile[1]);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=640`;
  }

  return entry.src;
}

export function iconSrcFallbackChain(
  entry: { src: string; sourceUrl?: string; detailSrc?: string },
  size: 'tile' | 'detail' = 'tile',
): string[] {
  const tileSrc = resolveTileIconSrc(entry);
  const detailPrimary = getDetailIconSrc(entry.src, entry.sourceUrl, entry.detailSrc);
  const chain: string[] = [];

  // Prefer bundled local files first so dev and portfolio base paths always resolve.
  if (isLocallyBundledIconSrc(entry.src)) {
    chain.push(entry.src);
  }

  if (size === 'detail') {
    if (detailPrimary !== entry.src) chain.push(detailPrimary);
    if (entry.detailSrc && entry.detailSrc !== detailPrimary) chain.push(entry.detailSrc);
  } else if (tileSrc !== entry.src) {
    chain.push(tileSrc);
  }

  const commonsRemote = getDetailIconSrc(entry.src, entry.sourceUrl, undefined);
  if (commonsRemote !== entry.src && !chain.includes(commonsRemote)) {
    chain.push(commonsRemote);
  }

  if (!chain.includes(FALLBACK_ICON_SRC)) {
    chain.push(FALLBACK_ICON_SRC);
  }

  return chain;
}
