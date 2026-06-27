#!/usr/bin/env node
/**
 * Downloads the openly-licensed audio variant pools for the dynamic soundscape
 * system and (re)generates src/data/soundClips.generated.ts.
 *
 * Sources:
 *  - BigSoundBank (CC0 1.0) — https://bigsoundbank.com  (numeric mp3 ids)
 *  - Wikimedia Commons (CC0 / Public domain / CC BY(-SA)) — via Special:FilePath
 *
 * Only clips that download successfully and fall inside the size bounds are
 * written into the generated manifest, so a dead link can never leave a
 * dangling pool entry. Re-run with:  npm run download:audio:variants
 */
import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_ROOT = join(ROOT, 'public', 'audio');
const POOL_ROOT = join(AUDIO_ROOT, 'pool');
const MANIFEST_OUT = join(ROOT, 'src', 'data', 'soundClips.generated.ts');

const MIN_BYTES = 30 * 1024;
const MAX_BYTES = 6.5 * 1024 * 1024;
const UA = 'Saudade/1.0 (soundscape asset fetch; contact local-dev)';

const bsbAuthor = 'Joseph SARDIN — BigSoundBank.com';
const bsbLicense = 'CC0 1.0';
const bsbUrl = (slug) => `https://bigsoundbank.com/${slug}.html`;
const bsbMp3 = (num) => `https://bigsoundbank.com/UPLOAD/mp3/${num}.mp3`;

/** BigSoundBank clips: [clipId, type, tags, sustained, numericId, slug, title]. */
const BSB = [
  // ---- wind ----
  ['wind-open', 'wind', ['temperate', 'open'], true, '0595', 'wind-s0595', 'Wind'],
  ['wind-strong-1', 'wind', ['coastal', 'open', 'storm'], true, '0146', 'strong-wind-1-s0146', 'Strong wind #1'],
  ['wind-trees-1', 'wind', ['forest', 'temperate'], true, '1450', 'strong-wind-and-trees-1-s1450', 'Strong wind and trees #1'],
  ['wind-tall-grass', 'wind', ['open', 'temperate', 'rural'], true, '0908', 'wind-in-tall-grass-s0908', 'Wind in tall grass'],
  ['wind-in-tree', 'wind', ['forest', 'temperate'], true, '0659', 'wind-in-a-tree-s0659', 'Wind in a tree'],
  ['wind-whistling', 'wind', ['alpine', 'cold', 'open'], true, '0147', 'whistling-of-the-wind-1-s0147', 'Whistling of the wind #1'],
  // ---- waves / surf ----
  ['waves-sea', 'waves', ['coastal', 'temperate'], true, '0266', 'sea-waves-s0266', 'Sea waves'],
  ['waves-beach-sea', 'waves', ['coastal', 'beach'], true, '1059', 'beach-and-sea-s1059', 'Beach and sea'],
  ['waves-small-beach', 'waves', ['coastal', 'beach', 'calm'], true, '0265', 'beach-small-waves-s0265', 'Beach, small waves'],
  ['waves-froth-beach', 'waves', ['coastal', 'beach'], true, '1446', 'small-waves-and-beach-1-s1446', 'Small waves and beach #1'],
  ['waves-agitated', 'waves', ['coastal', 'storm'], true, '0915', 'slightly-agitated-sea-s0915', 'Slightly agitated sea'],
  // ---- rain ----
  ['rain-storm', 'rain', ['storm', 'temperate'], true, '2719', 'storm-and-rain-4-s2719', 'Storm and rain #4'],
  ['rain-storm-2', 'rain', ['storm', 'tropical'], true, '0740', 'rain-and-storm-2-s0740', 'Rain and storm #2'],
  ['rain-terrace', 'rain', ['urban', 'temperate', 'summer'], true, '1019', 'summer-rain-on-terrace-s1019', 'Summer rain on terrace'],
  ['rain-concrete', 'rain', ['urban'], true, '1289', 'rain-on-concrete-s1289', 'Rain on concrete'],
  ['rain-umbrella', 'rain', ['urban', 'temperate'], true, '2679', 'rain-under-an-umbrella-s2679', 'Rain under an umbrella'],
  // ---- thunder ----
  ['thunder-1', 'thunder', ['storm'], false, '2718', 'thunder-s2718', 'Thunder'],
  ['thunder-2', 'thunder', ['storm'], false, '3113', 'thunder-2-s3113', 'Thunder #2'],
  ['thunder-6', 'thunder', ['storm', 'tropical'], false, '3179', 'thunder-6-s3179', 'Thunder #6'],
  // ---- stream / water ----
  ['stream-brooklet', 'stream', ['forest', 'temperate', 'calm'], true, '0864', 'brooklet-s0864', 'Brooklet'],
  ['stream-small-1', 'stream', ['forest', 'temperate'], true, '0213', 'small-stream-1-s0213', 'Small stream #1'],
  ['stream-watercourse-1', 'stream', ['mountain', 'alpine'], true, '3132', 'watercourse-1-s3132', 'Watercourse #1'],
  ['stream-waterfall', 'stream', ['forest', 'mountain'], true, '0219', 'small-waterfall-2-s0219', 'Small waterfall #2'],
  ['stream-flow', 'stream', ['temperate', 'calm'], true, '0204', 'water-flow-1-s0204', 'Water flow #1'],
  ['forest-stream-mix', 'stream', ['forest', 'temperate'], true, '2713', 'forest-and-stream-1-s2713', 'Forest and stream #1'],
  // ---- forest beds ----
  ['forest-1', 'forest', ['temperate', 'woodland'], true, '0100', 'forest-s0100', 'Forest'],
  ['forest-rambouillet', 'forest', ['temperate', 'european', 'woodland'], true, '0136', 'rambouillet-forest-s0136', 'Rambouillet forest'],
  ['forest-3', 'forest', ['temperate', 'woodland'], true, '2715', 'forest-3-s2715', 'Forest #3'],
  ['forest-edge', 'forest', ['temperate', 'rural'], true, '0905', 'forest-on-the-edge-s0905', 'Forest on the edge'],
  ['forest-night-rain', 'forest', ['temperate', 'night', 'woodland'], true, '0555', 'forest-at-night-after-rain-s0555', 'Forest at night after rain'],
  // ---- insects (cicada / cricket) ----
  ['insects-nocturnal', 'insects', ['tropical', 'night', 'summer'], true, '1470', 'nocturnal-insects-4-s1470', 'Nocturnal insects #4'],
  ['insects-cicada-1', 'insects', ['summer', 'mediterranean'], true, '2246', 'cicada-1-s2246', 'Cicada #1'],
  ['insects-cicadas', 'insects', ['summer', 'tropical'], true, '3002', 'cicadas-s3002', 'Cicadas'],
  ['insects-field-cricket', 'insects', ['temperate', 'rural', 'summer'], true, '1020', 'field-cricket-s1020', 'Field cricket'],
  ['insects-singing-1', 'insects', ['summer', 'night'], true, '3089', 'singing-insect-1-s3089', 'Singing insect #1'],
  // ---- songbird (temperate dawn chorus / blackbird) ----
  ['songbird-blackbird-2', 'songbird', ['temperate', 'european', 'garden'], true, '3474', 'common-blackbird-2-s3474', 'Common blackbird #2'],
  ['songbird-blackbird-5', 'songbird', ['temperate', 'european', 'garden'], true, '3478', 'common-blackbird-5-s3478', 'Common blackbird #5'],
  ['songbird-blackbird-10', 'songbird', ['temperate', 'european', 'woodland'], true, '3483', 'common-blackbird-10-s3483', 'Common blackbird #10'],
  ['songbird-awakening', 'songbird', ['temperate', 'dawn', 'woodland'], true, '0222', 'awakening-birds-s0222', 'Awakening birds'],
  ['songbird-evening', 'songbird', ['temperate', 'dusk', 'garden'], true, '1859', 'evening-birds-s1859', 'Evening birds'],
  // ---- owl ----
  ['owl-tawny-1', 'owl', ['temperate', 'night', 'european'], false, '1763', 'tawny-owl-1-s1763', 'Tawny owl #1'],
  ['owl-tawny-2', 'owl', ['temperate', 'night', 'woodland'], false, '1764', 'tawny-owl-2-s1764', 'Tawny owl #2'],
  ['owl-barn', 'owl', ['temperate', 'night', 'rural'], false, '1400', 'barn-owl-s1400', 'Barn owl'],
  ['owl-night-birds', 'owl', ['night', 'woodland'], true, '0315', 'birds-at-night-s0315', 'Birds at night'],
  // ---- city-hum / traffic / street ----
  ['city-street-roads', 'city-hum', ['urban', 'temperate'], true, '0608', 'street-and-roads-s0608', 'Street and roads'],
  ['city-cheerful-street', 'city-hum', ['urban', 'european'], true, '2372', 'cheerful-street-s2372', 'Cheerful street'],
  ['city-pedestrian', 'city-hum', ['urban', 'european', 'calm'], true, '0527', 'small-pedestrian-street-s0527', 'Small pedestrian street'],
  ['traffic-children-street', 'traffic', ['urban'], true, '0370', 'children-in-the-street-s0370', 'Children in the street'],
  // ---- market / crowd ----
  ['market-covered-1', 'market', ['urban', 'european'], true, '3346', 'covered-market-1-s3346', 'Covered market #1'],
  ['market-crowd', 'market', ['urban'], true, '3515', 'crowd-of-50-60-people-1-s3515', 'Crowd of 50-60 people #1'],
  ['market-spanish-crowd', 'market', ['urban', 'european', 'mediterranean'], true, '0825', 'spanish-crowd-s0825', 'Spanish crowd'],
  // ---- bells ----
  ['bells-church', 'bells', ['european', 'urban'], false, '0135', 'church-bell-s0135', 'Church bell'],
  ['bells-4-church', 'bells', ['european'], false, '0829', '4-church-bells-s0829', '4 church bells'],
  ['bells-tibetan', 'bells', ['asian', 'temple', 'calm'], false, '1109', 'tibetan-bowl-singing-s1109', 'Tibetan bowl, singing'],
  ['bells-bronze', 'bells', ['temple'], false, '2703', 'bronze-bell-1-s2703', 'Bronze bell #1'],
  // ---- fire ----
  ['fire-fireplace', 'fire', ['cold', 'indoor'], true, '0030', 'fireplace-1-s0030', 'Fireplace #1'],
  ['fire-branching-1', 'fire', ['camp', 'rural'], true, '0987', 'big-branching-fire-1-s0987', 'Big branching fire #1'],
  // ---- frogs ----
  ['frogs-1', 'frogs', ['wetland', 'night'], true, '0997', 'frogs-1-s0997', 'Frogs #1'],
  ['frogs-2', 'frogs', ['wetland', 'tropical', 'night'], true, '0998', 'frogs-2-s0998', 'Frogs #2'],
  // ---- seabird (gull) ----
  ['seabird-gulls-harbour', 'seabird', ['coastal', 'harbour'], true, '2573', 'gulls-on-the-harbor-s2573', 'Gulls on the harbour'],
  ['seabird-waves-gulls', 'seabird', ['coastal', 'beach'], true, '0267', 'sea-waves-and-seagulls-s0267', 'Sea waves and seagulls'],
];

/** Wikimedia Commons clips: [clipId, type, tags, sustained, fileName, license, author]. */
const COMMONS = [
  ['wind-howling', 'wind', ['cold', 'storm', 'alpine'], true, 'Howling_wind.ogg', 'CC0', 'Tvabutzku1234 (Wikimedia Commons)'],
  ['waves-pebble', 'waves', ['coastal', 'beach', 'calm'], true, 'On_a_pebble_beach.ogg', 'Public domain', 'earthcalling (Wikimedia Commons)'],
  ['waves-crashing', 'waves', ['coastal', 'storm'], true, 'Oceanwavescrushing.ogg', 'CC BY 3.0', 'Luftrum (Wikimedia Commons)'],
  ['rain-light', 'rain', ['temperate', 'calm'], true, 'Sound_of_light_rainfall.ogg', 'CC BY-SA 4.0', 'Mijesty (Wikimedia Commons)'],
  ['songbird-breeze-birds', 'songbird', ['temperate', 'garden', 'dawn'], true, 'Gentle_breeze_and_birds_singing.ogg', 'Public domain', 'ezwa (Wikimedia Commons)'],
  // ---- jazz / music ----
  ['jazz-park', 'jazz', ['jazz', 'music', 'mellow'], true, 'Jazz at the park.ogg', 'CC0', 'Manwithmetalpig (Wikimedia Commons)'],
  ['jazz-its-a-thing', 'jazz', ['jazz', 'music', 'upbeat'], true, "It's a jazz thing.ogg", 'CC BY 3.0', 'smiling cynic (Wikimedia Commons)'],
  ['jazz-sleepless', 'jazz', ['jazz', 'music', 'mellow', 'late-night'], true, 'Dream a sleepless dream.ogg', 'CC BY 3.0', 'smiling cynic (Wikimedia Commons)'],
  ['jazz-kinda-sorta', 'jazz', ['jazz', 'music', 'mellow'], true, 'Kinda sorta.ogg', 'CC BY 3.0', 'smiling cynic (Wikimedia Commons)'],
  ['jazz-what-can-i-say', 'jazz', ['jazz', 'music', 'upbeat'], true, 'What can i say.ogg', 'CC BY 3.0', 'smiling cynic (Wikimedia Commons)'],
];

/**
 * Legacy in-repo clips already downloaded by scripts/download-audio.sh.
 * Folded into the manifest so they remain attributed and join the pools.
 * [clipId, type, tags, sustained, src, title, author, license, sourceUrl]
 */
const LEGACY = [
  ['legacy-surf', 'waves', ['coastal'], true, '/audio/nz/surf-loop.ogg', 'Adriatic Sea waves', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Adriatic_Sea_waves.ogg'],
  ['legacy-rain-canopy', 'rain', ['tropical', 'storm'], true, '/audio/costa-rica/rain-canopy.mp3', 'Rain and Thunder #20', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/storm-and-rain-4-s2719.html'],
  ['legacy-stream-distant', 'stream', ['forest'], true, '/audio/costa-rica/stream-distant.mp3', 'Forest and Stream #1', 'Pierre SIBANARCO — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/forest-and-stream-1-s2713.html'],
  ['legacy-forest-ambience', 'forest', ['temperate', 'woodland'], true, '/audio/nz/forest-ambience.mp3', 'Forest', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/forest-s0100.html'],
  ['legacy-insect-chorus', 'insects', ['tropical', 'night'], true, '/audio/costa-rica/insect-chorus.mp3', 'Nocturnal Insects #4', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/nocturnal-insects-4-s1470.html'],
  ['legacy-tui', 'songbird', ['pacific', 'nz', 'native'], true, '/audio/nz/tui-loop.ogg', 'Tui song — Trelissick Park', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Tui_song_-_Trelissick_Park_-8_March_2021.ogg'],
  ['legacy-bellbird', 'songbird', ['pacific', 'nz', 'native'], true, '/audio/nz/bellbird-loop.ogg', 'New Zealand Bellbird', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:New_Zealand_Bellbird_(Anthornis_melanura).ogg'],
  ['legacy-blackbird', 'songbird', ['temperate', 'european', 'garden'], true, '/audio/nz/fantail-loop.ogg', 'Common Blackbird song', 'British Library / Wikimedia Commons', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Common_Blackbird_song_(Turdus_merula).ogg'],
  ['legacy-morepork', 'owl', ['pacific', 'nz', 'night'], false, '/audio/nz/morepork-call.ogg', 'Pacific Pygmy Owl call', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Pacific_Pygmy_Owl_call_(Glaucidium_peruanum).ogg'],
  ['legacy-gull', 'seabird', ['coastal', 'european'], true, '/audio/nz/gull-call.ogg', 'Herring Gull', 'British Library / Wikimedia Commons', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Herring_Gull_(Larus_argentatus)_(W1CDR0001420_BD12).ogg'],
  ['legacy-wind', 'wind', ['temperate', 'open'], true, '/audio/nz/wind-loop.mp3', 'Wind', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/wind-s0595.html'],
  ['legacy-toucan', 'tropical-bird', ['tropical', 'jungle'], false, '/audio/costa-rica/toucan-call.ogg', 'Toco Toucan call', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Toco_Toucan_call_(Ramphastos_toco).ogg'],
  ['legacy-quetzal', 'tropical-bird', ['tropical', 'cloud-forest'], true, '/audio/costa-rica/quetzal-song.ogg', 'Resplendent Quetzal song', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Resplendent_Quetzal_song_(Pharomachrus_mocinno).ogg'],
  ['legacy-howler', 'primates', ['tropical', 'jungle'], true, '/audio/costa-rica/howler-distant.mp3', 'Hall of the monkeys (primate ambience)', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/hall-of-the-monkeys-of-the-menagerie-of-paris-s1004.html'],
  ['legacy-catbird', 'songbird', ['temperate', 'americas', 'garden'], true, '/audio/bed-stuy/gray-catbird.ogg', 'Gray Catbird', 'G. McGrane', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Gray_Catbird.ogg'],
  ['legacy-cardinal', 'songbird', ['temperate', 'americas', 'garden'], true, '/audio/bed-stuy/northern-cardinal.ogg', 'Northern Cardinal song (XC125284)', 'Xeno-canto / Wikimedia Commons', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Cardinalis_cardinalis_-_Northern_Cardinal_XC125284.ogg'],
  ['legacy-blue-jay', 'corvid', ['temperate', 'americas'], false, '/audio/bed-stuy/blue-jay.ogg', 'Blue Jay call (XC86756)', 'Jonathon Jongsma / Xeno-canto', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Cyanocitta_cristata_-_Blue_Jay_-_XC86756.ogg'],
];

async function download(url, dest) {
  if (existsSync(dest)) {
    const info = await stat(dest);
    if (info.size >= MIN_BYTES) return { ok: true, bytes: info.size, cached: true };
  }
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow' });
  } catch (err) {
    return { ok: false, reason: `fetch error: ${err.message}` };
  }
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_BYTES) return { ok: false, reason: `too small (${buf.length}B)` };
  if (buf.length > MAX_BYTES) return { ok: false, reason: `too large (${Math.round(buf.length / 1024)}KB)` };
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return { ok: true, bytes: buf.length };
}

const manifest = [];
let okCount = 0;
let failCount = 0;

for (const [id, type, tags, sustained, num, slug, title] of BSB) {
  const src = `/audio/pool/${type}/${id}.mp3`;
  const dest = join(POOL_ROOT, type, `${id}.mp3`);
  const result = await download(bsbMp3(num), dest);
  if (!result.ok) {
    console.warn(`✗ ${id} (${slug}): ${result.reason}`);
    failCount += 1;
    continue;
  }
  okCount += 1;
  console.log(`✓ ${id} ${result.cached ? '(cached)' : `${Math.round(result.bytes / 1024)}KB`}`);
  manifest.push({ id, type, tags, sustained, src, title, author: bsbAuthor, license: bsbLicense, sourceUrl: bsbUrl(slug) });
}

for (const [id, type, tags, sustained, file, license, author] of COMMONS) {
  const ext = file.split('.').pop();
  const src = `/audio/pool/${type}/${id}.${ext}`;
  const dest = join(POOL_ROOT, type, `${id}.${ext}`);
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
  const result = await download(url, dest);
  if (!result.ok) {
    console.warn(`✗ ${id} (${file}): ${result.reason}`);
    failCount += 1;
    continue;
  }
  okCount += 1;
  console.log(`✓ ${id} ${result.cached ? '(cached)' : `${Math.round(result.bytes / 1024)}KB`}`);
  manifest.push({
    id, type, tags, sustained, src,
    title: file.replace(/_/g, ' ').replace(/\.[^.]+$/, ''),
    author, license,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${file}`,
  });
}

for (const [id, type, tags, sustained, src, title, author, license, sourceUrl] of LEGACY) {
  const dest = join(ROOT, 'public', src.replace(/^\//, ''));
  if (!existsSync(dest)) {
    console.warn(`✗ ${id}: missing legacy file ${src} (run scripts/download-audio.sh)`);
    failCount += 1;
    continue;
  }
  okCount += 1;
  manifest.push({ id, type, tags, sustained, src, title, author, license, sourceUrl });
}

manifest.sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type.localeCompare(b.type)));

const banner = `// AUTO-GENERATED by scripts/download-audio-variants.mjs — do not edit by hand.\n// Each entry is one openly-licensed audio clip with its required attribution.\n`;
const body = `import type { SoundClip } from './types';\n\nexport const soundClips: SoundClip[] = ${JSON.stringify(manifest, null, 2)};\n`;
await writeFile(MANIFEST_OUT, banner + body, 'utf8');

console.log(`\nManifest: ${manifest.length} clips written to ${MANIFEST_OUT}`);
console.log(`Downloaded/verified: ${okCount} ok, ${failCount} failed/skipped.`);

// Sanity: confirm we still parse as plausible JSON-ish (no NaN etc.)
const text = await readFile(MANIFEST_OUT, 'utf8');
if (!text.includes('export const soundClips')) {
  console.error('Manifest generation looks wrong.');
  process.exit(1);
}
