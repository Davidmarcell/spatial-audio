#!/usr/bin/env node
// Discovery helper: query Wikimedia Commons for openly-licensed audio per sound type.
// Prints candidate clips (title, license, size, url) for manual curation.
// Usage: node scripts/discover-commons-audio.mjs [type...]

const API = 'https://commons.wikimedia.org/w/api.php';

const ALLOWED_LICENSE = /^(CC0|CC BY( |-)|CC BY-SA|Public domain|PD|CC-BY)/i;
const MIN_KB = 40;
const MAX_KB = 6500;

const QUERIES = {
  wind: ['wind ambience', 'wind blowing trees', 'howling wind'],
  waves: ['ocean waves beach', 'sea waves surf', 'waves shore'],
  rain: ['rain ambience', 'rainfall', 'heavy rain'],
  thunder: ['thunderstorm', 'thunder rain'],
  stream: ['forest stream', 'babbling brook', 'mountain creek'],
  fountain: ['fountain water', 'water fountain park'],
  forest: ['forest ambience', 'woodland birds ambience', 'jungle ambience'],
  songbird: ['Turdus merula song', 'Erithacus rubecula song', 'blackbird dawn chorus'],
  seabird: ['herring gull calls', 'seagull colony', 'Larus calls'],
  owl: ['Strix aluco call', 'tawny owl', 'owl hooting night'],
  'tropical-bird': ['tropical forest birds', 'Ramphastos call', 'parrot calls rainforest'],
  insects: ['cricket chorus night', 'cicada chorus', 'night insects ambience'],
  frogs: ['frog chorus night', 'frogs pond ambience', 'tree frogs'],
  'city-hum': ['city ambience', 'urban background', 'city traffic distant'],
  traffic: ['street traffic ambience', 'road traffic cars', 'busy street'],
  market: ['market crowd ambience', 'bazaar crowd', 'people talking crowd'],
  bells: ['church bells', 'temple bells', 'bell tower'],
  fire: ['campfire crackling', 'fireplace fire'],
};

async function search(term) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `filetype:audio ${term}`,
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|size|mediatype|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription|AttributionRequired',
  }).toString();
  const res = await fetch(url, { headers: { 'User-Agent': 'Saudade/1.0 (dev)' } });
  if (!res.ok) return [];
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  return Object.values(pages);
}

function clean(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const types = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(QUERIES);

for (const type of types) {
  const terms = QUERIES[type];
  if (!terms) continue;
  console.log(`\n========== ${type} ==========`);
  const seen = new Set();
  for (const term of terms) {
    let pages = [];
    try {
      pages = await search(term);
    } catch (err) {
      console.log(`  (search failed for "${term}": ${err.message})`);
      continue;
    }
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info || info.mediatype !== 'AUDIO') continue;
      const kb = Math.round(info.size / 1024);
      if (kb < MIN_KB || kb > MAX_KB) continue;
      const license = clean(info.extmetadata?.LicenseShortName?.value);
      if (!ALLOWED_LICENSE.test(license)) continue;
      if (seen.has(p.title)) continue;
      seen.add(p.title);
      const author = clean(info.extmetadata?.Artist?.value).slice(0, 60);
      console.log(`  [${kb}KB] ${license} | ${p.title}`);
      console.log(`      by: ${author || '?'} | ${info.url}`);
    }
  }
}
