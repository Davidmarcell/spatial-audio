#!/usr/bin/env node
/**
 * Downloads a curated batch of BigSoundBank (CC0) clips into the pool, trimming
 * over-long recordings and handing off to the shared bitrate optimiser.
 *
 * BigSoundBank ships 320 kbps masters, and several of the urban soundscapes run
 * four to seven minutes — far more than an ambient bed needs, and enough to
 * dominate a scene's download. Anything past `MAX_SECONDS` is trimmed from a
 * short offset (the first seconds of a field recording are often the recordist
 * settling) and given a gentle fade at both ends so it loops without a seam.
 *
 * Usage: node scripts/add-bigsoundbank-batch.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POOL = join(ROOT, 'public', 'audio', 'pool');
const UA = 'Saudade/1.0 (open-licence library curation; contact local-dev)';

/** Ambient beds do not need more than this; longer masters get trimmed. */
const MAX_SECONDS = 110;
/** Skip the first moments of a field recording before trimming. */
const TRIM_OFFSET_SECONDS = 6;
const FADE_SECONDS = 1.5;

/** [bsbId, poolType, clipId, slug] — slug only for the source URL/credit. */
const BATCH = [
  // ---- subway: was a single Paris platform recording for the whole world ----
  ['0092', 'subway', 'subway-metro-rolling', 'metro-paris-2'],
  ['0093', 'subway', 'subway-corridor', 'metro-corridor-paris-1'],
  ['0639', 'subway', 'subway-london-kings-cross', 'king-s-cross-st-pancras-station-london'],
  // ---- tram: was one Lisbon clip ----
  ['0278', 'tram', 'tram-passing', 'passing-tram'],
  // ---- city-hum: four recordings covered every city on earth ----
  ['0641', 'city-hum', 'city-london-street', 'london-street'],
  ['0643', 'city-hum', 'city-london-soundscape', 'london-street-2'],
  ['1713', 'city-hum', 'city-paris-small-street', 'little-parisian-street'],
  ['1346', 'city-hum', 'city-village-centre', 'village-city-center-1'],
  // ---- cafe: a new type; the murmur of a room full of people ----
  ['0624', 'cafe', 'cafe-pizzeria', 'restaurant'],
  ['3542', 'cafe', 'cafe-small-restaurant', 'small-restaurant-conversations'],
  ['3376', 'cafe', 'cafe-brunch', 'restaurant-2'],
  // ---- market ----
  ['3378', 'market', 'market-outdoor-french', 'outdoor-market-2'],
  ['3347', 'market', 'market-covered-2', 'covered-market-2'],
  // ---- stream: no Asian water clip existed ----
  ['0913', 'stream', 'stream-japanese-temple-fountain', 'fountain-of-a-japanese-temple'],
  ['1081', 'stream', 'stream-paris-square-fountain', 'parisian-paved-square-fountain'],
];

function probeDuration(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  );
  return parseFloat(out.trim());
}

async function main() {
  const added = [];
  for (const [bsbId, type, clipId, slug] of BATCH) {
    const dir = join(POOL, type);
    await mkdir(dir, { recursive: true });
    const dest = join(dir, `${clipId}.mp3`);

    const url = `https://bigsoundbank.com/UPLOAD/mp3/${bsbId}.mp3`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
    if (!res.ok) {
      console.error(`✗ ${clipId}: HTTP ${res.status}`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const raw = `${dest}.raw.mp3`;
    await writeFile(raw, buffer);

    const duration = probeDuration(raw);
    if (duration > MAX_SECONDS) {
      const fadeOutStart = (MAX_SECONDS - FADE_SECONDS).toFixed(2);
      execFileSync('ffmpeg', [
        '-y', '-v', 'error',
        '-ss', String(TRIM_OFFSET_SECONDS),
        '-t', String(MAX_SECONDS),
        '-i', raw,
        '-af', `afade=t=in:st=0:d=${FADE_SECONDS},afade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS}`,
        '-c:a', 'libmp3lame', '-b:a', '320k',
        dest,
      ]);
      await rm(raw, { force: true });
    } else {
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-c', 'copy', dest]);
      await rm(raw, { force: true });
    }

    const finalDuration = probeDuration(dest);
    const { size } = await stat(dest);
    console.log(
      `✓ ${clipId.padEnd(32)} ${type.padEnd(9)} ${finalDuration.toFixed(1)}s  ` +
      `${(size / 1024 / 1024).toFixed(2)}MB  (source ${duration.toFixed(0)}s)`,
    );
    added.push({ clipId, type, slug, bsbId, duration: finalDuration });
  }

  const folders = [...new Set(added.map((a) => a.type))];
  console.log(`\n${added.length} clips downloaded. Now optimise them:`);
  for (const folder of folders) {
    console.log(`  node scripts/optimize-audio.mjs --apply --only=pool/${folder}`);
  }
}

await main();
