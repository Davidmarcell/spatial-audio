#!/usr/bin/env node
/**
 * Search NYPL Digital Collections API (v2) for public-domain items.
 * Requires NYPL_API_TOKEN from https://api.repo.nypl.org/ (signup).
 *
 * Usage:
 *   NYPL_API_TOKEN=... node scripts/nypl-search.mjs "blue jay audubon"
 *   npm run nypl:search -- "cat-bird"
 */
const token = process.env.NYPL_API_TOKEN;
const query = process.argv.slice(2).join(' ').trim();

if (!token) {
  console.error('Set NYPL_API_TOKEN (signup: https://api.repo.nypl.org/)');
  process.exit(1);
}
if (!query) {
  console.error('Usage: NYPL_API_TOKEN=... node scripts/nypl-search.mjs <search terms>');
  process.exit(1);
}

const url = new URL('https://api.repo.nypl.org/api/v2/items/search');
url.searchParams.set('q', query);
url.searchParams.set('publicDomainOnly', 'true');
url.searchParams.set('per_page', '10');

const res = await fetch(url, {
  headers: { Authorization: `Token token="${token}"` },
});
if (!res.ok) {
  console.error(`NYPL API HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
const items = data?.nyplAPI?.response?.result ?? data?.result ?? [];

if (!Array.isArray(items) || items.length === 0) {
  console.log('No results.');
  process.exit(0);
}

for (const item of items) {
  const uuid = item.uuid ?? item.UUID;
  const title = item.title ?? item._title ?? '(untitled)';
  const imageId = item.imageID ?? item.image_id;
  const links = item.imageLinks?.imageLink;
  const linkList = Array.isArray(links) ? links : links ? [links] : [];
  const thumb = linkList.find((l) => l?.$?.type === 'r' || l?.$?.type === 'w')?.$?.link;
  console.log('—'.repeat(60));
  console.log(title);
  if (uuid) console.log(`  item:  https://digitalcollections.nypl.org/items/${uuid}`);
  if (imageId) console.log(`  image: https://iiif-prod.nypl.org/index.php?id=${imageId}&t=q`);
  if (thumb) console.log(`  thumb: ${thumb}`);
}

console.log('\nAPI note: Repo API is deprecated after 2026-08-01; keep imageId + item URL in icon-manifest.json.');
