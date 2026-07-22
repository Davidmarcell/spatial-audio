#!/usr/bin/env node
/**
 * Ad-hoc Met Open Access search helper (curation only, not wired into build).
 * Prints public-domain objects matching a query with objectID, title, artist,
 * classification and whether an image is available, so the curator can pick
 * region-accurate vedute / topographical views.
 *
 *   node scripts/met-search.mjs "Rio de Janeiro"
 *   node scripts/met-search.mjs "Venice canal" 9   # restrict to Drawings & Prints dept
 */
const UA = 'Saudade/1.0 (educational; saudade)';
const query = process.argv[2];
const departmentId = process.argv[3];
if (!query) {
  console.error('Usage: node scripts/met-search.mjs "<query>" [departmentId]');
  process.exit(1);
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const search = new URL('https://collectionapi.metmuseum.org/public/collection/v1/search');
search.searchParams.set('q', query);
search.searchParams.set('hasImages', 'true');
if (departmentId) search.searchParams.set('departmentId', departmentId);

const data = await getJson(search.toString());
const ids = (data.objectIDs ?? []).slice(0, 40);
console.log(`"${query}": ${data.total} total, inspecting ${ids.length}`);

for (const id of ids) {
  try {
    const o = await getJson(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
    );
    if (!o.isPublicDomain) continue;
    if (!o.primaryImageSmall && !o.primaryImage) continue;
    console.log(
      `#${id} | ${o.classification || '?'} | ${o.objectDate || '?'} | ${o.artistDisplayName || 'Anon'} | ${o.title}`,
    );
  } catch {
    /* ignore individual object errors */
  }
  await new Promise((r) => setTimeout(r, 120));
}
