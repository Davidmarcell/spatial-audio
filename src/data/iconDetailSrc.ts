/**
 * Higher-resolution image URL for the detail modal. Tile icons stay on bundled
 * ~330px (Wikimedia) or local files; detail view pulls larger sources when possible.
 */
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
