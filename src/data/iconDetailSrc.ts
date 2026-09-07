/**
 * Higher-resolution image URL for the detail modal. Tile icons stay on bundled
 * ~330px (Wikimedia) or local files; detail view pulls larger sources when possible.
 */
export const FALLBACK_ICON_SRC = '/icons/gray-catbird.jpg';

/**
 * True when `src` is an app-shipped file under `public/icons/` (including the
 * full Met plate set under `public/icons/met/`). Remote http(s) URLs are not
 * local.
 *
 * Historically only a subset of `/icons/met/*` was allowlisted; plates on disk
 * but missing from that list were treated as remote-only, so the tile fallback
 * chain skipped the local file and could show a broken image when Wikimedia /
 * the catbird fallback failed. Prefer any `/icons/` path as local.
 */
export function isLocallyBundledIconSrc(src: string): boolean {
  if (!src) return false;
  return src.startsWith('/icons/');
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

function pushUnique(chain: string[], src: string | undefined) {
  if (!src || chain.includes(src)) return;
  chain.push(src);
}

export function iconSrcFallbackChain(
  entry: { src: string; sourceUrl?: string; detailSrc?: string },
  size: 'tile' | 'detail' = 'tile',
): string[] {
  const tileSrc = resolveTileIconSrc(entry);
  const detailPrimary = getDetailIconSrc(entry.src, entry.sourceUrl, entry.detailSrc);
  const chain: string[] = [];

  // Always try the authored local `/icons/…` path first when present, even if a
  // remote detail/commons URL is also available.
  if (entry.src.startsWith('/icons/')) {
    pushUnique(chain, entry.src);
  } else if (isLocallyBundledIconSrc(entry.src)) {
    pushUnique(chain, entry.src);
  }

  if (size === 'detail') {
    if (detailPrimary !== entry.src) pushUnique(chain, detailPrimary);
    if (entry.detailSrc && entry.detailSrc !== detailPrimary) {
      pushUnique(chain, entry.detailSrc);
    }
  } else if (tileSrc !== entry.src) {
    pushUnique(chain, tileSrc);
  }

  const commonsRemote = getDetailIconSrc(entry.src, entry.sourceUrl, undefined);
  if (commonsRemote !== entry.src) {
    pushUnique(chain, commonsRemote);
  }

  pushUnique(chain, FALLBACK_ICON_SRC);

  return chain;
}
