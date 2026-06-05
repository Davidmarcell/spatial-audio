# Where sounds and artwork come from

This app mixes **real field recordings** and **historical illustrations** so each place feels distinct. Everything is attributed in the in-app **Attributions** page and in [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).

## Audio

| Source | Used for | License |
|--------|----------|---------|
| [Wikimedia Commons](https://commons.wikimedia.org/) | Bird calls and songs (OGG), including Bed-Stuy catbird, cardinal, blue jay | Mostly CC BY-SA; some public domain |
| [Xeno-canto](https://xeno-canto.org/) | Recordings re-hosted on Commons (e.g. cardinal, blue jay) | CC BY-SA 3.0 on file pages |
| [BigSoundBank](https://bigsoundbank.com/) | Wind, forest bed, rain, streams (CC0 loops) | CC0 1.0 |

**Bed-Stuy birds** (`public/audio/bed-stuy/`):

- **Gray catbird** — public-domain recording (G. McGrane, Wikimedia)
- **Northern cardinal** — urban dawn song from Minnesota, via Xeno-canto on Commons
- **Blue jay** — “queedle” call, via Xeno-canto on Commons

Re-download: `npm run download:audio`

### Adding more places (audio)

Good next sources (all need a compatible license and attribution):

1. **Xeno-canto** — search by location (e.g. “New York”, “Italy”); many uploads are CC BY-NC-SA (not always OK for redistribution — prefer files already on Commons).
2. **Wikimedia Commons** — search species + `filetype:ogg`.
3. **Macaulay Library** — excellent NYC/neighbourhood birds; check each clip’s license before bundling.
4. **Freesound.org** — urban ambience (CC0 / CC BY); filter by license.

Add files under `public/audio/<region>/`, wire paths in `src/data/environments.ts`, and list credits in `src/data/attributions.ts`.

## Tile artwork (icons)

| Source | Used for | License |
|--------|----------|---------|
| [NYPL Digital Collections](https://digitalcollections.nypl.org/) | Bed-Stuy birds — Audubon *Birds of America* (octavo) lithographs | Public domain (NYPL) |
| [Wikimedia Commons](https://commons.wikimedia.org/) | NZ / Costa Rica species plates (Buller, Barraband, etc.) | Public domain |
| [The Met Open Access](https://www.metmuseum.org/art/collection/search?isPublicDomain=true) | Themed pools — surf, wind, forest, stream, birds | CC0 |

**Bed-Stuy ambient tiles** use Met Open Access **New York–themed** pools (`nyc-traffic`, `nyc-breeze`, `nyc-park`) — e.g. [Sleighing in New York](https://www.metmuseum.org/art/collection/search/339882) for distant traffic, Brooklyn Bridge / skyline for breeze, Central Park for park rustle. Not generic stream or forest sketches.

**Bed-Stuy bird tiles** (`public/icons/`) — **illustrations** from NYPL ([deep dive](./docs/ILLUSTRATIONS.md)):

- **Gray catbird** — Audubon, Cat-Bird, Pl. 140 ([item](https://digitalcollections.nypl.org/items/2a28c850-c5f9-012f-9b77-58d385a7bc34))
- **Northern cardinal** — Audubon, Common Cardinal Grosbeak, Pl. 203 ([item](https://digitalcollections.nypl.org/items/43a68310-c5f9-012f-0599-58d385a7bc34))
- **Blue jay** — Audubon, Blue Jay, Pl. 231 ([item](https://digitalcollections.nypl.org/items/510d47d9-7308-a3d9-e040-e00a18064a99))

Icons are declared in `scripts/icon-manifest.json` (`nypl`, `wikimedia`, `pools`). Regenerate after edits:

```bash
npm run download:icons
# Optional: search NYPL API when adding plates (needs NYPL_API_TOKEN)
npm run nypl:search -- "species name audubon"
```

Each sound id can have a **fixed** illustration (manifest `wikimedia` entries) or draw from a **Met pool** (`iconArt.ts` → `soundPoolMap`). Within a region, the app assigns **unique** images so two sounds never share the same tile.

## Globe map

- **Renderer** — [globe.gl](https://github.com/vasturiano/globe.gl) / Three.js
- **Earth textures** — [three-globe example images](https://unpkg.com/three-globe/example/img/) (blue marble, day, night, topology, etc.)
- **UI shell** — [Silk](https://silkhq.com/) swipeable sheet (`@silk-hq/components`, non-commercial license for this project)

Share a globe style: `?globe=outline`, `?globe=night-lights`, etc.

## World pins

Curated in `src/data/worldLocations.ts` (lat/lng → environment + region). To add a pin: create or reuse a region in `environments.ts`, then append a row to `worldLocations`.
