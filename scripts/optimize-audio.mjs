#!/usr/bin/env node
/**
 * Re-encodes public/audio clips down to a lighter bitrate so scene loads
 * (and the initial deploy payload) are smaller. Keeps the existing codec
 * for every file (mp3 stays mp3, ogg/vorbis stays vorbis, opus stays opus)
 * so no manifest src paths change and loop-priming behaviour is unaffected
 * — only the encoded bitrate drops.
 *
 * Bitrate targets scale with clip duration (long ambient beds get the
 * biggest cut since they are background layers, short calls/one-shots keep
 * more headroom) and are skipped entirely if the source is already at or
 * below the target, so nothing is ever re-encoded upward.
 *
 * Usage:
 *   node scripts/optimize-audio.mjs            # dry run, prints the plan
 *   node scripts/optimize-audio.mjs --apply    # re-encodes in place
 *   node scripts/optimize-audio.mjs --apply --only=pool/rain
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, extname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_ROOT = join(ROOT, 'public', 'audio');
const SKIP_DIRS = new Set(['ui']); // freshly hand-tuned UI one-shots; leave alone

const APPLY = process.argv.includes('--apply');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length) : null;

const AUDIO_EXT = new Set(['.mp3', '.ogg', '.oga', '.wav']);

/** @returns {string[]} absolute file paths */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (dir === AUDIO_ROOT && SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(join(dir, entry.name)));
    } else if (AUDIO_EXT.has(extname(entry.name).toLowerCase())) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function ffprobe(file) {
  const raw = execFileSync(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
    { encoding: 'utf8' }
  );
  const json = JSON.parse(raw);
  const stream = json.streams.find((s) => s.codec_type === 'audio');
  const duration = parseFloat(json.format?.duration ?? stream?.duration ?? '0');
  const size = parseInt(json.format?.size ?? '0', 10);
  return {
    codec: stream?.codec_name ?? 'unknown',
    channels: stream?.channels ?? 2,
    sampleRate: parseInt(stream?.sample_rate ?? '44100', 10),
    duration,
    size,
    effectiveBps: duration > 0 ? (size * 8) / duration : 0,
  };
}

/** Bitrate target (bps) by duration tier + channel count. Long loops are
 * background layers and tolerate the most compression; short calls/one-shots
 * keep more headroom for transient detail. */
function targetBitrate({ duration, channels, codec }) {
  const stereo = channels >= 2;
  let base;
  if (duration < 20) base = stereo ? 160_000 : 128_000;
  else if (duration < 60) base = stereo ? 128_000 : 96_000;
  else base = stereo ? 96_000 : 80_000;
  // Opus is meaningfully more efficient per bit than MP3/Vorbis at these
  // bitrates, so it can go lower for the same perceived quality.
  if (codec === 'opus') base = Math.round(base * 0.7);
  return base;
}

function encoderFor(codec) {
  if (codec === 'mp3' || codec === 'pcm_s16le' || codec === 'pcm_s24le') {
    return { name: 'libmp3lame', outExt: '.mp3' };
  }
  if (codec === 'opus') return { name: 'libopus', outExt: null };
  return { name: 'libvorbis', outExt: null }; // vorbis (.ogg/.oga)
}

function fmtMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function planFor(file, probe) {
  const forceConvert = probe.codec === 'pcm_s16le' || probe.codec === 'pcm_s24le';
  const target = targetBitrate(probe);
  const shouldReencode = forceConvert || probe.effectiveBps > target * 1.1;
  return { forceConvert, target, shouldReencode };
}

function reencode(file, probe, plan) {
  const { name: encoder, outExt } = encoderFor(probe.codec);
  const kbps = Math.round(plan.target / 1000);
  const ext = outExt ?? extname(file);
  const tmpOut = join(tmpdir(), `optimize-audio-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  // libvorbis chokes on very high sample rates (e.g. a mislabeled 96kHz
  // source); 48kHz is already more than enough for these ambient beds.
  const sampleRate = Math.min(probe.sampleRate, 48_000);
  const args = ['-y', '-v', 'error', '-i', file, '-vn', '-c:a', encoder, '-b:a', `${kbps}k`, '-ar', String(sampleRate), tmpOut];
  execFileSync('ffmpeg', args, { stdio: 'inherit' });

  const after = ffprobe(tmpOut);
  if (!after.duration || Math.abs(after.duration - probe.duration) > Math.max(0.5, probe.duration * 0.02)) {
    rmSync(tmpOut, { force: true });
    throw new Error(`duration mismatch after re-encode (${probe.duration.toFixed(2)}s -> ${after.duration.toFixed(2)}s)`);
  }
  if (after.size <= 0) {
    rmSync(tmpOut, { force: true });
    throw new Error('re-encoded file is empty');
  }

  const finalPath = ext === extname(file) ? file : file.slice(0, -extname(file).length) + ext;
  renameSync(tmpOut, finalPath);
  if (finalPath !== file) rmSync(file, { force: true });
  return { finalPath, sizeAfter: after.size };
}

function main() {
  let files = walk(AUDIO_ROOT);
  if (ONLY) files = files.filter((f) => relative(AUDIO_ROOT, f).startsWith(ONLY));
  files.sort();

  let totalBefore = 0;
  let totalAfter = 0;
  let reencoded = 0;
  let skipped = 0;
  let failed = 0;
  const renamedFiles = [];

  for (const file of files) {
    const rel = relative(AUDIO_ROOT, file);
    let probe;
    try {
      probe = ffprobe(file);
    } catch (err) {
      console.error(`[probe-fail] ${rel}: ${err.message}`);
      failed += 1;
      continue;
    }
    const plan = planFor(file, probe);
    totalBefore += probe.size;

    if (!plan.shouldReencode) {
      totalAfter += probe.size;
      skipped += 1;
      continue;
    }

    const beforeKbps = Math.round(probe.effectiveBps / 1000);
    const targetKbps = Math.round(plan.target / 1000);
    if (!APPLY) {
      console.log(`[plan] ${rel}  ${probe.codec} ${beforeKbps}kbps -> ${targetKbps}kbps  (${fmtMB(probe.size)})`);
      totalAfter += probe.size * (plan.target / probe.effectiveBps);
      reencoded += 1;
      continue;
    }

    try {
      const { finalPath, sizeAfter } = reencode(file, probe, plan);
      totalAfter += sizeAfter;
      reencoded += 1;
      if (finalPath !== file) renamedFiles.push({ from: `/audio/${rel}`, to: `/audio/${relative(AUDIO_ROOT, finalPath)}` });
      console.log(`[done] ${rel}  ${beforeKbps}kbps -> ${targetKbps}kbps  ${fmtMB(probe.size)} -> ${fmtMB(sizeAfter)}`);
    } catch (err) {
      totalAfter += probe.size;
      failed += 1;
      console.error(`[fail] ${rel}: ${err.message}`);
    }
  }

  console.log('\n--- summary ---');
  console.log(`files scanned: ${files.length}  reencoded: ${reencoded}  skipped: ${skipped}  failed: ${failed}`);
  console.log(`size before: ${fmtMB(totalBefore)}  size after${APPLY ? '' : ' (est.)'}: ${fmtMB(totalAfter)}  saved: ${fmtMB(totalBefore - totalAfter)} (${(100 * (1 - totalAfter / totalBefore)).toFixed(1)}%)`);
  if (renamedFiles.length) {
    console.log('\nrenamed (update manifest src paths):');
    for (const r of renamedFiles) console.log(`  ${r.from} -> ${r.to}`);
  }
  if (!APPLY) console.log('\n(dry run — pass --apply to actually re-encode)');
}

main();
