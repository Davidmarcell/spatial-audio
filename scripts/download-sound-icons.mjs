#!/usr/bin/env node
/**
 * Downloads curated public-domain / CC0 / CC-BY(-SA) SOUND-TYPE illustration
 * plates (markets, church + temple bells, streams/fountains, street traffic,
 * frogs, mosques, music, trams …) from Wikimedia Commons into
 * public/icons/pool/<name>.jpg (or a caller-specified subpath).
 *
 * These are the *subject/illustration* plates the procedural soundscape picker
 * pulls for generated cities (see src/data/iconArt.ts). Unlike location hero
 * art (download-location-art.mjs / Met), these are keyed by SOUND TYPE, not by
 * place, so a generated "Berlin" market/bells/stream tile gets a real market /
 * belfry / stream illustration instead of a shared forest plate.
 *
 * The manifest lives in scripts/sound-icon-manifest.json:
 *   [{ "file": "market-european.jpg", "commons": "File:....jpg" }, ...]
 *
 * Resolves each Commons title via the API (imageinfo: url + license +
 * artist), downloads a width-capped thumbnail, and prints the resolved
 * licence/author so attributions can be verified. Idempotent: skips files that
 * already exist. Run: node scripts/download-sound-icons.mjs
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const manifestPath = path.join(__dirname, 'sound-icon-manifest.json');
const poolDir = path.join(root, 'public/icons/pool');
const UA = 'Saudade/1.0 (educational sound-icon art; contact via repo)';
const WIDTH = 640;

async function fileExists(dest) {
  try { await access(dest); return true; } catch { return false; }
}

async function getJson(url, retries = 6) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if ((res.status === 403 || res.status === 429) && attempt < retries) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }
}

async function downloadUrl(url, dest, retries = 8) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('image')) throw new Error(`Not an image (${type}) for ${url}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return;
  }
}

function strip(html) {
  return (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function resolveCommons(title) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('format', 'json');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url|mime|size|extmetadata');
  api.searchParams.set('iiurlwidth', String(WIDTH));
  api.searchParams.set('titles', title);
  const data = await getJson(api.toString());
  const pages = Object.values(data?.query?.pages ?? {});
  const page = pages[0];
  if (!page || page.missing !== undefined) return null;
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  return {
    thumburl: info.thumburl,
    mime: info.mime,
    width: info.width,
    height: info.height,
    license: strip(meta.LicenseShortName?.value) || '?',
    artist: strip(meta.Artist?.value) || '?',
    credit: strip(meta.Credit?.value),
    descUrl: info.descriptionshorturl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await mkdir(poolDir, { recursive: true });
  const results = [];
  const failures = [];

  for (const item of manifest) {
    const dest = path.join(poolDir, item.file);
    if (await fileExists(dest)) {
      console.log(`skip (exists)  ${item.file}`);
      continue;
    }
    try {
      const info = await resolveCommons(item.commons);
      if (!info) { failures.push({ file: item.file, reason: 'missing on Commons', commons: item.commons }); console.log(`MISS           ${item.file}  <- ${item.commons}`); continue; }
      if (!info.thumburl) { failures.push({ file: item.file, reason: 'no thumburl', commons: item.commons }); console.log(`NO-THUMB       ${item.file}`); continue; }
      await downloadUrl(info.thumburl, dest);
      results.push({ file: item.file, license: info.license, artist: info.artist, descUrl: info.descUrl });
      console.log(`OK  ${item.file.padEnd(30)} | ${info.license.padEnd(16)} | ${info.width}x${info.height} | ${info.artist.slice(0, 50)}`);
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      failures.push({ file: item.file, reason: String(err), commons: item.commons });
      console.log(`ERR ${item.file}  ${err}`);
    }
  }

  console.log(`\n== ${results.length} downloaded, ${failures.length} failed ==`);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f.file}: ${f.reason} (${f.commons})`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
