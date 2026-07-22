#!/usr/bin/env node
/**
 * Ad-hoc Wikimedia Commons file search (curation only, not wired into build).
 * Finds public-domain / CC0 illustration files (engravings, lithographs,
 * vedute, landscape prints) for a place and prints the canonical File: title,
 * licence, artist, mime and a 500px thumb URL so the curator can pick a
 * region-accurate view and download it via Special:FilePath.
 *
 *   node scripts/commons-search.mjs "view of Rio de Janeiro engraving"
 */
const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node scripts/commons-search.mjs "<query>"');
  process.exit(1);
}

const api = new URL('https://commons.wikimedia.org/w/api.php');
api.searchParams.set('action', 'query');
api.searchParams.set('format', 'json');
api.searchParams.set('generator', 'search');
api.searchParams.set('gsrnamespace', '6');
api.searchParams.set('gsrsearch', query);
api.searchParams.set('gsrlimit', '25');
api.searchParams.set('prop', 'imageinfo');
api.searchParams.set('iiprop', 'url|mime|size|extmetadata');
api.searchParams.set('iiurlwidth', '500');

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

const res = await getWithBackoff(api);
const data = await res.json();
const pages = Object.values(data?.query?.pages ?? {});
if (pages.length === 0) {
  console.log('No results.');
  process.exit(0);
}

pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
for (const p of pages) {
  const info = p.imageinfo?.[0];
  if (!info) continue;
  const meta = info.extmetadata ?? {};
  const licence = meta.LicenseShortName?.value ?? '?';
  const artist = (meta.Artist?.value ?? '?').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const mime = info.mime ?? '?';
  console.log('—'.repeat(70));
  console.log(p.title);
  console.log(`  licence: ${licence} | mime: ${mime} | ${info.width}x${info.height}`);
  console.log(`  artist:  ${artist.slice(0, 120)}`);
  console.log(`  thumb:   ${info.thumburl}`);
}
