#!/usr/bin/env node
/**
 * Downloads curated location-hero art declared in the "locationArt" section of
 * scripts/icon-manifest.json from the Met Open Access collection into
 * public/icons/met/<objectId>.jpg. Prefers primaryImageSmall to keep files
 * small. Idempotent (skips files that already exist).
 *
 * These are hand-referenced by src/data/locationArt.ts and are intentionally
 * kept out of the sound-icon pools in iconPools.generated.ts.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const manifestPath = path.join(__dirname, 'icon-manifest.json');
const metDir = path.join(root, 'public/icons/met');
const UA = 'Saudade/1.0 (educational; saudade)';

async function fileExists(dest) {
  try {
    await access(dest);
    return true;
  } catch {
    return false;
  }
}

async function getJson(url, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if ((res.status === 403 || res.status === 429) && attempt < retries) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }
}

async function downloadUrl(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('image')) throw new Error(`Not an image (${type}) for ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await mkdir(metDir, { recursive: true });

  for (const item of manifest.locationArt ?? []) {
    const dest = path.join(metDir, `${item.objectId}.jpg`);
    if (await fileExists(dest)) {
      console.log(`met location ${item.objectId} (skip, exists)`);
      continue;
    }
    const data = await getJson(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${item.objectId}`,
    );
    if (!data.isPublicDomain) {
      throw new Error(`Met object ${item.objectId} is not public domain`);
    }
    const url = data.primaryImageSmall || data.primaryImage;
    if (!url) throw new Error(`Met object ${item.objectId} has no image`);
    console.log(`met location ${item.objectId} (${item.locationId})`);
    await downloadUrl(url, dest);
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('Location art download complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
