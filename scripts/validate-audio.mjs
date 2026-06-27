#!/usr/bin/env node
/**
 * Build-time guard: every audio clip in the variant pools must have a valid,
 * permissively-licensed attribution AND the referenced file must exist. Run
 * before the build (see package.json) so an unlicensed or dangling clip can
 * never ship. Exits non-zero on any violation.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'src', 'data', 'soundClips.generated.ts');
const PUBLIC = join(ROOT, 'public');

// Only openly-licensed, commercial-use-OK families are allowed.
const ALLOWED_LICENSE = /^(CC0|CC BY(?!-NC)|CC-BY(?!-NC)|Public domain|PD)/i;

// Sources the brief explicitly forbids (non-commercial / not redistributable).
const FORBIDDEN_SOURCE = /(bbc\.co\.uk\/sound|sound-effects\.bbcrewind|remarc|macaulaylibrary|cornell\.edu\/.*macaulay|youtube\.com\/audiolibrary)/i;

function parseManifest(text) {
  const eq = text.indexOf('=', text.indexOf('soundClips'));
  const start = text.indexOf('[', eq);
  const end = text.lastIndexOf(']');
  if (eq === -1 || start === -1 || end === -1) {
    throw new Error('Could not locate clip array in manifest');
  }
  return JSON.parse(text.slice(start, end + 1));
}

const text = await readFile(MANIFEST, 'utf8');
let clips;
try {
  clips = parseManifest(text);
} catch (err) {
  console.error(`✗ Failed to parse manifest: ${err.message}`);
  process.exit(1);
}

const errors = [];
const seenSrc = new Set();

for (const clip of clips) {
  const where = clip.id ?? clip.src ?? '(unknown)';
  if (!clip.src) errors.push(`${where}: missing src`);
  if (!clip.type) errors.push(`${where}: missing type`);
  if (!clip.title?.trim()) errors.push(`${where}: missing attribution title`);
  if (!clip.author?.trim()) errors.push(`${where}: missing attribution author`);
  if (!clip.sourceUrl?.trim()) errors.push(`${where}: missing source URL`);

  if (!clip.license?.trim()) {
    errors.push(`${where}: missing licence`);
  } else if (!ALLOWED_LICENSE.test(clip.license.trim())) {
    errors.push(`${where}: disallowed licence "${clip.license}"`);
  }

  if (clip.sourceUrl && FORBIDDEN_SOURCE.test(clip.sourceUrl)) {
    errors.push(`${where}: forbidden source "${clip.sourceUrl}"`);
  }

  if (clip.src) {
    const file = join(PUBLIC, clip.src.replace(/^\//, ''));
    if (!existsSync(file)) errors.push(`${where}: file not found at public${clip.src}`);
    if (seenSrc.has(clip.src)) errors.push(`${where}: duplicate src ${clip.src}`);
    seenSrc.add(clip.src);
  }
}

if (errors.length > 0) {
  console.error(`✗ Audio attribution validation failed (${errors.length} issue(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ Audio attribution check passed: ${clips.length} clips, all licensed and present.`);
