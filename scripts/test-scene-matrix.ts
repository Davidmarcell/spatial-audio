#!/usr/bin/env node
/**
 * Snapshot test of the per-location sound + image matrix. Re-runs the REAL
 * selection pipeline (enrichSounds → selectSceneVariants → getSoundIconSrc)
 * across every curated + procedural globe pin and compares the resulting
 * location×sound→clip and location×sound→image assignment to a committed
 * snapshot, so any accidental drift in routing, weighting or art selection
 * surfaces in the build.
 *
 *   npm run test:scene-matrix        # verify against snapshot (fails on drift)
 *   npm run snapshot:scene-matrix    # regenerate the snapshot after an intended change
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { worldLocations } from '../src/data/worldLocations';
import { getRegion, getRegionSoundCatalog } from '../src/data/environments';
import { enrichSounds } from '../src/utils/soundTypeInference';
import { selectSceneVariants, regionSeed } from '../src/utils/soundscapeSelection';
import { getSoundIconSrc } from '../src/data/iconArt';

const SNAPSHOT = join(dirname(fileURLToPath(import.meta.url)), 'scene-matrix.snapshot.json');

type Matrix = Record<string, { audio: Record<string, string>; image: Record<string, string> }>;

function buildMatrix(): Matrix {
  const matrix: Matrix = {};
  for (const loc of [...worldLocations].sort((a, b) => a.id.localeCompare(b.id))) {
    const region = getRegion(loc.environmentId, loc.regionId);
    if (!region) continue;
    const librarySounds = enrichSounds(
      getRegionSoundCatalog(region.sounds, region.tags),
      region.tags,
    );
    const seed = region.seed ?? regionSeed(loc.environmentId, loc.regionId);
    const selection = selectSceneVariants(librarySounds, { seed, sceneTags: region.tags });
    const regionArt = { id: loc.regionId, soundIds: librarySounds.map((s) => s.id), tags: region.tags };

    const audio: Record<string, string> = {};
    const image: Record<string, string> = {};
    for (const sound of [...librarySounds].sort((a, b) => a.id.localeCompare(b.id))) {
      const v = selection.get(sound.id);
      if (v) audio[sound.id] = v.clipId;
      image[sound.id] = getSoundIconSrc(sound.id, `${seed}:${sound.id}`, regionArt);
    }
    matrix[loc.id] = { audio, image };
  }
  return matrix;
}

const matrix = buildMatrix();
const serialised = JSON.stringify(matrix, null, 2) + '\n';

if (process.env.UPDATE_SNAPSHOT === '1' || process.argv.includes('--update')) {
  writeFileSync(SNAPSHOT, serialised, 'utf8');
  console.log(`\u2713 Scene-matrix snapshot written: ${Object.keys(matrix).length} pins.`);
  process.exit(0);
}

if (!existsSync(SNAPSHOT)) {
  console.error('\u2717 No scene-matrix snapshot found. Run `npm run snapshot:scene-matrix` to create it.');
  process.exit(1);
}

const expected = readFileSync(SNAPSHOT, 'utf8');
if (expected === serialised) {
  console.log(`\u2713 Scene matrix matches snapshot: ${Object.keys(matrix).length} pins.`);
  process.exit(0);
}

// Report the first few differing pins/cells to make regressions actionable.
const prev = JSON.parse(expected) as Matrix;
const diffs: string[] = [];
const pins = new Set([...Object.keys(prev), ...Object.keys(matrix)]);
for (const pin of [...pins].sort()) {
  const a = prev[pin];
  const b = matrix[pin];
  if (!a) { diffs.push(`+ new pin ${pin}`); continue; }
  if (!b) { diffs.push(`- removed pin ${pin}`); continue; }
  for (const kind of ['audio', 'image'] as const) {
    const keys = new Set([...Object.keys(a[kind]), ...Object.keys(b[kind])]);
    for (const k of keys) {
      if (a[kind][k] !== b[kind][k]) {
        diffs.push(`  ${pin} ${kind}.${k}: ${a[kind][k] ?? '∅'} → ${b[kind][k] ?? '∅'}`);
      }
    }
  }
}

console.error(`\u2717 Scene matrix drifted from snapshot (${diffs.length} cell change(s)):`);
for (const d of diffs.slice(0, 40)) console.error(d);
if (diffs.length > 40) console.error(`  … and ${diffs.length - 40} more`);
console.error('\nIf this change is intentional, run `npm run snapshot:scene-matrix` to update.');
process.exit(1);
