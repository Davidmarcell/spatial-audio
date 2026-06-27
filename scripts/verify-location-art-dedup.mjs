#!/usr/bin/env node
/** Verifies every curated world location resolves to a distinct hero image. */
import { worldLocations } from '../src/data/worldLocations.ts';
import { getLocationArtForItem } from '../src/data/locationArt.ts';

const bySrc = new Map();
const missing = [];
for (const loc of worldLocations) {
  const art = getLocationArtForItem(loc);
  if (!art) {
    missing.push(loc.id);
    continue;
  }
  const src = art.src;
  if (!bySrc.has(src)) bySrc.set(src, []);
  bySrc.get(src).push(loc.id);
}

let dupes = 0;
console.log(`Curated locations: ${worldLocations.length}`);
for (const [src, ids] of bySrc) {
  const flag = ids.length > 1 ? '  <-- DUPLICATE' : '';
  if (ids.length > 1) dupes++;
  console.log(`${src}  ->  ${ids.join(', ')}${flag}`);
}
if (missing.length) console.log(`Missing art: ${missing.join(', ')}`);
console.log(dupes === 0 ? '\nOK: all distinct.' : `\nFAIL: ${dupes} duplicate group(s).`);
process.exit(dupes === 0 && missing.length === 0 ? 0 : 1);
