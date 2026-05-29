# Spatial Audio

A browser-based ambient soundscape builder. Choose an environment (New Zealand forest or Costa Rican rainforest), pick a region, add native sounds from the palette, and drag them on a 2D grid. Distance from **You** controls volume; left/right position controls stereo panning via the Web Audio API.

## Features

- Two environments with region-specific sound palettes
- Ambient bed layer (always-on base sounds per region, e.g. Tui + Coastal Wind for Auckland)
- Draggable 2D spatial canvas with listener at bottom center
- Real-time volume and panning while dragging
- Up to 6 simultaneous spatial sounds
- Auto-play on load (with a one-time tap fallback if the browser blocks audio)
- Keyboard nudge for selected icons (arrow keys; Shift for larger steps)
- Audio attributions page with source licenses

## Quick start (no dev server needed)

**Double-click** `Open Spatial Audio.command` in the project folder. It builds the app (if needed), starts a local server, and opens your browser at:

**http://127.0.0.1:4173**

Bookmark that URL — as long as the server is running, you can reopen the app without running any commands.

Or from the terminal:

```bash
npm install
npm run download:audio   # first time only, if audio isn't bundled yet
npm start              # build + serve + open browser
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Production build, then serve at http://127.0.0.1:4173 and open browser |
| `npm run serve` | Serve existing build (run `npm run build` first) |
| `npm run dev` | Vite dev server with hot reload (for development) |
| `npm run build` | Production build to `dist/` |
| `npm run download:audio` | Re-download bundled audio from CC0 / Commons sources |

## Deploy

This is a static Vite app. Build and deploy the `dist/` folder to any static host.

**Vercel:** connect the repo; the included `vercel.json` handles SPA routing.

**Netlify:** build command `npm run build`, publish directory `dist`.

```bash
npm run build
npx vercel --prod   # or drag dist/ to Netlify
```

## Audio sources

Bundled sounds come from [BigSoundBank](https://bigsoundbank.com) (CC0) and [Wikimedia Commons](https://commons.wikimedia.org). See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) and the in-app attributions page for full credits.

Some clips use representative stand-ins where region-specific recordings were unavailable under a compatible license (noted in attributions).

## Browser support

Requires a modern browser with Web Audio API support. Audio auto-starts on load; if blocked, tap the banner or anywhere on the page once.
