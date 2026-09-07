#!/usr/bin/env node
/**
 * Discovery helper for growing the clip library from BigSoundBank (CC0).
 *
 * The `BSB` array in `download-audio-variants.mjs` is hand-maintained, which
 * makes finding candidates the bottleneck rather than adding them. BigSoundBank
 * publishes a sitemap of every sound page, and each page carries a schema.org
 * `AudioObject` block with the name, description, duration and keywords — so
 * the whole catalogue is enumerable and searchable offline.
 *
 * This does NOT download audio or edit the manifest. It prints candidate rows
 * for a human to judge, because "is this the right recording for a Lagos market
 * bed" is not a decision worth automating.
 *
 * Usage:
 *   node scripts/discover-bigsoundbank.mjs --refresh          # rebuild the index
 *   node scripts/discover-bigsoundbank.mjs metro subway tram  # search terms
 *   node scripts/discover-bigsoundbank.mjs --min=20 market    # min duration (s)
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.cache');
const INDEX_PATH = join(CACHE_DIR, 'bigsoundbank-index.json');
const SITEMAP = 'https://bigsoundbank.com/sitemap_bsb.xml';
const UA = 'Saudade/1.0 (open-licence library curation; contact local-dev)';

/** Be a good guest: the catalogue is one person's life's work. */
const REQUEST_DELAY_MS = 350;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Sound pages look like https://bigsoundbank.com/<slug>-s1234.html */
function soundPagesFromSitemap(xml) {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const pages = [];
  for (const url of urls) {
    const match = /\/([a-z0-9-]+)-s(\d{3,5})\.html$/i.exec(url);
    if (!match) continue;
    pages.push({ url, slug: match[1], id: match[2] });
  }
  return pages;
}

/** Pull the schema.org AudioObject block out of a sound page. */
function parseJsonLd(html) {
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (node['@type'] === 'AudioObject') return node;
      }
    } catch {
      // A malformed block on one page should not abort the crawl.
    }
  }
  return null;
}

/** "PT1M20S" → 80 */
function durationSeconds(iso) {
  if (typeof iso !== 'string') return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

async function buildIndex() {
  console.log('fetching sitemap…');
  const pages = soundPagesFromSitemap(await fetchText(SITEMAP));
  console.log(`${pages.length} sound pages found; fetching metadata (this takes a while)…`);

  const entries = [];
  for (const [i, page] of pages.entries()) {
    try {
      const node = parseJsonLd(await fetchText(page.url));
      if (node) {
        entries.push({
          id: page.id,
          slug: page.slug,
          url: page.url,
          title: (node.name ?? '').replace(/\s*—.*$/, '').trim(),
          description: node.description ?? '',
          keywords: typeof node.keywords === 'string' ? node.keywords.split(',').map((k) => k.trim()) : [],
          durationSec: durationSeconds(node.duration),
        });
      }
    } catch (err) {
      console.warn(`  skip ${page.slug}: ${err.message}`);
    }
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${pages.length}…`);
    await sleep(REQUEST_DELAY_MS);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(INDEX_PATH, JSON.stringify(entries, null, 2));
  console.log(`\nwrote ${entries.length} entries to ${INDEX_PATH}`);
  return entries;
}

async function loadIndex() {
  if (!existsSync(INDEX_PATH)) {
    console.error(`No index yet. Run with --refresh first.`);
    process.exit(1);
  }
  return JSON.parse(await readFile(INDEX_PATH, 'utf8'));
}

function search(entries, terms, minDuration) {
  const needles = terms.map((t) => t.toLowerCase());
  return entries
    .map((entry) => {
      const haystack = [entry.title, entry.description, entry.slug, entry.keywords.join(' ')]
        .join(' ')
        .toLowerCase();
      const hits = needles.filter((n) => haystack.includes(n));
      return { entry, hits: hits.length };
    })
    .filter((r) => r.hits > 0)
    .filter((r) => minDuration == null || (r.entry.durationSec ?? 0) >= minDuration)
    .sort((a, b) => b.hits - a.hits || (b.entry.durationSec ?? 0) - (a.entry.durationSec ?? 0));
}

const args = process.argv.slice(2);
if (args.includes('--refresh')) {
  await buildIndex();
  process.exit(0);
}

const minArg = args.find((a) => a.startsWith('--min='));
const minDuration = minArg ? Number(minArg.slice('--min='.length)) : null;
const terms = args.filter((a) => !a.startsWith('--'));

const entries = await loadIndex();
if (terms.length === 0) {
  console.log(`${entries.length} indexed sounds. Pass search terms to filter.`);
  process.exit(0);
}

const results = search(entries, terms, minDuration);
console.log(`${results.length} matches for [${terms.join(', ')}]${minDuration ? ` (≥${minDuration}s)` : ''}\n`);
for (const { entry } of results.slice(0, 40)) {
  const dur = entry.durationSec != null ? `${entry.durationSec}s` : '?';
  console.log(`  s${entry.id.padStart(4, '0')}  ${dur.padStart(5)}  ${entry.title}`);
  console.log(`         slug: ${entry.slug}`);
  if (entry.description) console.log(`         ${entry.description.slice(0, 130)}`);
}
