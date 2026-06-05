# Spatial Audio

**Compose ambient soundscapes in 2D space — drag sounds around a listener, hear distance and stereo pan update in real time.**

> Live demo: _[Add your deploy URL after publishing](#deploy)_ · [Portfolio case study](./docs/PORTFOLIO.md)

---

## Preview

_Add screenshots to `docs/screenshots/` and link them here for your portfolio._

| Spatial canvas | Globe explorer |
| --- | --- |
| _Screenshot: drag sounds on the radar canvas; volume and pan follow distance from **You**_ | _Screenshot: globe.gl map with curated pins, geocode search, and Silk sheet UI_ |

Suggested captures: main canvas with a few sounds placed, globe sheet open, sound art detail sheet, Bed-Stuy palette with NYPL Audubon tiles.

---

## Key features

- **Spatial Web Audio** — Up to six simultaneous sounds on a draggable 2D canvas; distance from the listener controls volume, left/right position controls stereo panning
- **Region sound palettes** — Curated environments (New Zealand forest, Brazil coast, Brooklyn, London, Dolomites, and more) with ambient bed layers and native species sounds
- **Silk sheet UI** — Layered bottom sheets ([@silk-hq/components](https://silkhq.com/)) for globe map, sound art detail, and attributions
- **Globe explorer** — [globe.gl](https://github.com/vasturiano/globe.gl) + Three.js map with curated world pins, country outlines, and multiple earth textures
- **Custom geocoded locations** — Search any place via Nominatim; the app picks the nearest soundscape template and drops a custom pin
- **Use my location** — Browser geolocation matches you to the closest curated region
- **Historical illustration tiles** — NYPL Audubon plates, Wikimedia ornithology, and Met Open Access CC0 artwork ([sourcing guide](./docs/ILLUSTRATIONS.md))
- **Shareable URLs** — Globe visual styles via `?globe=night-lights`; soundscape layout encoding built for link sharing (`src/utils/sceneShare.ts`)
- **Accessible controls** — Keyboard nudge for selected sounds, play/pause bar, random location, full audio attributions

---

## Tech stack

| Layer | Tools |
| --- | --- |
| UI | React 19, TypeScript, CSS Modules |
| Build | Vite 8 |
| Audio | Web Audio API (spatial gain + stereo panner nodes) |
| Globe | globe.gl, Three.js |
| Sheets | Silk (`@silk-hq/components`) |
| Geocoding | OpenStreetMap Nominatim |
| Assets | CC0 / public-domain audio (BigSoundBank, Wikimedia, Xeno-canto); NYPL, Met, Commons illustrations |

---

## Quick start

**Double-click** `Open Spatial Audio.command` in the project folder — it builds (if needed), serves at **http://127.0.0.1:4173**, and opens your browser.

Or from the terminal:

```bash
npm install
npm run download:audio   # first time only, if audio isn't bundled yet
npm run dev              # Vite dev server with hot reload → http://127.0.0.1:5173
```

Production preview:

```bash
npm start                # build + serve + open browser at http://127.0.0.1:4173
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload (port 5173) |
| `npm start` | Production build, serve at http://127.0.0.1:4173, open browser |
| `npm run build` | Production build to `dist/` |
| `npm run serve` | Serve existing build (run `npm run build` first) |
| `npm run preview` | Alias for `serve` |
| `npm run download:audio` | Re-download bundled audio from CC0 / Commons sources |
| `npm run download:icons` | Regenerate illustration tiles from manifest |
| `npm run nypl:search` | Search NYPL API when adding new plates (needs `NYPL_API_TOKEN`) |

---

## Deploy

Static Vite app — build and publish the `dist/` folder.

**Vercel** (recommended): connect the repo; [`vercel.json`](./vercel.json) handles SPA routing.

```bash
npm run build
npx vercel --prod
```

**Netlify:** [`netlify.toml`](./netlify.toml) sets `npm run build` and publish directory `dist`.

```bash
npm run build
# drag dist/ to Netlify, or connect repo in Netlify UI
```

After deploy, update the live demo link at the top of this README and in [docs/PORTFOLIO.md](./docs/PORTFOLIO.md).

---

## Portfolio

Copy-ready case study: **[docs/PORTFOLIO.md](./docs/PORTFOLIO.md)**

No separate portfolio site was found in `~/Projects` — link this repo (or your deploy URL) directly from your portfolio CMS or personal site.

---

## Audio & artwork sources

Bundled sounds and tiles come from CC0 and public-domain collections. See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md), [SOURCES.md](./SOURCES.md), and the in-app attributions sheet for full credits.

Some clips use representative stand-ins where region-specific recordings were unavailable under a compatible license.

---

## Browser support

Requires a modern browser with Web Audio API support. Audio auto-starts on load; if blocked, tap the banner or anywhere on the page once.
