#!/usr/bin/env node
/**
 * Lists images embedded in an English Wikipedia article (curation helper) with
 * their Commons licence/mime/size, to surface historical illustrations of a
 * place that full-text Commons search buries under book scans.
 *
 *   node scripts/wiki-images.mjs "Mitla"
 */
const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Usage: node scripts/wiki-images.mjs "<Wikipedia article title>"');
  process.exit(1);
}
const UA = 'Saudade/1.0 (educational)';
async function get(url) {
  for (let a = 0; a <= 6; a++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.status === 429 && a < 6) { await new Promise((s) => setTimeout(s, 2000 * (a + 1))); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
}

const wiki = new URL('https://en.wikipedia.org/w/api.php');
wiki.searchParams.set('action', 'query');
wiki.searchParams.set('format', 'json');
wiki.searchParams.set('prop', 'images');
wiki.searchParams.set('titles', title);
wiki.searchParams.set('imlimit', '200');
const data = await get(wiki.toString());
const pages = Object.values(data?.query?.pages ?? {});
const files = [];
for (const p of pages) for (const im of p.images ?? []) if (/\.(jpe?g|png|tif|gif)$/i.test(im.title)) files.push(im.title);
if (files.length === 0) { console.log('No image files.'); process.exit(0); }

// Fetch Commons imageinfo for each.
for (let i = 0; i < files.length; i += 20) {
  const batch = files.slice(i, i + 20);
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('format', 'json');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url|mime|size|extmetadata');
  api.searchParams.set('iiurlwidth', '500');
  api.searchParams.set('titles', batch.join('|'));
  const d = await get(api.toString());
  for (const p of Object.values(d?.query?.pages ?? {})) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const licence = meta.LicenseShortName?.value ?? '?';
    const artist = (meta.Artist?.value ?? '?').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    console.log(`${p.title} | ${licence} | ${info.mime} | ${info.width}x${info.height} | ${artist.slice(0, 60)}`);
    console.log(`   ${info.thumburl}`);
  }
}
