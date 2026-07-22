#!/usr/bin/env node
/**
 * Ad-hoc Wikimedia Commons category lister (curation only). Lists File: members
 * of a category with licence/mime/size/thumb so the curator can find a
 * place-accurate illustration when full-text search drowns in book scans.
 *
 *   node scripts/commons-category.mjs "Wilhelm Kuhnert"
 */
const cat = process.argv.slice(2).join(' ').trim();
if (!cat) {
  console.error('Usage: node scripts/commons-category.mjs "<Category name without prefix>"');
  process.exit(1);
}

async function getWithBackoff(url, retries = 6) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Saudade/1.0 (educational)' } });
    if (r.status === 429 && attempt < retries) {
      await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
      continue;
    }
    if (!r.ok) throw new Error(`Commons API HTTP ${r.status}`);
    return r;
  }
}

const api = new URL('https://commons.wikimedia.org/w/api.php');
api.searchParams.set('action', 'query');
api.searchParams.set('format', 'json');
api.searchParams.set('generator', 'categorymembers');
api.searchParams.set('gcmtitle', `Category:${cat}`);
api.searchParams.set('gcmtype', 'file');
api.searchParams.set('gcmlimit', '60');
api.searchParams.set('prop', 'imageinfo');
api.searchParams.set('iiprop', 'url|mime|size|extmetadata');
api.searchParams.set('iiurlwidth', '500');

const res = await getWithBackoff(api);
const data = await res.json();
const pages = Object.values(data?.query?.pages ?? {});
if (pages.length === 0) {
  console.log('No files in category.');
  process.exit(0);
}
for (const p of pages) {
  const info = p.imageinfo?.[0];
  if (!info) continue;
  const meta = info.extmetadata ?? {};
  const licence = meta.LicenseShortName?.value ?? '?';
  const artist = (meta.Artist?.value ?? '?').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  console.log(`${p.title} | ${licence} | ${info.mime} | ${info.width}x${info.height} | ${artist.slice(0, 70)}`);
  console.log(`   ${info.thumburl}`);
}
