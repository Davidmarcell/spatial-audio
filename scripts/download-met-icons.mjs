#!/usr/bin/env node
/**
 * Downloads icon images from scripts/icon-manifest.json:
 * - Wikimedia plates → public/icons/
 * - NYPL Digital Collections (IIIF) → public/icons/
 * - Met Open Access drawings → public/icons/met/
 * Generates src/data/iconPools.generated.ts for the app.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const manifestPath = path.join(__dirname, 'icon-manifest.json');
const iconsDir = path.join(root, 'public/icons');
const metDir = path.join(iconsDir, 'met');
const outPath = path.join(root, 'src/data/iconPools.generated.ts');
const UA = 'Saudade/1.0 (educational; saudade)';
const NYPL_LICENSE =
  'Public domain (NYPL: no known U.S. copyright restrictions). Credit: From The New York Public Library.';
const NYPL_IIIF = 'https://iiif-prod.nypl.org/index.php';
const NYPL_IMAGES = 'https://images.nypl.org/index.php';

function nyplImageUrl(imageId, derivative = 'q') {
  return `${NYPL_IIIF}?id=${imageId}&t=${derivative}`;
}

async function downloadNypl(imageId, dest, derivative = 'q') {
  const urls = [
    nyplImageUrl(imageId, derivative),
    `${NYPL_IMAGES}?id=${imageId}&t=${derivative}`,
  ];
  let lastErr;
  for (const url of urls) {
    try {
      await downloadUrl(url, dest);
      return url;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`No NYPL image for id ${imageId}`);
}

async function fileExists(dest) {
  try {
    await access(dest);
    return true;
  } catch {
    return false;
  }
}

async function downloadUrl(url, dest, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    if (res.status === 429 && attempt < retries) {
      const wait = 2000 * (attempt + 1);
      console.warn(`  rate limited, waiting ${wait}ms…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('image')) {
      throw new Error(`Not an image (${type}) for ${url}`);
    }
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return;
  }
}

async function downloadMet(objectId, dest, iiifSuffix = 'main-image') {
  const suffixes =
    iiifSuffix === 'main-image' ? ['main-image', 'preview'] : [iiifSuffix, 'main-image', 'preview'];
  for (const suffix of suffixes) {
    const url = `https://collectionapi.metmuseum.org/api/collection/v1/iiif/${objectId}/${suffix}`;
    try {
      await downloadUrl(url, dest);
      return suffix;
    } catch {
      // try next suffix
    }
  }
  throw new Error(`No IIIF image for Met object ${objectId}`);
}

function esc(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function fetchMetPrimaryImage(objectId) {
  const res = await fetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`,
    { headers: { 'User-Agent': UA } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.isPublicDomain || !data.primaryImage) return null;
  return data.primaryImage;
}

function poolEntry(src, item, license, detailSrc) {
  const entry = {
    src,
    title: item.title,
    author: item.artist ?? item.author,
    medium: item.medium,
    license,
    sourceUrl: item.sourceUrl,
  };
  if (detailSrc) entry.detailSrc = detailSrc;
  // Region/climate flavour tags bias location-aware tile selection (see iconArt.ts).
  if (Array.isArray(item.tags) && item.tags.length > 0) entry.tags = item.tags;
  return entry;
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await mkdir(iconsDir, { recursive: true });
  await mkdir(metDir, { recursive: true });

  const fixedIcons = {};
  const iconPools = Object.fromEntries(Object.keys(manifest.pools).map((name) => [name, []]));
  const artworkAttributions = [];

  for (const item of manifest.nypl ?? []) {
    const dest = path.join(iconsDir, item.file);
    const derivative = item.derivative ?? 'q';
    if (await fileExists(dest)) {
      console.log(`nypl ${item.id} (skip, exists)`);
    } else {
      console.log(`nypl ${item.id} (${item.imageId})`);
      await downloadNypl(item.imageId, dest, derivative);
    }
    const src = `/icons/${item.file}`;
    fixedIcons[item.id] = src;
    artworkAttributions.push({
      file: src,
      title: item.title,
      author: `${item.author.replace(/\.\s*$/, '')}. From The New York Public Library.`,
      license: NYPL_LICENSE,
      sourceUrl: item.sourceUrl,
    });
    await new Promise((r) => setTimeout(r, 800));
  }

  for (const item of manifest.wikimedia) {
    const dest = path.join(iconsDir, item.file);
    if (await fileExists(dest)) {
      console.log(`wikimedia ${item.id} (skip, exists)`);
    } else {
      console.log(`wikimedia ${item.id}`);
      await downloadUrl(item.url, dest);
    }
    const src = `/icons/${item.file}`;
    const license = item.license;
    const entry = poolEntry(src, item, license);

    if (item.pool) {
      iconPools[item.pool].push(entry);
    } else {
      fixedIcons[item.id] = src;
    }

    artworkAttributions.push({
      file: src,
      title: item.title,
      author: item.author,
      license,
      sourceUrl: item.sourceUrl,
    });
    await new Promise((r) => setTimeout(r, 800));
  }

  for (const [poolName, entries] of Object.entries(manifest.pools)) {
    for (const entry of entries) {
      const file = `${entry.objectId}.jpg`;
      const dest = path.join(metDir, file);
      let detailSrc = null;
      try {
        detailSrc = await fetchMetPrimaryImage(entry.objectId);
      } catch {
        // fall back to tile only
      }
      if (await fileExists(dest)) {
        console.log(`met ${poolName} ${entry.objectId} (skip, exists)`);
      } else if (detailSrc) {
        console.log(`met ${poolName} ${entry.objectId}`);
        await downloadUrl(detailSrc, dest);
      } else {
        console.log(`met ${poolName} ${entry.objectId}`);
        await downloadMet(entry.objectId, dest, entry.iiifSuffix ?? 'main-image');
      }
      const src = `/icons/met/${file}`;
      const pooled = poolEntry(
        src,
        entry,
        'CC0 (The Metropolitan Museum of Art)',
        detailSrc ?? undefined,
      );
      iconPools[poolName].push(pooled);
      artworkAttributions.push({
        file: src,
        title: entry.title,
        author: `${entry.artist} — ${entry.medium}`,
        license: 'CC0 (The Metropolitan Museum of Art)',
        sourceUrl: entry.sourceUrl,
      });
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  const soundPoolMap = manifest.soundPoolMap;

  const lines = [
    '// Auto-generated by scripts/download-met-icons.mjs — do not edit by hand.',
    "import type { ArtworkAttribution } from './types';",
    '',
    'export type IconPoolEntry = {',
    '  src: string;',
    '  title: string;',
    '  author: string;',
    '  medium?: string;',
    '  license: string;',
    '  sourceUrl: string;',
    '  detailSrc?: string;',
    '  /** Region/climate flavour tags biasing location-aware tile selection. */',
    '  tags?: string[];',
    '};',
    '',
    `export const fixedIcons: Record<string, string> = ${JSON.stringify(fixedIcons, null, 2)};`,
    '',
    `export const iconPools: Record<string, IconPoolEntry[]> = ${JSON.stringify(iconPools, null, 2)};`,
    '',
    `export const soundPoolMap: Record<string, string> = ${JSON.stringify(soundPoolMap, null, 2)};`,
    '',
    'export const artworkAttributions: ArtworkAttribution[] = [',
    ...artworkAttributions.map(
      (item) =>
        `  { file: '${esc(item.file)}', title: '${esc(item.title)}', author: '${esc(item.author)}', license: '${esc(item.license)}', sourceUrl: '${esc(item.sourceUrl)}' },`,
    ),
    '];',
    '',
  ];

  await writeFile(outPath, lines.join('\n'));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
