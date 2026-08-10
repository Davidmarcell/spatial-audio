/**
 * Audits the hand-authored globe pins for personality and stability.
 *
 * The 21 pins are meant to be authored, not generated — they are the showcase,
 * and each should sound like its own place. Two things quietly erode that:
 *
 *  1. **Shared recordings.** Two pins drawing the same clip for the same role
 *     makes them feel like variations of one scene. A little overlap is fine
 *     (Kyoto and the Himalayas can share a temple gong); a clip appearing on
 *     four unrelated pins is not.
 *  2. **Unpinned identity layers.** A layer that resolves from a pool rather
 *     than a named clip is not really authored — it is a preset pick with a
 *     nicer label, and it silently changes whenever the pool grows. Lisbon lost
 *     its Tram 28 to exactly this and only got it back because a snapshot diff
 *     caught it.
 *
 * The goal is NOT "pin everything". Pools are correct for interchangeable
 * ambience — any decent temperate stream will do, and library growth should be
 * allowed to improve it. Pins are correct where a *specific* recording is the
 * point. This report shows which pins have the least authored identity, so that
 * effort goes where it is missing rather than everywhere.
 *
 * Usage: npx tsx scripts/audit-curated-pins.ts
 */
import { getRegion, getRegionSoundCatalog } from '../src/data/environments';
import { worldLocations } from '../src/data/worldLocations';
import { regionSeed, selectSceneVariants } from '../src/utils/soundscapeSelection';
import { enrichSounds } from '../src/utils/soundTypeInference';

type PinReport = {
  name: string;
  bedCount: number;
  pinnedCount: number;
  bespokeIdCount: number;
  clips: string[];
};

const reports: PinReport[] = [];

for (const location of worldLocations) {
  const region = getRegion(location.environmentId, location.regionId);
  if (!region) continue;

  const bedIds = new Set((region.bedSounds ?? []).map((bed) => bed.soundId));
  const library = enrichSounds(getRegionSoundCatalog(region.sounds, region.tags), region.tags);
  const selection = selectSceneVariants(library, {
    seed: region.seed ?? regionSeed(location.environmentId, location.regionId),
    salt: 0,
    sceneTags: region.tags,
  });

  const beds = library.filter((sound) => bedIds.has(sound.id));
  reports.push({
    name: location.name,
    bedCount: beds.length,
    pinnedCount: beds.filter((sound) => sound.fixedClipId).length,
    // A bespoke id (paris-musette, kyoto-uguisu) is what unlocks a bespoke
    // illustration too — layers left on the shared global-* ids draw from the
    // same art pools as every generated scene.
    bespokeIdCount: beds.filter((sound) => !sound.id.startsWith('global-')).length,
    clips: beds
      .map((sound) => selection.get(sound.id)?.clipId)
      .filter((clip): clip is string => Boolean(clip))
      .sort(),
  });
}

// ── Shared recordings ────────────────────────────────────────────────────────
const usage = new Map<string, string[]>();
for (const report of reports) {
  for (const clip of report.clips) {
    usage.set(clip, [...(usage.get(clip) ?? []), report.name]);
  }
}
const shared = [...usage.entries()]
  .filter(([, pins]) => pins.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`Auditing ${reports.length} hand-authored pins.\n`);

console.log('── Bed recordings shared between pins ──');
if (shared.length === 0) {
  console.log('  none — every pin uses a distinct set of recordings\n');
} else {
  for (const [clip, pins] of shared) {
    const flag = pins.length >= 3 ? '  ⚠' : '   ';
    console.log(`${flag} ${pins.length}x  ${clip.padEnd(34)} ${pins.join(', ')}`);
  }
  const worst = shared[0][1].length;
  console.log(`\n  worst overlap: ${worst} pins share one recording` +
    (worst >= 3 ? ' — worth breaking up' : ' (acceptable)') + '\n');
}

// ── Authored identity ────────────────────────────────────────────────────────
console.log('── Authored identity per pin (pinned clips / bespoke ids) ──');
console.log('   A pin with 0 pinned layers is a preset pick with a nicer label:');
console.log('   it will drift as pools grow, and shares its recordings by luck.\n');

const sorted = [...reports].sort(
  (a, b) => a.pinnedCount / a.bedCount - b.pinnedCount / b.bedCount,
);
for (const report of sorted) {
  const bar = '█'.repeat(report.pinnedCount) + '·'.repeat(report.bedCount - report.pinnedCount);
  const flag = report.pinnedCount === 0 ? ' ⚠ nothing authored' : '';
  console.log(
    `  ${report.name.padEnd(18)} ${bar.padEnd(8)} ` +
    `${report.pinnedCount}/${report.bedCount} pinned, ` +
    `${report.bespokeIdCount}/${report.bedCount} bespoke ids${flag}`,
  );
}

const unauthored = reports.filter((r) => r.pinnedCount === 0);
const fullyAuthored = reports.filter((r) => r.pinnedCount === r.bedCount);
console.log(
  `\n  ${fullyAuthored.length} fully authored · ${unauthored.length} with nothing pinned ` +
  `· ${reports.length - fullyAuthored.length - unauthored.length} partial`,
);
if (unauthored.length > 0) {
  console.log(`  unauthored: ${unauthored.map((r) => r.name).join(', ')}`);
}
