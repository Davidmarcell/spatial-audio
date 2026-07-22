#!/usr/bin/env node
/**
 * Build-time location-image uniqueness guard. Re-runs the REAL hero-art resolver
 * (`getLocationArtForItem` — bespoke plates, curated keys, and the procedural
 * fallback) across every curated + procedural globe pin and fails the build when
 * any single image asset is the resolved hero for more than one location.
 *
 * Every location must have its OWN unique illustration (see the "unique location
 * imagery" project rule). This guard makes the regression — two pins silently
 * sharing a plate because a procedural pin falls back onto another location's
 * bespoke art — impossible to reintroduce unnoticed. Run via
 * `npm run validate:image-uniqueness` (wired into `npm run build`).
 */
import { worldLocations } from '../src/data/worldLocations';
import { getLocationArtForItem } from '../src/data/locationArt';

const errors: string[] = [];

// Map every image asset (hero src + optional globe crop) to the pins using it.
const bySrc = new Map<string, Set<string>>();
const missing: string[] = [];

for (const loc of worldLocations) {
  const art = getLocationArtForItem(loc);
  if (!art) {
    missing.push(loc.id);
    continue;
  }
  // Both the hero image and its globe re-crop are image files that must not be
  // shared across locations.
  for (const raw of [art.src, art.globeSrc]) {
    if (!raw) continue;
    const pins = bySrc.get(raw) ?? new Set<string>();
    pins.add(loc.id);
    bySrc.set(raw, pins);
  }
}

if (missing.length > 0) {
  errors.push(`no hero art resolves for pin(s): ${missing.join(', ')}`);
}

for (const [src, pins] of bySrc) {
  if (pins.size > 1) {
    errors.push(`image "${src}" is shared by ${pins.size} locations: ${[...pins].sort().join(', ')}`);
  }
}

if (errors.length > 0) {
  console.error(`\u2717 Image-uniqueness validation failed (${errors.length} issue(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `\u2713 Image-uniqueness check passed: ${worldLocations.length} locations, each resolving to its own unique illustration.`,
);
